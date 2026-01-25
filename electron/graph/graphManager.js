/**
 * 知识图谱管理器
 * 负责图谱的持久化、缓存和生命周期管理
 */
const fs = require('fs')
const path = require('path')
const { app } = require('electron')
const { KnowledgeGraph } = require('./knowledgeGraph')
const { analyzeChapter, incrementalUpdate } = require('./relationExtractor')
const { createChecker } = require('./consistencyChecker')

class GraphManager {
  constructor() {
    this.graphs = new Map() // novelId -> KnowledgeGraph
    this.dataDir = path.join(app.getPath('userData'), 'graphs')

    // 确保目录存在
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true })
    }
  }

  /**
   * 获取或创建小说的知识图谱
   * @param {string} novelId 
   * @returns {KnowledgeGraph}
   */
  getGraph(novelId) {
    if (this.graphs.has(novelId)) {
      return this.graphs.get(novelId)
    }

    // 尝试从文件加载
    const filePath = this.getGraphPath(novelId)
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        const graph = KnowledgeGraph.fromJSON(data)
        this.graphs.set(novelId, graph)
        return graph
      } catch (error) {
        console.error(`加载图谱失败 [${novelId}]:`, error)
      }
    }

    // 创建新图谱
    const graph = new KnowledgeGraph(novelId)
    this.graphs.set(novelId, graph)
    return graph
  }

  /**
   * 保存图谱到文件
   */
  saveGraph(novelId) {
    const graph = this.graphs.get(novelId)
    if (!graph) return false

    try {
      const filePath = this.getGraphPath(novelId)
      fs.writeFileSync(filePath, JSON.stringify(graph.toJSON(), null, 2))
      return true
    } catch (error) {
      console.error(`保存图谱失败 [${novelId}]:`, error)
      return false
    }
  }

  /**
   * 删除指定章节相关的图谱数据
   */
  cleanupChapter(novelId, chapterNumber) {
    const graph = this.getGraph(novelId)
    const result = graph.cleanupChapter(chapterNumber)
    this.saveGraph(novelId)
    return result
  }

  /**
   * 清空图谱(保留图谱实例,只清空所有节点和边)
   */
  clearGraph(novelId) {
    try {
      // 创建新的空图谱替换现有图谱
      const newGraph = new KnowledgeGraph(novelId)
      this.graphs.set(novelId, newGraph)

      // 保存空图谱到文件
      this.saveGraph(novelId)
      return true
    } catch (error) {
      console.error(`清空图谱失败 [${novelId}]:`, error)
      return false
    }
  }


  /**
   * 删除图谱
   */
  deleteGraph(novelId) {
    try {
      this.graphs.delete(novelId)

      const filePath = this.getGraphPath(novelId)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
      return true
    } catch (error) {
      console.error(`删除图谱失败 [${novelId}]:`, error)
      return false
    }
  }

  /**
   * 获取图谱文件路径
   */
  getGraphPath(novelId) {
    return path.join(this.dataDir, `${novelId}.json`)
  }

  /**
   * 章节更新后自动更新图谱
   * 改进版:添加内容哈希校验,全量分析前清理旧数据
   */
  async onChapterUpdate(novelId, chapter, content, previousContent = '', options = {}) {
    const graph = this.getGraph(novelId)

    // 计算当前内容的哈希
    const crypto = require('crypto')
    const currentHash = crypto.createHash('md5').update(content || '').digest('hex')

    // 检查是否需要重新分析(与上次分析的内容比较)
    if (!this.chapterHashes) {
      this.chapterHashes = new Map()
    }

    const lastAnalyzedHash = this.chapterHashes.get(`${novelId}-${chapter}`)
    if (!options?.force && lastAnalyzedHash === currentHash) {
      console.log(`[图谱] 第 ${chapter} 章内容未变化,跳过分析`)
      return { skipped: true, reason: 'content_unchanged' }
    }

    let result
    if (previousContent && content.startsWith(previousContent)) {
      // 增量更新
      result = await incrementalUpdate(content, previousContent, graph, chapter)
    } else {
      // 全量分析前,先清理该章节的旧数据
      const cleanupResult = graph.cleanupChapter(chapter)
      console.log(`[图谱] 清理第 ${chapter} 章旧数据:`, cleanupResult)

      // 全量分析
      result = await analyzeChapter(content, graph, chapter)
    }

    // 保存更新后的图谱
    this.saveGraph(novelId)

    // 保存本次分析的内容哈希
    this.chapterHashes.set(`${novelId}-${chapter}`, currentHash)

    return result
  }

  /**
   * 执行一致性检查
   */
  checkConsistency(novelId) {
    const graph = this.getGraph(novelId)
    const checker = createChecker(graph)
    return checker.fullCheck()
  }

  /**
   * 验证新内容
   */
  async validateContent(novelId, content, chapter) {
    const graph = this.getGraph(novelId)
    const checker = createChecker(graph)
    return checker.validateNewContent(content, chapter)
  }

  /**
   * 获取角色关系网络
   */
  getCharacterNetwork(novelId) {
    const graph = this.getGraph(novelId)
    return graph.getCharacterNetwork()
  }

  /**
   * 获取图谱统计
   */
  getStats(novelId) {
    const graph = this.getGraph(novelId)
    return graph.getStats()
  }

  /**
   * 导出图谱为可视化格式 (兼容 Vue Flow)
   */
  exportForVisualization(novelId) {
    const graph = this.getGraph(novelId)
    const data = graph.toJSON()

    // 转换为 Vue Flow 格式
    const nodes = data.nodes.map((node, index) => ({
      id: node.id,
      type: 'graphNode',
      position: { x: (index % 5) * 200 + 50, y: Math.floor(index / 5) * 150 + 50 },
      data: {
        label: node.label,
        nodeType: node.type,
        description: node.description,
        properties: node.properties
      }
    }))

    const edges = data.edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      label: edge.label || edge.type,
      animated: edge.type === 'enemy',
      style: getEdgeStyle(edge.type)
    }))

    return { nodes, edges }
  }

  /**
   * 批量导入实体
   */
  importEntities(novelId, entities) {
    const graph = this.getGraph(novelId)
    let added = 0

    entities.forEach(entity => {
      const id = entity.id || entity.name.toLowerCase().replace(/\s+/g, '_')
      if (graph.addNode(id, {
        type: entity.type || 'entity',
        label: entity.name || entity.label,
        description: entity.description,
        properties: entity.properties,
        aliases: entity.aliases
      })) {
        added++
      }
    })

    this.saveGraph(novelId)
    return { added }
  }

  /**
   * 批量添加关系
   */
  addRelations(novelId, relations) {
    const graph = this.getGraph(novelId)
    let added = 0

    relations.forEach(rel => {
      const sourceId = rel.source.toLowerCase().replace(/\s+/g, '_')
      const targetId = rel.target.toLowerCase().replace(/\s+/g, '_')

      // 确保节点存在
      if (!graph.getNode(sourceId)) {
        graph.addNode(sourceId, {
          type: 'character',
          label: rel.source
        })
      }
      if (!graph.getNode(targetId)) {
        graph.addNode(targetId, {
          type: 'character',
          label: rel.target
        })
      }

      if (graph.addEdge(sourceId, targetId, {
        type: rel.type,
        label: rel.label,
        chapter: rel.chapter,
        bidirectional: rel.bidirectional
      })) {
        added++
      }
    })

    this.saveGraph(novelId)
    return { added }
  }

  /**
   * 搜索实体
   */
  searchEntities(novelId, query, type = null) {
    const graph = this.getGraph(novelId)
    const nodes = graph.getAllNodes(type)

    const queryLower = query.toLowerCase()
    return nodes.filter(node =>
      node.label?.toLowerCase().includes(queryLower) ||
      node.aliases?.some(a => a.toLowerCase().includes(queryLower)) ||
      node.description?.toLowerCase().includes(queryLower)
    )
  }
}

/**
 * 获取边样式
 */
function getEdgeStyle(type) {
  const styles = {
    friend: { stroke: '#67c23a', strokeWidth: 2 },
    enemy: { stroke: '#f56c6c', strokeWidth: 2 },
    family: { stroke: '#409eff', strokeWidth: 2 },
    lover: { stroke: '#e6a23c', strokeWidth: 2 },
    ally: { stroke: '#67c23a', strokeWidth: 1.5 },
    rival: { stroke: '#f56c6c', strokeWidth: 1.5 },
    master: { stroke: '#909399', strokeWidth: 2 },
    student: { stroke: '#909399', strokeWidth: 1.5 }
  }
  return styles[type] || { stroke: '#c0c4cc', strokeWidth: 1 }
}

// 单例实例
let instance = null

function getGraphManager() {
  if (!instance) {
    instance = new GraphManager()
  }
  return instance
}

module.exports = {
  GraphManager,
  getGraphManager
}
