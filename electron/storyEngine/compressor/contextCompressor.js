const { CharacterStore } = require("../storage/characterStore")
const { EventStore } = require("../storage/eventStore")
const { DependencyStore } = require("../storage/dependencyStore")
class ContextCompressor {
  constructor(novelId, options = {}) {
    if (!novelId) {
      throw new Error("ContextCompressor 需要 novelId 参数")
    }
    
    this.novelId = novelId
    this.characterStore = new CharacterStore(novelId)
    this.eventStore = new EventStore(novelId)
    this.dependencyStore = new DependencyStore(novelId)

    this.options = {
      maxCharacters: options.maxCharacters ?? 8,
      maxEvents: options.maxEvents ?? 12,
      recentEventChapters: options.recentEventChapters ?? 10
    }
  }

  compress(chapter) {
    const deps = this.dependencyStore.getOpenByChapter(chapter)
    const characters = this.pickCharacters(chapter, deps, this.options.maxCharacters)
    const events = this.pickEvents(chapter, characters, deps, this.options.maxEvents)
    return this.render(characters, events, deps, chapter)
  }

  /* =========================
     Pick Characters（活跃状态人物）- O(K)
  ========================= */
  pickCharacters(chapter, deps, topK) {
    const picked = new Map() // characterId -> character

    // ① 来自 active effects
    for (const ch of this.characterStore.getAll()) {
      // 检查角色是否有活跃的 effects
      const activeEffects = this.characterStore.getActiveEffects(ch.id)
      if (activeEffects.length > 0) {
        picked.set(ch.id, ch)
      }
    }
  
    // ② 来自未解决依赖
    for (const dep of deps) {
      for (const id of dep.relatedCharacters || []) {
        const ch = this.characterStore.get(id)
        if (ch) picked.set(id, ch)
      }
    }
    // 遍历所有角色，使用索引快速判断是否活跃（O(1) per character）
     // ③ 兜底：重要但无 effect 的存活角色
    for (const ch of this.characterStore.getAll()) {
      if (picked.size >= topK) break
      if (ch.states.alive && !picked.has(ch.id)) {
        picked.set(ch.id, ch)
      }
    }

    return [...picked.values()].slice(0, topK)

  }

  /* =========================
     Pick Events（仍然影响人物状态的事件）- O(K)
  ========================= */
  pickEvents(chapter, characters, deps, topK) {
    const activeCharacterIds = characters.map(c => c.id).filter(Boolean)
    const activeCharacterNames = new Set(characters.map(c => c.name))
    const recentThreshold = chapter - this.options.recentEventChapters

    // 使用增量索引快速获取相关事件（O(K)，K为角色数）
    const relatedEvents = this.eventStore.getActiveEventsByCharacters(activeCharacterIds, chapter)
    
    // 扩展候选：包含最近章节的事件和与活跃角色名字相关的事件
    const candidates = new Map()
    
    // 1. 添加通过索引获取的事件
    for (const e of relatedEvents) {
      if (e.t <= chapter) {
        candidates.set(e.id, e)
      }
    }
    
    // 2. 添加最近章节的事件（如果不在索引中）
    const recentEvents = this.eventStore.getUntilChapter(chapter)
      .filter(e => e.t >= recentThreshold && !candidates.has(e.id))
    
    for (const e of recentEvents) {
      // dialogue 需要有 summary/detail
      if (e.type === "dialogue" && !e.summary && !e.detail) continue
      candidates.set(e.id, e)
    }
    
    // 3. 添加与活跃角色名字相关的事件
    for (const e of this.eventStore.getUntilChapter(chapter)) {
      if (candidates.has(e.id)) continue
      
      const actorRelated = e.actors?.some(actor => activeCharacterNames.has(actor))
      if (actorRelated) {
        candidates.set(e.id, e)
      }
    }

    // 给事件打分
    const scored = Array.from(candidates.values()).map(e => {
      let score = 0

      // 时间接近度
      score += Math.max(0, 10 - (chapter - e.t))

      // 与活跃角色相关加分（通过 actors）
      const actorRelated = e.actors?.some(actor => activeCharacterNames.has(actor))
      if (actorRelated) score += 8

      // 与活跃角色相关加分（通过 effects 中的 targetId）
      const effectRelated = e.effects?.some(eff => {
        if (eff.targetType === "character" && eff.targetId) {
          return activeCharacterIds.includes(eff.targetId)
        }
        return false
      })
      if (effectRelated) score += 8

      // 仍然有活跃 effects 加分（通过索引判断）
      const hasActiveEffects = relatedEvents.some(re => re.id === e.id)
      if (hasActiveEffects) score += 5

      return { e, score }
    })

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(s => s.e)
  }

  /* ======================
     Render
     ====================== */

  render(characters, events, deps, chapter) {
    return `
你是一个【小说写作 Agent】。
以下内容是【世界已确认事实】，属于系统约束，必须严格遵守。

====================
【人物当前状态（Top ${characters.length}）】
${characters.map(c => this.characterStore.formatItem(c)).join("\n")}

====================
【关键剧情事件（裁剪后）】
${events.map(e => this.eventStore.formatItem(e)).join("\n")}

====================
【未解决剧情依赖】
${deps.map(d => this.dependencyStore.formatItem(d)).join("\n")}

====================
【强约束】
- 不得违背人物状态
- 不得否定已发生事件
- 不得提前解决未解依赖
- 新剧情如改变人物状态或解决依赖，必须显式表现

现在继续写作第 ${chapter} 章。
`
  }
}

module.exports = { ContextCompressor }
