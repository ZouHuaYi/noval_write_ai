/**
 * 角色类型配置
 */

const CharacterTypeSpec = {
  main: { canBeActor: true, mustExist: true },
  npc: { canBeActor: true, mustExist: false },
  stub: { canBeActor: true, mustExist: false, transient: true }
}

/**
 * Event 类型配置
 */
const EventTypeSpec = {
  battle: {
    minActors: 2,
    allowActorEmpty: false,
    allowEffects: true
  },
  dialogue: {
    minActors: 1,
    allowActorEmpty: false,
    allowEffects: false
  },
  death: {
    minActors: 1,
    allowActorEmpty: false,
    allowEffects: true,
    requiredEffect: { field: "alive", to: false }
  },
  phenomenon: {
    minActors: 0,
    allowActorEmpty: true,
    allowEffects: false
  },
  discovery: {
    minActors: 1,
    allowActorEmpty: false,
    allowEffects: false
  },
  daily: {
    minActors: 1,
    allowActorEmpty: false,
    allowEffects: false
  }
}

/**
 * 通用规则接口
 */
function createRule(id, description, validate, when) {
  return { id, description, validate, when }
}

/**
 * ==========================
 * 规则定义
 * ==========================
 */

// 1️⃣ 角色存在性规则
const ActorExistRule = createRule(
  'actor.exist',
  '事件中角色必须存在于角色表，或者根据 policy 自动注册 Stub',
  ({ event, characterStore }) => {
    if (!characterStore) return { ok: true }
    for (const actorId of event.actors) {
      if (!characterStore.get(actorId)) {
        // 根据事件 meta.policy 决定行为
        if (event.meta?.ensure?.character === 'stub') {
          characterStore.createStub({ id: actorId, name: actorId })
        } else {
          return {
            ok: false,
            code: 'ACTOR_NOT_FOUND',
            message: `角色【${actorId}】不存在`
          }
        }
      }
    }
    return { ok: true }
  }
)


// 2️⃣ actors 非空规则
const ActorRequiredRule = createRule(
  'actor.required',
  'Event 类型允许 actors 为空则跳过',
  ({ event }) => {
    if (!Array.isArray(event.actors)) {
      return { ok: false, code: 'ACTORS_NOT_ARRAY', message: 'actors 必须为数组' }
    }

    const spec = EventTypeSpec[event.type] || { allowActorEmpty: false }

    if (!spec.allowActorEmpty && event.actors.length === 0) {
      return { ok: false, code: 'ACTORS_EMPTY', message: 'actors 不能为空' }
    }

    return { ok: true }
  }
)


// 3️⃣ actors 去重规则
const ActorUniqueRule = createRule(
  'actor.unique',
  'actors 不允许重复',
  ({ event }) => {
    const set = new Set(event.actors)
    if (set.size !== event.actors.length) {
      return { ok: false, code: 'ACTORS_DUPLICATE', message: 'actors 存在重复角色' }
    }
    return { ok: true }
  }
)


// 4️⃣ 时间顺序规则
const TimeOrderRule = createRule(
  'event.time.order',
  '同一角色事件不可时间倒退',
  ({ event, eventStore }) => {
    if (!eventStore) return { ok: true }
    const pastEvents = eventStore.getAll() || []
    for (const past of pastEvents) {
      const overlap = past.actors.some(a => event.actors.includes(a))
      if (overlap && past.t > event.t) {
        return {
          ok: false,
          code: 'TIME_REVERSE',
          message: `角色在事件 ${event.id} 中发生时间倒退`
        }
      }
    }
    return { ok: true }
  }
)


// 5️⃣ effects 规则
const EffectValidityRule = createRule(
  'effect.validity',
  'event.effects 必须合法',
  ({ event }) => {
    for (const eff of event.effects || []) {
      if (!eff.targetType || !eff.targetId || !eff.field) {
        return { ok: false, code: 'EFFECT_INVALID', message: 'effect 结构不完整' }
      }
      if (!['character', 'dependency'].includes(eff.targetType)) {
        return { ok: false, code: 'EFFECT_UNKNOWN_TARGET', message: `未知 targetType ${eff.targetType}` }
      }
      if (!eff.causedBy || eff.causedBy !== event.id) {
        return { ok: false, code: 'EFFECT_WRONG_CAUSEDBY', message: 'effect.causedBy 必须等于 event.id' }
      }
      if ('from' in eff && eff.from === eff.to) {
        return { ok: false, code: 'EFFECT_NO_CHANGE', message: 'effect 没有变化' }
      }
    }
    return { ok: true }
  }
)


// 6️⃣ Event Type 特殊约束规则
const EventTypeRule = createRule(
  'event.type.constraints',
  '根据 EventTypeSpec 校验类型约束',
  ({ event }) => {
    const spec = EventTypeSpec[event.type]
    if (!spec) return { ok: true }

    if (spec.requiredEffect) {
      const exists = (event.effects || []).some(
        e => e.field === spec.requiredEffect.field && e.to === spec.requiredEffect.to
      )
      if (!exists) {
        return { ok: false, code: 'REQUIRED_EFFECT', message: `事件 ${event.id} 缺少必要 effect` }
      }
    }

    if (spec.minActors && event.actors.length < spec.minActors) {
      return { ok: false, code: 'MIN_ACTORS', message: `事件 ${event.id} 至少需要 ${spec.minActors} 个参与者` }
    }

    if (!spec.allowEffects && (event.effects || []).length > 0) {
      return { ok: false, code: 'EFFECTS_NOT_ALLOWED', message: `事件 ${event.id} 类型不允许产生 effect` }
    }

    return { ok: true }
  }
)


// ==============================
// 导出 Rule Pack
// ==============================
const DefaultRulePack = [
  ActorExistRule,
  ActorRequiredRule,
  ActorUniqueRule,
  TimeOrderRule,
  EffectValidityRule,
  EventTypeRule
]

function checkEventRules(event, { characterStore, eventStore } = {}) {
  for (const rule of DefaultRulePack) {
    const result = rule.validate({ event, characterStore, eventStore })
    if (!result.ok) {
      return result
    }
  }
  return { ok: true }
}


module.exports = {
  checkEventRules
}
