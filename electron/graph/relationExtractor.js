/**
 * 自动关系提取器
 * 从章节内容中自动提取实体和关系，更新知识图谱
 */
const llmService = require('../llm/llmService')
const { safeParseJSON } = require('../utils/helpers')
const promptService = require('../prompt/promptService')

/**
 * 实体类型映射
 */
const ENTITY_TYPES = {
  CHARACTER: 'character',
  LOCATION: 'location',
  ITEM: 'item',
  ORGANIZATION: 'organization',
  EVENT: 'event',
  CONCEPT: 'concept'
}

/**
 * 关系类型映射
 */
const RELATION_TYPES = {
  // 角色关系
  FRIEND: 'friend',
  ENEMY: 'enemy',
  FAMILY: 'family',
  LOVER: 'lover',
  ALLY: 'ally',
  RIVAL: 'rival',
  MASTER: 'master',
  STUDENT: 'student',
  COLLEAGUE: 'colleague',

  // 位置关系
  AT: 'at',
  TRAVELS_TO: 'travels_to',
  LIVES_IN: 'lives_in',

  // 所属关系
  HAS: 'has',
  OWNS: 'owns',
  BELONGS_TO: 'belongs_to',
  MEMBER_OF: 'member_of',

  // 行为关系
  ATTACKS: 'attacks',
  SAVES: 'saves',
  BETRAYS: 'betrays',
  HELPS: 'helps',
  MEETS: 'meets',

  // 状态关系
  TRANSFORMS: 'transforms',
  BECOMES: 'becomes',
  DIES: 'dies'
}

/**
 * 从文本中提取实体
 * @param {string} text - 章节文本
 * @param {Object} context - 上下文信息
 * @returns {Promise<Array>}
 */
async function extractEntities(text, context = {}, configOverride) {
  const { systemPrompt } = promptService.resolvePrompt('graph.extractEntities.system')
  const existingEntitiesBlock = context.existingEntities
    ? `【已知实体】\n${context.existingEntities.join('、')}\n\n`
    : ''
  const userPrompt = promptService.renderPrompt('graph.extractEntities.user', '', {
    existingEntitiesBlock,
    content: text.slice(0, 4000)
  })

  // 若 LLM 调用失败，直接抛出错误，避免误判为“已分析完成”
  const response = await llmService.callChatModel({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3,
    maxTokens: 4000,
    configOverride
  })

  const entities = safeParseJSON(response)
  return Array.isArray(entities) ? entities : []
}

/**
 * 从文本中提取关系
 * @param {string} text - 章节文本
 * @param {Array} entities - 已识别的实体
 * @param {Object} context - 上下文信息
 * @returns {Promise<Array>}
 */
async function extractRelations(text, entities = [], context = {}, configOverride) {
  if (entities.length < 2) {
    return []
  }

  const entityNames = entities.map(e => e.name).join('、')

  const { systemPrompt } = promptService.resolvePrompt('graph.extractRelations.system')
  const chapterBlock = context.chapter ? `【章节】第 ${context.chapter} 章` : ''
  const userPrompt = promptService.renderPrompt('graph.extractRelations.user', '', {
    entityNames,
    content: text.slice(0, 4000),
    chapterBlock
  })

  // 若 LLM 调用失败，直接抛出错误，交由上层统一处理
  const response = await llmService.callChatModel({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3,
    maxTokens: 2000,
    configOverride
  })

  const relations = safeParseJSON(response)
  return Array.isArray(relations) ? relations : []
}

/**
 * 提取实体状态变化 (角色、物品、地点)
 * @param {string} text - 章节文本
 * @param {Array} entities - 相关实体列表
 * @returns {Promise<Array>}
 */
async function extractStateChanges(text, entities = [], configOverride) {
  if (entities.length === 0) {
    return []
  }

  // 过滤出支持状态变化的实体类型
  const candidates = entities.filter(e => 
    ['character', 'item', 'location'].includes(e.type || e.data?.type)
  )

  if (candidates.length === 0) return []

  const names = candidates.map(c => {
    const name = c.name || c.label || c
    const type = c.type || c.data?.type || 'unknown'
    return `${name}(${type})`
  }).slice(0, 50) // 限制数量防止 Prompt 过长

  const { systemPrompt } = promptService.resolvePrompt('graph.extractStateChanges.system')
  const userPrompt = promptService.renderPrompt('graph.extractStateChanges.user', '', {
    candidateNames: names.join('、'),
    content: text.slice(0, 4000)
  })

  // 若 LLM 调用失败，直接抛出错误，避免记录错误的分析状态
  const response = await llmService.callChatModel({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3,
    maxTokens: 1500,
    configOverride
  })

  const changes = safeParseJSON(response)
  return Array.isArray(changes) ? changes : []
}

/**
 * 更新知识图谱
 * @param {KnowledgeGraph} graph - 知识图谱实例
 * @param {Object} extraction - 提取结果
 * @param {number} chapter - 章节号
 */
function updateGraphWithExtraction(graph, extraction, chapter) {
  const { entities, relations, stateChanges } = extraction
  const nodeMapping = new Map() // 名称到 ID 的映射

  // 1. 添加/更新实体节点
  entities.forEach(entity => {
    const id = normalizeEntityId(entity.name)
    nodeMapping.set(entity.name, id)

    // 检查是否是别名
    entity.aliases?.forEach(alias => {
      nodeMapping.set(alias, id)
    })

    const existingNode = graph.getNode(id)
    if (existingNode) {
      // 更新现有节点
      const mentionedChapters = existingNode.mentionedInChapters || []
      if (!mentionedChapters.includes(chapter)) {
        mentionedChapters.push(chapter)
      }

      graph.updateNode(id, {
        lastMention: chapter,
        mentionedInChapters: mentionedChapters,
        aliases: [...new Set([...(existingNode.aliases || []), ...(entity.aliases || [])])],
        properties: {
          ...existingNode.properties,
          ...entity.properties
        }
      })
    } else {
      // 添加新节点
      graph.addNode(id, {
        type: entity.type,
        label: entity.name,
        description: entity.description,
        aliases: entity.aliases || [],
        properties: entity.properties || {},
        firstMention: chapter,
        lastMention: chapter,
        mentionedInChapters: [chapter]
      })
    }
  })


  // 2. 添加关系边
  relations.forEach(relation => {
    // 检查 source 和 target 是否存在
    if (!relation.source || !relation.target) {
      console.warn('跳过无效关系:', relation)
      return
    }

    const sourceId = nodeMapping.get(relation.source) || normalizeEntityId(relation.source)
    const targetId = nodeMapping.get(relation.target) || normalizeEntityId(relation.target)

    // 只有当两个节点都存在时才添加边
    if (graph.getNode(sourceId) && graph.getNode(targetId)) {
      // 检查是否已存在相同类型的关系
      const existingEdges = graph.getEdgesBetween(sourceId, targetId)
      const sameTypeEdge = existingEdges.find(e => e.type === relation.type)

      if (sameTypeEdge) {
        // 如果已存在相同类型的关系,更新它而不是重复添加
        graph.updateEdge(sameTypeEdge.id, {
          label: relation.label,
          description: relation.description,
          chapter: chapter,
          confidence: Math.max(sameTypeEdge.confidence || 0, relation.confidence || 0.8)
        })
      } else {
        // 验证关系是否冲突
        const validation = graph.validateNewRelation(sourceId, targetId, relation.type, chapter)

        if (validation.valid) {
          graph.addEdge(sourceId, targetId, {
            type: relation.type,
            label: relation.label,
            description: relation.description,
            chapter: chapter,
            confidence: relation.confidence || 0.8,
            bidirectional: relation.bidirectional || false
          })
        } else {
          console.warn(`跳过冲突关系: ${relation.source} -> ${relation.target}`, validation.issues)
        }
      }
    }
  })

  // 3. 处理状态变化
  stateChanges?.forEach(change => {
    // 兼容 entity 或 character 字段
    const entityName = change.entity || change.character
    if (!entityName) return

    const nodeId = nodeMapping.get(entityName) || normalizeEntityId(entityName)
    const node = graph.getNode(nodeId)

    if (node) {
      const updatedProperties = { ...node.properties }

      // 记录最后一次状态变化的章节
      updatedProperties.lastStateChangeChapter = chapter

      switch (change.changeType) {
        case 'death': // 兼容旧格式
        case 'status':
          // 处理生/死/销毁/损坏
          if (['dead', 'destroyed', 'broken', 'lost'].includes(change.toState)) {
             updatedProperties.status = change.toState // 统一为状态字段
          } else {
             updatedProperties.status = change.toState
          }
          break
        case 'condition':
          // 处理受伤/中毒等
          updatedProperties.condition = change.toState
          break
        case 'power':
        case 'breakthrough': // 兼容旧格式
          updatedProperties.powerLevel = change.toState
          break
        case 'location':
          // 位置通常作为关系，但也可以作为属性备份
          updatedProperties.currentLocation = change.toState
          break
        case 'possession':
          // 归属权变化
          updatedProperties.owner = change.toState
          break
        default:
          // 其他通用属性更新
          updatedProperties[change.changeType] = change.toState
      }

      graph.updateNode(nodeId, { properties: updatedProperties })
    }
  })

  return {
    nodesAdded: entities.length,
    edgesAdded: relations.length,
    stateChangesApplied: stateChanges?.length || 0
  }
}

/**
 * 规范化实体 ID
 */
function normalizeEntityId(name) {
  if (!name || typeof name !== 'string') {
    console.warn('无效的实体名称:', name)
    return 'unknown_' + Date.now()
  }
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w\u4e00-\u9fa5]/g, '')
}

/**
 * 完整的章节分析流程
 * @param {string} text - 章节文本
 * @param {KnowledgeGraph} graph - 知识图谱
 * @param {number} chapter - 章节号
 * @param {Object} options - 选项
 */
async function analyzeChapter(text, graph, chapter, options = {}) {
  const result = {
    entities: [],
    relations: [],
    stateChanges: [],
    graphUpdates: null,
    conflicts: []
  }

  try {
                                                                                                                                                                                                                            // 使用外部传入的模型配置（如风格审查模型）
    const configOverride = options?.configOverride
    // 获取现有实体作为上下文
    const existingEntities = graph.getAllNodes().map(n => n.label)
    const existingCharacters = graph.getAllNodes('character')

    // 1. 提取实体
    result.entities = await extractEntities(text, {
      existingEntities,
      chapter
    }, configOverride)

    // 2. 提取关系
    if (result.entities.length > 0) {
      result.relations = await extractRelations(text, result.entities, { chapter }, configOverride)
    }

    // 3. 提取状态变化
    const candidateTypes = ['character', 'item', 'location']
    const existingNodes = []
    candidateTypes.forEach(type => {
        existingNodes.push(...graph.getAllNodes(type))
    })
    
    const candidates = [
      ...result.entities.filter(e => candidateTypes.includes(e.type)),
      ...existingNodes
    ]

    if (candidates.length > 0) {
      result.stateChanges = await extractStateChanges(text, candidates, configOverride)
    }

    // 4. 更新图谱
    if (options.updateGraph !== false) {
      result.graphUpdates = updateGraphWithExtraction(graph, result, chapter)
    }

    // 5. 检测冲突
    result.conflicts = graph.detectConflicts()

    return result
  } catch (error) {
    // 统一向上抛出，避免错误时仍被当作已分析
    console.error('章节分析失败:', error)
    throw error
  }
}

/**
 * 增量更新 - 只分析新增内容
 */
async function incrementalUpdate(newText, previousText, graph, chapter, options = {}) {
  // 简单实现：比较新旧文本，只处理差异部分
  const newPart = newText.slice(previousText.length)

  if (newPart.length < 50) {
    return null // 内容太少，跳过
  }

  return analyzeChapter(newPart, graph, chapter, { updateGraph: true, configOverride: options?.configOverride })
}

module.exports = {
  extractEntities,
  extractRelations,
  extractStateChanges,
  updateGraphWithExtraction,
  analyzeChapter,
  incrementalUpdate,
  normalizeEntityId,
  ENTITY_TYPES,
  RELATION_TYPES
}
