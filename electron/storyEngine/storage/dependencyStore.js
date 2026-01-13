const { JsonStore } = require("./jsonStore")

class DependencyStore extends JsonStore {
  constructor() {
    super("data/dependencies.json", [])
    // 增量索引：Map<chapterNumber, Set<dependencyId>>
    // 记录每个章节的开放依赖
    this.openByChapter = new Map()
    // 依赖存储：Map<dependencyId, dependency>（用于快速查找）
    this.store = new Map()
    // 加载数据后重建索引
    this.rebuildIndex()
  }

  /**
   * 重建索引（从现有数据）
   */
  rebuildIndex() {
    this.openByChapter.clear()
    this.store.clear()
    
    for (const dep of this.data || []) {
      if (!dep.id) continue
      
      this.store.set(dep.id, dep)
      
      // 注册章节区间（只预注册短区间，避免爆炸）
      if (dep.status === "open" && typeof dep.createdAt === "number") {
        const start = dep.createdAt
        const end = dep.resolvedAt ?? Infinity
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

  add(dep) {
    // 如果已存在，更新；否则添加
    const index = this.data?.findIndex(d => d.id === dep.id)
    if (index >= 0) {
      this.data[index] = dep
    } else {
      this.data?.push(dep)
    }
    
    // 更新索引
    this.updateIndexForDependency(dep.id, dep)
    this.save()
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
    return this.data?.find(d => d.id === id)
  }
  
  getOpenRelated(actors) {
    return this.data.filter(
      d => d.status === "open" &&
           d.relatedCharacters.some(a => actors.includes(a))
    ) || []
  }
  
  getAll() {
    return [...this.data]
  }
  
  clear() {
    this.data.length = 0
    this.openByChapter.clear()
    this.store.clear()
    this.save()
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