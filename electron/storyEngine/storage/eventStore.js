const { JsonStore } = require("./jsonStore")

class EventStore extends JsonStore {
  constructor() {
    super("data/events.json", [])
    // 增量索引：Map<eventId, Set<characterId>>
    // 记录哪些事件仍然影响哪些人物状态
    this.activeEventIndex = new Map()
    // 事件存储：Map<eventId, event>（用于快速查找）
    this.store = new Map()
    // 加载数据后重建索引
    this.rebuildIndex()
  }

  /**
   * 重建索引（从现有数据）
   */
  rebuildIndex() {
    this.activeEventIndex.clear()
    this.store.clear()
    
    for (const event of this.data || []) {
      if (!event.id) continue
      
      this.store.set(event.id, event)
      
      // 建立反向索引：event -> characters
      const charSet = new Set()
      if (Array.isArray(event.effects)) {
        for (const eff of event.effects) {
          if (eff.targetType === "character" && eff.targetId) {
            charSet.add(eff.targetId)
          }
        }
      }
      
      if (charSet.size > 0) {
        this.activeEventIndex.set(event.id, charSet)
      }
    }
  }
  
  get(id) {
    // 优先从 store 中获取（更快）
    if (this.store && this.store.has(id)) {
      return this.store.get(id)
    }
    return this.data?.find(e => e.id === id)
  }

  getAll() {
    return [...this.data].sort((a, b) => a.t - b.t)
  }
  
  getUntilChapter(chapter) {
    return this.data.filter(e => e.t <= chapter)
  }
  
  clear() {
    this.data.length = 0
    this.activeEventIndex.clear()
    this.store.clear()
    this.save()
  }

  add(rawEvent) {
    // 如果已存在，更新；否则添加
    const index = this.data?.findIndex(e => e.id === rawEvent.id)
    if (index >= 0) {
      this.data[index] = rawEvent
    } else {
      this.data?.push(rawEvent)
    }
    
    // 更新索引
    this.updateIndexForEvent(rawEvent.id, rawEvent)
    this.save()
  }

  /**
   * 更新单个事件的索引
   */
  updateIndexForEvent(eventId, event) {
    if (!eventId || !event) {
      // 如果事件不存在，从索引中移除
      this.activeEventIndex.delete(eventId)
      this.store.delete(eventId)
      return
    }

    this.store.set(eventId, event)
    
    // 建立反向索引：event -> characters
    const charSet = new Set()
    if (Array.isArray(event.effects)) {
      for (const eff of event.effects) {
        if (eff.targetType === "character" && eff.targetId) {
          charSet.add(eff.targetId)
        }
      }
    }
    
    if (charSet.size > 0) {
      this.activeEventIndex.set(eventId, charSet)
    } else {
      this.activeEventIndex.delete(eventId)
    }
  }

  /**
   * 根据角色ID列表获取仍然活跃的事件（O(K)，K为角色数）
   * @param {Array<string>} characterIds - 角色ID列表
   * @param {number} chapter - 当前章节（可选，用于过滤）
   * @returns {Array} 事件数组
   */
  getActiveEventsByCharacters(characterIds, chapter = Infinity) {
    if (!Array.isArray(characterIds) || characterIds.length === 0) {
      return []
    }

    const charSet = new Set(characterIds)
    const result = []
    const seen = new Set()

    for (const [eventId, eventCharSet] of this.activeEventIndex.entries()) {
      // 检查是否有交集
      let hasIntersection = false
      for (const charId of eventCharSet) {
        if (charSet.has(charId)) {
          hasIntersection = true
          break
        }
      }

      if (hasIntersection) {
        const event = this.store.get(eventId)
        if (event && event.t <= chapter && !seen.has(eventId)) {
          result.push(event)
          seen.add(eventId)
        }
      }
    }

    return result.sort((a, b) => b.t - a.t) // 按时间倒序
  }

  getActive(chapter) {
    if (typeof chapter !== "number") return []
    return this.getAll()
      .filter(event => {
        // 1️⃣ 必须已经发生
        if (event.t > chapter) return false

        // 2️⃣ dialogue 默认不产生持续约束
        if (event.type === "dialogue") {
          return event.summary?.length > 0
        }

        // 3️⃣ 没有任何 effect 的事件，默认不 active
        if (!Array.isArray(event.effects) || event.effects.length === 0) {
          return false
        }

        // 4️⃣ 是否存在“仍然有效”的 effect
        return event.effects.some(eff =>
          this.isEffectStillActive(eff, chapter)
        )
      })
      .sort((a, b) => a.t - b.t)
  }

  /* =========================
     effect 生命周期判断
     ========================= */

  isEffectStillActive(effect, chapter) {
    // 永久性 effect
    if (effect.field === "alive" && effect.to === false) {
      return true
    }

    // 角色状态类 effect（health / buff / location）
    if (effect.targetType === "character") {
      // 后续是否被覆盖
      const overridden = this.getAll().some(e => {
        if (e.t <= effect.causedAt) return false
        if (!Array.isArray(e.effects)) return false

        return e.effects.some(ne =>
          ne.targetType === effect.targetType &&
          ne.targetId === effect.targetId &&
          ne.field === effect.field
        )
      })

      return !overridden
    }

    return false
  }
  /**
   * 格式化item 的数组格式，用于显示
   */
  formatItem(event) {
    const lines = []

    // 1️⃣ 标题
    lines.push(
      `【事件 ${event.id}｜第${event.chapter}章】`
    )

    // 2️⃣ 类型
    if (event.type) {
      lines.push(`- 类型：${this.mapType(event.type)}`)
    }

    // 3️⃣ 参与者
    if (Array.isArray(event.actors) && event.actors.length > 0) {
      lines.push(`- 参与者：${event.actors.join("、")}`)
    }

    // 4️⃣ 事件核心摘要（summary 永远优先）
    if (event.summary) {
      lines.push(`- 内容：${event.summary}`)
    }

    // 5️⃣ 有效 effects（强过滤）
    const validEffects = this.filterRenderableEffects(event)

    if (validEffects.length > 0) {
      lines.push(`- 结果：`)
      for (const eff of validEffects) {
        lines.push(
          `  - ${this.formatEffect(eff)}`
        )
      }
    }

    return lines.join("\n")
  }

  /* =========================
     effect filtering
     ========================= */

  filterRenderableEffects(event) {
    if (!Array.isArray(event.effects)) return []

    // dialogue 默认不传播状态改变
    if (event.type === "dialogue") {
      return []
    }

    return event.effects.filter(eff => {
      // 只允许“当前时序确定变化”
      if (eff.targetType !== "character") return false
      if (!eff.field) return false
      if (eff.from === eff.to) return false
      return true
    })
  }

  /* =========================
     helpers
     ========================= */

  formatEffect(eff) {
    switch (eff.field) {
      case "alive":
        return eff.to === false
          ? `${eff.name ?? eff.targetId} 死亡（事件 ${eff.causedBy}）`
          : `${eff.name ?? eff.targetId} 存活状态确认`
      case "health":
        return `${eff.name ?? eff.targetId} 状态变为 ${this.mapHealth(eff.to)}`
      default:
        return `${eff.field} 状态发生变化`
    }
  }

  mapType(type) {
    const map = {
      dialogue: "对话",
      battle: "战斗",
      death: "死亡",
      arrival: "抵达",
      discovery: "发现",
      ritual: "仪式"
    }
    return map[type] || type
  }

  mapHealth(v) {
    switch (v) {
      case "injured":
        return "受伤"
      case "critical":
        return "重伤"
      case "healthy":
        return "健康"
      default:
        return v
    }
  }
}

module.exports = { EventStore }
