/**
 * 知识图谱服务
 * 使用 graphology 实现小说知识图谱管理
 * 
 * 节点类型：角色(character)、地点(location)、物品(item)、事件(event)、概念(concept)
 * 边类型：关系(relation)、行为(action)、位置(at)、拥有(has)、参与(participates)
 */

const Graph = require('graphology')
const { bfsFromNode } = require('graphology-traversal')
const { bidirectional } = require('graphology-shortest-path')

/**
 * 知识图谱管理器
 */
class KnowledgeGraph {
  constructor(novelId) {
    this.novelId = novelId
    this.graph = new Graph({ type: 'directed', multi: true })
    this.metadata = {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    }
  }

  // ===== 节点操作 =====

  /**
   * 添加节点
   * @param {string} id - 节点 ID
   * @param {Object} attributes - 节点属性
   * @returns {boolean}
   */
  addNode(id, attributes = {}) {
    if (this.graph.hasNode(id)) {
      return false
    }

    this.graph.addNode(id, {
      type: attributes.type || 'entity',
      label: attributes.label || id,
      description: attributes.description || '',
      aliases: attributes.aliases || [],
      properties: attributes.properties || {},
      firstMention: attributes.firstMention || null, // 首次出现章节
      lastMention: attributes.lastMention || null,   // 最后出现章节
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...attributes
    })

    this.metadata.updatedAt = Date.now()
    return true
  }

  /**
   * 更新节点属性
   */
  updateNode(id, attributes) {
    if (!this.graph.hasNode(id)) {
      return false
    }

    const existing = this.graph.getNodeAttributes(id)
    this.graph.setNodeAttributes(id, {
      ...existing,
      ...attributes,
      updatedAt: Date.now()
    })

    this.metadata.updatedAt = Date.now()
    return true
  }

  /**
   * 获取节点
   */
  getNode(id) {
    if (!this.graph.hasNode(id)) {
      return null
    }
    return {
      id,
      ...this.graph.getNodeAttributes(id)
    }
  }

  /**
   * 获取所有节点
   */
  getAllNodes(type = null) {
    const nodes = []
    this.graph.forEachNode((id, attrs) => {
      if (!type || attrs.type === type) {
        nodes.push({ id, ...attrs })
      }
    })
    return nodes
  }

  /**
   * 删除节点
   */
  removeNode(id) {
    if (!this.graph.hasNode(id)) {
      return false
    }
    this.graph.dropNode(id)
    this.metadata.updatedAt = Date.now()
    return true
  }

  /**
   * 清理指定章节关联的节点和关系
   */
  cleanupChapter(chapterNumber) {
    if (chapterNumber == null) return { nodesRemoved: 0, edgesRemoved: 0 }

    let nodesRemoved = 0
    let edgesRemoved = 0

    // 删除该章节产生的边
    const edgeKeys = this.graph.edges()
    edgeKeys.forEach(edgeKey => {
      const attrs = this.graph.getEdgeAttributes(edgeKey)
      if (attrs?.chapter === chapterNumber) {
        this.graph.dropEdge(edgeKey)
        edgesRemoved += 1
      }
    })

    // 删除首次出现或最后出现为该章节的节点
    const nodesToRemove = []
    this.graph.forEachNode((id, attrs) => {
      if (attrs?.firstMention === chapterNumber || attrs?.lastMention === chapterNumber) {
        nodesToRemove.push(id)
      }
    })

    nodesToRemove.forEach(id => {
      this.graph.dropNode(id)
      nodesRemoved += 1
    })

    if (nodesRemoved > 0 || edgesRemoved > 0) {
      this.metadata.updatedAt = Date.now()
    }

    return { nodesRemoved, edgesRemoved }
  }


  // ===== 边操作 =====

  /**
   * 添加关系边
   * @param {string} source - 源节点 ID
   * @param {string} target - 目标节点 ID
   * @param {Object} attributes - 边属性
   * @returns {string|null} 边 ID
   */
  addEdge(source, target, attributes = {}) {
    if (!this.graph.hasNode(source) || !this.graph.hasNode(target)) {
      return null
    }

    const edgeId = `${source}->${target}:${attributes.type || 'relation'}:${Date.now()}`

    this.graph.addEdgeWithKey(edgeId, source, target, {
      type: attributes.type || 'relation',
      label: attributes.label || '',
      description: attributes.description || '',
      weight: attributes.weight || 1,
      chapter: attributes.chapter || null, // 关系出现的章节
      temporal: attributes.temporal || false, // 是否是临时关系
      bidirectional: attributes.bidirectional || false,
      createdAt: Date.now(),
      ...attributes
    })

    // 如果是双向关系，添加反向边
    if (attributes.bidirectional) {
      const reverseId = `${target}->${source}:${attributes.type || 'relation'}:${Date.now()}`
      this.graph.addEdgeWithKey(reverseId, target, source, {
        type: attributes.type || 'relation',
        label: attributes.reverseLabel || attributes.label || '',
        description: attributes.description || '',
        weight: attributes.weight || 1,
        chapter: attributes.chapter || null,
        isReverse: true,
        createdAt: Date.now()
      })
    }

    this.metadata.updatedAt = Date.now()
    return edgeId
  }

  /**
   * 获取两个节点之间的所有关系
   */
  getEdgesBetween(source, target) {
    const edges = []
    this.graph.forEachEdge(source, target, (id, attrs, src, tgt) => {
      edges.push({ id, source: src, target: tgt, ...attrs })
    })
    return edges
  }

  /**
   * 获取节点的所有关系
   */
  getNodeEdges(nodeId, direction = 'all') {
    const edges = []

    if (direction === 'all' || direction === 'out') {
      this.graph.forEachOutEdge(nodeId, (id, attrs, src, tgt) => {
        edges.push({ id, source: src, target: tgt, direction: 'out', ...attrs })
      })
    }

    if (direction === 'all' || direction === 'in') {
      this.graph.forEachInEdge(nodeId, (id, attrs, src, tgt) => {
        edges.push({ id, source: src, target: tgt, direction: 'in', ...attrs })
      })
    }

    return edges
  }

  /**
   * 更新边属性
   */
  updateEdge(edgeId, attributes) {
    if (!this.graph.hasEdge(edgeId)) {
      return false
    }

    const existing = this.graph.getEdgeAttributes(edgeId)
    this.graph.setEdgeAttributes(edgeId, {
      ...existing,
      ...attributes,
      updatedAt: Date.now()
    })

    this.metadata.updatedAt = Date.now()
    return true
  }

  /**
   * 删除边
   */
  removeEdge(edgeId) {
    if (!this.graph.hasEdge(edgeId)) {
      return false
    }
    this.graph.dropEdge(edgeId)
    this.metadata.updatedAt = Date.now()
    return true
  }

  // ===== 图谱查询 =====

  /**
   * 查找节点的邻居
   * @param {string} nodeId - 节点 ID
   * @param {number} depth - 深度
   */
  findNeighbors(nodeId, depth = 1) {
    if (!this.graph.hasNode(nodeId)) {
      return []
    }

    const visited = new Set()
    const result = []

    bfsFromNode(this.graph, nodeId, (node, attrs, d) => {
      if (d > 0 && d <= depth && !visited.has(node)) {
        visited.add(node)
        result.push({
          id: node,
          depth: d,
          ...attrs
        })
      }
      return d < depth
    })

    return result
  }

  /**
   * 查找两个节点之间的路径
   */
  findPath(source, target) {
    if (!this.graph.hasNode(source) || !this.graph.hasNode(target)) {
      return null
    }

    try {
      const path = bidirectional(this.graph, source, target)
      if (!path) return null

      return path.map(nodeId => ({
        id: nodeId,
        ...this.graph.getNodeAttributes(nodeId)
      }))
    } catch (e) {
      return null
    }
  }

  /**
   * 查找特定类型的关系
   */
  findRelationsByType(relationType) {
    const edges = []
    this.graph.forEachEdge((id, attrs, src, tgt) => {
      if (attrs.type === relationType) {
        edges.push({
          id,
          source: src,
          target: tgt,
          ...attrs
        })
      }
    })
    return edges
  }

  /**
   * 获取角色关系网络
   */
  getCharacterNetwork() {
    const characters = this.getAllNodes('character')
    const network = {
      nodes: characters,
      edges: []
    }

    characters.forEach(char => {
      const edges = this.getNodeEdges(char.id)
      edges.forEach(edge => {
        const targetNode = this.getNode(edge.target)
        if (targetNode && targetNode.type === 'character') {
          network.edges.push(edge)
        }
      })
    })

    return network
  }

  // ===== 冲突检测 =====

  /**
   * 检测潜在冲突
   * 分析图谱中的不一致性
   */
  detectConflicts() {
    const conflicts = []

    // 1. 检测死亡角色仍在活动
    this.graph.forEachNode((id, attrs) => {
      if (attrs.type === 'character' && attrs.properties?.status === 'dead') {
        const recentEdges = this.getNodeEdges(id).filter(e =>
          e.chapter && e.chapter > (attrs.properties?.deathChapter || 0)
        )
        if (recentEdges.length > 0) {
          conflicts.push({
            type: 'dead_character_active',
            severity: 'high',
            node: id,
            message: `角色 "${attrs.label}" 已在第 ${attrs.properties.deathChapter} 章死亡，但在之后的章节仍有活动`,
            evidence: recentEdges
          })
        }
      }
    })

    // 2. 检测矛盾的关系
    const relationPairs = new Map()
    this.graph.forEachEdge((id, attrs, src, tgt) => {
      const key = `${src}-${tgt}`
      if (!relationPairs.has(key)) {
        relationPairs.set(key, [])
      }
      relationPairs.get(key).push({ id, ...attrs })
    })

    relationPairs.forEach((edges, key) => {
      // 检测同时存在矛盾关系（如既是朋友又是敌人）
      const relationTypes = edges.map(e => e.type)
      if (relationTypes.includes('friend') && relationTypes.includes('enemy')) {
        const [src, tgt] = key.split('-')
        conflicts.push({
          type: 'contradictory_relation',
          severity: 'medium',
          nodes: [src, tgt],
          message: `"${this.getNode(src)?.label}" 和 "${this.getNode(tgt)?.label}" 之间存在矛盾的关系（既是朋友又是敌人）`,
          evidence: edges
        })
      }
    })

    // 3. 检测位置冲突（同一时间在不同地点）
    const characterLocations = new Map()
    this.graph.forEachEdge((id, attrs, src, tgt) => {
      if (attrs.type === 'at' || attrs.type === 'location') {
        const srcNode = this.getNode(src)
        if (srcNode?.type === 'character' && attrs.chapter) {
          const key = `${src}-${attrs.chapter}`
          if (!characterLocations.has(key)) {
            characterLocations.set(key, [])
          }
          characterLocations.get(key).push({ location: tgt, edge: { id, ...attrs } })
        }
      }
    })

    characterLocations.forEach((locations, key) => {
      if (locations.length > 1) {
        const [charId, chapter] = key.split('-')
        const charNode = this.getNode(charId)
        const locationNames = locations.map(l => this.getNode(l.location)?.label || l.location)
        conflicts.push({
          type: 'location_conflict',
          severity: 'medium',
          node: charId,
          chapter: parseInt(chapter),
          message: `角色 "${charNode?.label}" 在第 ${chapter} 章同时出现在多个地点: ${locationNames.join(', ')}`,
          evidence: locations
        })
      }
    })

    return conflicts
  }

  /**
   * 验证新关系是否与现有图谱冲突
   */
  validateNewRelation(source, target, relationType, chapter) {
    const issues = []
    const sourceNode = this.getNode(source)
    const targetNode = this.getNode(target)

    if (!sourceNode || !targetNode) {
      issues.push({
        type: 'missing_node',
        message: '源节点或目标节点不存在'
      })
      return { valid: issues.length === 0, issues }
    }

    // 检查死亡角色
    if (sourceNode.type === 'character' && sourceNode.properties?.status === 'dead') {
      if (chapter > (sourceNode.properties?.deathChapter || Infinity)) {
        issues.push({
          type: 'dead_character',
          message: `角色 "${sourceNode.label}" 已死亡，无法在第 ${chapter} 章建立新关系`
        })
      }
    }

    // 检查矛盾关系
    const existingEdges = this.getEdgesBetween(source, target)
    const contradictions = {
      friend: ['enemy', 'rival'],
      enemy: ['friend', 'ally'],
      ally: ['enemy'],
      rival: ['friend', 'ally'],
      alive: ['dead'],
      dead: ['alive']
    }

    if (contradictions[relationType]) {
      const conflictingEdges = existingEdges.filter(e =>
        contradictions[relationType].includes(e.type)
      )
      if (conflictingEdges.length > 0) {
        issues.push({
          type: 'contradictory_relation',
          message: `试图建立 "${relationType}" 关系，但已存在矛盾关系`,
          existing: conflictingEdges
        })
      }
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }

  // ===== 序列化 =====

  /**
   * 导出图谱为 JSON
   */
  toJSON() {
    const nodes = []
    const edges = []

    this.graph.forEachNode((id, attrs) => {
      nodes.push({ id, ...attrs })
    })

    this.graph.forEachEdge((id, attrs, src, tgt) => {
      edges.push({ id, source: src, target: tgt, ...attrs })
    })

    return {
      novelId: this.novelId,
      metadata: this.metadata,
      nodes,
      edges
    }
  }

  /**
   * 从 JSON 加载图谱
   */
  static fromJSON(json) {
    const kg = new KnowledgeGraph(json.novelId)
    kg.metadata = json.metadata || kg.metadata

    // 添加节点
    json.nodes?.forEach(node => {
      const { id, ...attrs } = node
      kg.graph.addNode(id, attrs)
    })

    // 添加边
    json.edges?.forEach(edge => {
      const { id, source, target, ...attrs } = edge
      if (kg.graph.hasNode(source) && kg.graph.hasNode(target)) {
        kg.graph.addEdgeWithKey(id, source, target, attrs)
      }
    })

    return kg
  }

  // ===== 统计信息 =====

  getStats() {
    const nodeTypes = {}
    const edgeTypes = {}

    this.graph.forEachNode((id, attrs) => {
      const type = attrs.type || 'unknown'
      nodeTypes[type] = (nodeTypes[type] || 0) + 1
    })

    this.graph.forEachEdge((id, attrs) => {
      const type = attrs.type || 'unknown'
      edgeTypes[type] = (edgeTypes[type] || 0) + 1
    })

    return {
      nodeCount: this.graph.order,
      edgeCount: this.graph.size,
      nodeTypes,
      edgeTypes,
      density: this.graph.order > 1
        ? this.graph.size / (this.graph.order * (this.graph.order - 1))
        : 0
    }
  }
}

module.exports = {
  KnowledgeGraph
}
