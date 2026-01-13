const { JsonStore } = require("./jsonStore")

class CharacterStore extends JsonStore {
  constructor() {
    super("data/characters.json", [])
    // 增量索引：Map<characterId, Map<field, Effect>>
    // 只保留当前仍然生效的 effect
    this.activeEffectsIndex = new Map()
    // 加载数据后重建索引
    this.rebuildIndex()
  }

  /**
   * 重建 activeEffectsIndex（从现有数据）
   */
  rebuildIndex() {
    this.activeEffectsIndex.clear()
    
    for (const ch of this.data || []) {
      if (!ch.id) continue
      
      const fieldMap = new Map()
      
      // 遍历 history，找出每个字段的最后状态
      if (Array.isArray(ch.history)) {
        for (const h of ch.history) {
          if (!h.field) continue
          // 同字段，后面的覆盖前面的
          fieldMap.set(h.field, {
            field: h.field,
            value: h.to,
            causedBy: h.eventId,
            since: h.createdAt,
            from: h.from,
            reason: h.reason
          })
        }
      }
      
      // 如果字段索引不为空，则添加到索引中
      if (fieldMap.size > 0) {
        this.activeEffectsIndex.set(ch.id, fieldMap)
      }
    }
  }

  get(id) {
    return this.data?.find(c => c.id === id) 
  }
  
  add(ch) {
    // 如果已存在，更新；否则添加
    const index = this.data?.findIndex(c => c.id === ch.id)
    if (index >= 0) {
      this.data[index] = ch
    } else {
      this.data?.push(ch)
    }
    this.save()
    // 更新索引
    this.updateIndexForCharacter(ch.id)
  }

  /**
   * 更新单个角色的索引
   */
  updateIndexForCharacter(characterId) {
    const ch = this.get(characterId)
    if (!ch) {
      // 如果角色不存在，从索引中移除
      this.activeEffectsIndex.delete(characterId)
      return
    }

    const fieldMap = new Map()
    
    // 遍历 history，找出每个字段的最后状态
    if (Array.isArray(ch.history)) {
      for (const h of ch.history) {
        if (!h.field) continue
        // 同字段，后面的覆盖前面的
        fieldMap.set(h.field, {
          field: h.field,
          value: h.to,
          causedBy: h.eventId,
          since: h.createdAt,
          from: h.from,
          reason: h.reason
        })
      }
    }
    
    // 更新索引
    if (fieldMap.size > 0) {
      this.activeEffectsIndex.set(characterId, fieldMap)
    } else {
      this.activeEffectsIndex.delete(characterId)
    }
  }
  
  getAll() {
    return [...this.data].sort((a, b) => a.t - b.t)
  }
  
  clear() {
    this.data.length = 0
    this.activeEffectsIndex.clear()
    this.save()
  }
  
 ensure(id, name, chapter) {
    if (!this.data.find(c => c.id === id)) {
      this.add({
        id,
        name,
        t: chapter,
        states: { 
          alive: true, 
          health: "unknown", 
          relations: {} 
        },
        history: []
      })
    }
  }

  /**
   * 获取截至某章为止，每个角色的“最新状态”
   */
  getLatestStates(chapter) {
    const map = new Map()
  
    for (const ch of this.data) {
      // 找到 <= chapter 的最后一次状态
      const last = [...ch.history]
        .find(h => h.createdAt <= chapter)
        
      if (last || ch.t <= chapter) {
        map.set(ch.id, ch)
      }
    }
  
    return Array.from(map.values())
  }

  isEffectActive(effect, chapter) {
    if (!effect || effect.targetType !== "character") return false
    const ch = this.get(effect.targetId)
    if (!ch) return false

    // 必须已经发生
    if (typeof effect.causedAt === "number" && effect.causedAt > chapter) {
      return false
    }

    // 遍历角色历史，判断是否被覆盖
    if (Array.isArray(ch.history)) {
      for (const h of ch.history) {
        // 同字段，后来的覆盖了 effect
        if (
          h.field === effect.field &&
          h.createdAt > (effect.causedAt ?? 0)
        ) {
          return false
        }
      }
    }

    // 永久状态 (alive=false) 永远有效
    if (effect.field === "alive" && effect.to === false) {
      return true
    }

    return true
  }

  /**
   * 应用 effect（增量更新索引）
   * @param {Object} effect - effect 对象
   * @param {number} chapter - 当前章节
   */
  applyEffect(effect, chapter) {
    const { targetId, field, to, causedBy, reason } = effect
    if (!targetId || !field) return

    // 确保角色存在
    this.ensure(targetId, effect.name || targetId, chapter)
    const ch = this.get(targetId)
    if (!ch) return

    // 保存旧值
    const before = ch.states[field]
    if (before === to) return // 没有变化，跳过

    // 初始化索引
    if (!this.activeEffectsIndex.has(targetId)) {
      this.activeEffectsIndex.set(targetId, new Map())
    }

    const fieldMap = this.activeEffectsIndex.get(targetId)

    // 覆盖同字段 effect（自动失效旧 effect）
    fieldMap.set(field, {
      field,
      value: to,
      causedBy,
      since: chapter,
      from: before,
      reason
    })

    // 同步角色 states
    ch.states[field] = to

    // 写入 history（仅追加）
    if (!ch.history) ch.history = []
    ch.history.push({
      field,
      from: before,
      to,
      eventId: causedBy,
      reason,
      createdAt: chapter
    })

    // 保存
    this.add(ch)
  }

  /**
   * 判断人物是否活跃（O(1)）
   * @param {string} characterId - 角色ID
   * @param {number} chapter - 当前章节（可选，用于未来扩展）
   * @returns {boolean}
   */
  isCharacterActive(characterId, chapter) {
    const map = this.activeEffectsIndex?.get(characterId)
    if (!map) {
      // 如果没有索引，检查角色是否存在且 alive
      const ch = this.get(characterId)
      return ch?.states?.alive === true
    }
    return map.size > 0
  }

  /**
   * 直接获取 activeEffects（O(1)）
   * @param {string} characterId - 角色ID
   * @returns {Array} 仍然有效的 effects 数组
   */
  getActiveEffects(characterId) {
    const map = this.activeEffectsIndex?.get(characterId)
    if (!map) return []
    return [...map.values()]
  }
  
  /**
   * 格式化item 的数组格式，用于显示
   */
  formatItem(character) {
    const lines = []

    // 1️⃣ 标题
    lines.push(`【${character.name}】`)

    const states = character.states || {}
    const history = character.history || []

    /* ---------- 存活状态 ---------- */
    if (states.alive === false) {
      const h = this.findLastHistory(history, "alive")
      lines.push(
        `- 状态：已死亡（事件 ${h?.eventId ?? "未知"}）`
      )
      return lines.join("\n") // 死亡直接截断
    } else {
      lines.push(`- 存活：是`)
    }

    /* ---------- 健康状态 ---------- */
    if (states.health && states.health !== "healthy") {
      const h = this.findLastHistory(history, "health")
      lines.push(
        `- 状态：${this.mapHealth(states.health)}`
        + (h
            ? `（因事件 ${h.eventId}：${this.trim(h.reason)}）`
            : "")
      )
    }

    /* ---------- 关系（仅非空） ---------- */
    if (states.relations && Object.keys(states.relations).length > 0) {
      lines.push(`- 关系：`)
      for (const [k, v] of Object.entries(states.relations)) {
        lines.push(`  - ${k}：${v}`)
      }
    }

    return lines.join("\n")
  }

  /* =========================
     helpers
     ========================= */

  findLastHistory(history, field) {
    return [...history]
      .reverse()
      .find(h => h.field === field)
  }

  mapHealth(health) {
    switch (health) {
      case "injured":
        return "受伤"
      case "critical":
        return "重伤"
      case "healthy":
        return "健康"
      default:
        return health
    }
  }

  trim(text, max = 30) {
    if (!text) return ""
    return text.length > max
      ? text.slice(0, max) + "…"
      : text
  }
  
  /**
   * 可选：获取某个角色的完整时间线
   */
  getTimeline(name) {
    return this.data?.filter(s => s.name === name)
      .sort((a, b) => a.t - b.t)
  }
}

module.exports = {
  CharacterStore
}
