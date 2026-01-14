const { getEventsByNovel, createEvent, updateEvent, deleteEventsByChapter } = require("../../database/eventDAO")

class EventStore {
  constructor(novelId) {
    if (!novelId) {
      throw new Error("EventStore 需要 novelId 参数")
    }
    this.novelId = novelId
    // 增量索引：Map<eventId, Set<characterId>>
    // 记录哪些事件仍然影响哪些人物状态
    this.activeEventIndex = new Map()
    // 事件存储：Map<eventId, event>（用于快速查找）
    this.store = new Map()
    // 加载数据后重建索引
    this.rebuildIndex()
  }

  /**
   * 重建索引（从数据库加载数据）
   */
  rebuildIndex() {
    this.activeEventIndex.clear()
    this.store.clear()
    
    // 从数据库加载所有事件
    const events = getEventsByNovel(this.novelId)
    
    for (const event of events || []) {
      if (!event.id) continue
      
      // 转换数据库格式到内存格式
      const memEvent = this.dbToMemory(event)
      this.store.set(event.id, memEvent)
      
      // 建立反向索引：event -> characters
      const charSet = new Set()
      if (Array.isArray(memEvent.effects)) {
        for (const eff of memEvent.effects) {
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

  /**
   * 将数据库格式转换为内存格式
   */
  dbToMemory(dbEvent) {
    return {
      id: dbEvent.eventId || dbEvent.id,
      t: dbEvent.chapterNumber,
      chapter: dbEvent.chapterNumber,
      type: dbEvent.type,
      summary: dbEvent.summary,
      detail: dbEvent.detail,
      actors: dbEvent.actors || [],
      effects: dbEvent.effects || []
    }
  }

  /**
   * 将内存格式转换为数据库格式
   */
  memoryToDb(memEvent) {
    return {
      eventId: memEvent.id,
      chapterNumber: memEvent.t || memEvent.chapter,
      type: memEvent.type,
      summary: memEvent.summary,
      detail: memEvent.detail,
      actors: memEvent.actors,
      effects: memEvent.effects
    }
  }
  
  get(id) {
    // 优先从 store 中获取（更快）
    if (this.store && this.store.has(id)) {
      return this.store.get(id)
    }
    // 如果不在内存中，从数据库加载并重建索引
    this.rebuildIndex()
    return this.store.get(id)
  }

  getAll() {
    // 从数据库重新加载以确保数据最新
    this.rebuildIndex()
    return Array.from(this.store.values()).sort((a, b) => a.t - b.t)
  }
  
  getUntilChapter(chapter) {
    this.rebuildIndex()
    return Array.from(this.store.values()).filter(e => e.t <= chapter)
  }

  clear() {
    // 删除该小说所有章节的事件
    // 注意：这里需要知道章节号，如果没有传入，可能需要删除所有
    // 为了安全，我们只清空内存索引，不删除数据库数据
    // 如果需要删除数据库数据，应该传入 chapterNumber
    this.activeEventIndex.clear()
    this.store.clear()
  }

  clearByChapter(chapterNumber) {
    // 删除指定章节的事件
    deleteEventsByChapter(this.novelId, chapterNumber)
    this.rebuildIndex()
  }

  add(rawEvent) {
    // 转换为数据库格式
    const dbData = this.memoryToDb(rawEvent)
    
    // 检查是否已存在（通过 eventId 和 chapterNumber）
    const existing = getEventsByNovel(this.novelId, dbData.chapterNumber)
      .find(e => e.eventId === dbData.eventId)
    
    if (existing) {
      // 更新现有事件
      updateEvent(existing.id, dbData)
    } else {
      // 创建新事件
      createEvent(this.novelId, dbData)
    }
    
    // 更新内存索引
    this.updateIndexForEvent(rawEvent.id, rawEvent)
    // 重新加载以确保同步
    this.rebuildIndex()
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
