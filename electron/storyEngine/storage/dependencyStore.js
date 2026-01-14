const { getDependenciesByNovel, createDependency, updateDependency, deleteDependenciesByChapter } = require("../../database/dependencyDAO")

class DependencyStore {
  constructor(novelId) {
    if (!novelId) {
      throw new Error("DependencyStore 需要 novelId 参数")
    }
    this.novelId = novelId
    // 增量索引：Map<chapterNumber, Set<dependencyId>>
    // 记录每个章节的开放依赖
    this.openByChapter = new Map()
    // 依赖存储：Map<dependencyId, dependency>（用于快速查找）
    this.store = new Map()
    // 加载数据后重建索引
    this.rebuildIndex()
  }

  /**
   * 重建索引（从数据库加载数据）
   */
  rebuildIndex() {
    this.openByChapter.clear()
    this.store.clear()
    
    // 从数据库加载所有依赖
    const dependencies = getDependenciesByNovel(this.novelId)
    
    for (const dep of dependencies || []) {
      if (!dep.id) continue
      
      // 转换数据库格式到内存格式
      const memDep = this.dbToMemory(dep)
      this.store.set(dep.id, memDep)
      
      // 注册章节区间（只预注册短区间，避免爆炸）
      if (memDep.status === "open" && typeof memDep.createdAt === "number") {
        const start = memDep.createdAt
        const end = memDep.resolvedAt ?? Infinity
        const maxChapters = 50 // 最多预注册50章
        
        for (let c = start; c <= Math.min(end, start + maxChapters); c++) {
          if (!this.openByChapter.has(c)) {
            this.openByChapter.set(c, new Set())
          }
          this.openByChapter.get(c).add(dep.id)
        }
      }
    }
  }

  /**
   * 将数据库格式转换为内存格式
   */
  dbToMemory(dbDep) {
    return {
      id: dbDep.id,
      description: dbDep.description,
      type: dbDep.type,
      relatedCharacters: dbDep.relatedCharacters || [],
      status: dbDep.status,
      createdAt: dbDep.chapterNumber, // 使用 chapterNumber 作为 createdAt
      resolveWhen: dbDep.resolveWhen || [],
      violateWhen: dbDep.violateWhen || [],
      resolvedAt: dbDep.resolvedAt,
      resolvedBy: dbDep.resolvedBy,
      violatedBy: dbDep.violatedBy
    }
  }

  /**
   * 将内存格式转换为数据库格式
   */
  memoryToDb(memDep) {
    return {
      eventId: memDep.eventId || '',
      chapterNumber: memDep.createdAt || memDep.chapterNumber || 0,
      description: memDep.description,
      type: memDep.type,
      relatedCharacters: memDep.relatedCharacters,
      resolveWhen: memDep.resolveWhen,
      violateWhen: memDep.violateWhen,
      status: memDep.status
    }
  }

  add(dep) {
    // 转换为数据库格式
    const dbData = this.memoryToDb(dep)
    
    // 检查是否已存在
    const existing = getDependenciesByNovel(this.novelId)
      .find(d => d.id === dep.id)
    
    if (existing) {
      // 更新现有依赖
      updateDependency(existing.id, dbData)
    } else {
      // 创建新依赖，使用传入的 id
      createDependency(this.novelId, {
        ...dbData,
        id: dep.id
      })
    }
    
    // 更新内存索引
    this.updateIndexForDependency(dep.id, dep)
    // 重新加载以确保同步
    this.rebuildIndex()
  }

  /**
   * 更新单个依赖的索引
   */
  updateIndexForDependency(depId, dep) {
    if (!depId || !dep) {
      // 如果依赖不存在，从索引中移除
      this.store.delete(depId)
      // 从所有章节的索引中移除
      for (const charSet of this.openByChapter.values()) {
        charSet.delete(depId)
      }
      return
    }

    this.store.set(depId, dep)
    
    // 如果依赖已解决，从所有章节索引中移除
    if (dep.status !== "open") {
      for (const charSet of this.openByChapter.values()) {
        charSet.delete(depId)
      }
      return
    }
    
    // 注册章节区间（只预注册短区间）
    if (typeof dep.createdAt === "number") {
      const start = dep.createdAt
      const end = dep.resolvedAt ?? Infinity
      const maxChapters = 50 // 最多预注册50章
      
      for (let c = start; c <= Math.min(end, start + maxChapters); c++) {
        if (!this.openByChapter.has(c)) {
          this.openByChapter.set(c, new Set())
        }
        this.openByChapter.get(c).add(depId)
      }
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
  
  getOpenRelated(actors) {
    this.rebuildIndex()
    return Array.from(this.store.values()).filter(
      d => d.status === "open" &&
           d.relatedCharacters.some(a => actors.includes(a))
    ) || []
  }
  
  getAll() {
    // 从数据库重新加载以确保数据最新
    this.rebuildIndex()
    return Array.from(this.store.values())
  }
  
  clear() {
    // 只清空内存索引，不删除数据库数据
    this.openByChapter.clear()
    this.store.clear()
  }

  clearByChapter(chapterNumber) {
    // 删除指定章节的依赖
    deleteDependenciesByChapter(this.novelId, chapterNumber)
    this.rebuildIndex()
  }

  getOpenByChapter(chapter) {
    if (typeof chapter !== "number") return []
    
    // 使用索引快速获取（O(1)）
    const ids = this.openByChapter?.get(chapter)
    if (!ids || ids.size === 0) {
      // 如果索引中没有，回退到全量扫描（但这种情况应该很少）
      return Array.from(this.data)
        .filter(d => d.status === "open" && d.createdAt <= chapter)
        .sort((a, b) => b.createdAt - a.createdAt)
    }
    
    // 从索引中获取依赖
    const deps = []
    for (const id of ids) {
      const dep = this.store.get(id)
      if (dep && dep.status === "open" && dep.createdAt <= chapter) {
        deps.push(dep)
      }
    }
    
    return deps.sort((a, b) => b.createdAt - a.createdAt)
  }

  /**
   * 格式化item 的数组格式，用于显示
   */
  formatItem(dep) {
    const lines = []

    // 1️⃣ 标题（强标识：未解依赖）
    lines.push(`【未解依赖 ${dep.id}】`)

    // 2️⃣ 关联人物
    if (Array.isArray(dep.relatedCharacters) && dep.relatedCharacters.length > 0) {
      lines.push(`- 关联人物：${dep.relatedCharacters.join("、")}`)
    }

    // 3️⃣ 核心描述（原样保留，不解释）
    if (dep.description) {
      lines.push(`- 内容：${dep.description}`)
    }

    // 4️⃣ 状态（强约束语）
    lines.push(`- 状态：${this.mapStatus(dep.status)}`)

    // 5️⃣ 创建时间（轻量时间锚）
    if (typeof dep.createdAt === "number") {
      lines.push(`- 提出于：第 ${dep.createdAt} 章`)
    }

    return lines.join("\n")
  }

  /* =========================
     helpers
     ========================= */

  mapStatus(status) {
    switch (status) {
      case "open":
        return "尚未确认（不可提前解释或强化）"
      case "resolved":
        return "已确认（世界事实）"
      case "violated":
        return "已被否定（不可再使用）"
      default:
        return status
    }
  }
}

module.exports = { DependencyStore }