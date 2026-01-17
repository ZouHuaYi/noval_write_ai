/**
 * 自动关系提取器
 * 从章节内容中自动提取实体和关系，更新知识图谱
 */
const llmService = require('../llm/llmService')
const { safeParseJSON } = require('../utils/helpers')

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
async function extractEntities(text, context = {}) {
  const systemPrompt = `你是一个专业的命名实体识别专家，负责从小说文本中提取实体。

请识别以下类型的实体：
1. 角色 (character): 人物、生物、有名字的存在
2. 地点 (location): 地名、场所、区域
3. 物品 (item): 重要道具、武器、物件
4. 组织 (organization): 门派、势力、团体
5. 事件 (event): 重要事件、战斗、仪式
6. 概念 (concept): 武功、法术、重要概念

请以 JSON 数组格式返回，每个实体包含：
{
  "name": "实体名称",
  "type": "character|location|item|organization|event|concept",
  "aliases": ["别名1", "别名2"],
  "description": "简短描述",
  "properties": { "相关属性" }
}

注意：
- 只提取明确提到的实体
- 区分同名但不同的实体
- 记录实体的别名和称号`

  const userPrompt = `请从以下小说片段中提取实体：

${context.existingEntities ? `【已知实体】\n${context.existingEntities.join('、')}\n\n` : ''}

【文本内容】
${text.slice(0, 4000)}

请返回 JSON 数组格式的实体列表。`

  try {
    const response = await llmService.callChatModel({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      maxTokens: 2000
    })

    const entities = safeParseJSON(response)
    return Array.isArray(entities) ? entities : []
  } catch (error) {
    console.error('实体提取失败:', error)
    return []
  }
}

/**
 * 从文本中提取关系
 * @param {string} text - 章节文本
 * @param {Array} entities - 已识别的实体
 * @param {Object} context - 上下文信息
 * @returns {Promise<Array>}
 */
async function extractRelations(text, entities = [], context = {}) {
  if (entities.length < 2) {
    return []
  }

  const entityNames = entities.map(e => e.name).join('、')

  const systemPrompt = `你是一个关系提取专家，负责从文本中识别实体之间的关系。

关系类型包括：
【角色关系】friend(朋友), enemy(敌人), family(亲属), lover(恋人), ally(盟友), rival(对手), master(师傅), student(徒弟)
【位置关系】at(所在), travels_to(前往), lives_in(居住)
【所属关系】has(拥有), owns(所有), belongs_to(属于), member_of(成员)
【行为关系】attacks(攻击), saves(拯救), betrays(背叛), helps(帮助), meets(相遇)
【状态关系】transforms(转变), becomes(成为), dies(死亡)

请以 JSON 数组格式返回关系，每个关系包含：
{
  "source": "源实体名称",
  "target": "目标实体名称", 
  "type": "关系类型",
  "label": "关系描述（如：击败了、成为了朋友）",
  "description": "详细说明",
  "bidirectional": false,
  "confidence": 0.9
}

注意：
- 只提取文本中明确表述的关系
- 区分单向关系和双向关系
- 给出置信度评分`

  const userPrompt = `请从以下文本中提取实体之间的关系：

【已识别实体】
${entityNames}

【文本内容】
${text.slice(0, 4000)}

${context.chapter ? `【章节】第 ${context.chapter} 章` : ''}

请返回 JSON 数组格式的关系列表。`

  try {
    const response = await llmService.callChatModel({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      maxTokens: 2000
    })

    const relations = safeParseJSON(response)
    return Array.isArray(relations) ? relations : []
  } catch (error) {
    console.error('关系提取失败:', error)
    return []
  }
}

/**
 * 提取角色状态变化
 * @param {string} text - 章节文本
 * @param {Array} characters - 角色列表
 * @returns {Promise<Array>}
 */
async function extractStateChanges(text, characters = []) {
  if (characters.length === 0) {
    return []
  }

  const systemPrompt = `你是一个状态变化分析专家，负责从文本中识别角色的重要状态变化。

请识别以下类型的状态变化：
1. 生死状态：死亡、复活、重伤
2. 位置变化：到达新地点、离开、被困
3. 关系变化：结盟、反目、相遇
4. 能力变化：突破、获得能力、失去能力
5. 身份变化：晋升、被驱逐、加入组织

请以 JSON 数组格式返回：
{
  "character": "角色名称",
  "changeType": "状态变化类型",
  "fromState": "原状态（如有）",
  "toState": "新状态",
  "description": "变化描述",
  "significance": "high|medium|low"
}`

  const userPrompt = `请从以下文本中分析角色状态变化：

【关注角色】
${characters.map(c => c.name || c).join('、')}

【文本内容】
${text.slice(0, 4000)}

请返回 JSON 数组格式的状态变化列表。`

  try {
    const response = await llmService.callChatModel({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      maxTokens: 1500
    })

    const changes = safeParseJSON(response)
    return Array.isArray(changes) ? changes : []
  } catch (error) {
    console.error('状态变化提取失败:', error)
    return []
  }
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
      graph.updateNode(id, {
        lastMention: chapter,
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
        lastMention: chapter
      })
    }
  })

  // 2. 添加关系边
  relations.forEach(relation => {
    const sourceId = nodeMapping.get(relation.source) || normalizeEntityId(relation.source)
    const targetId = nodeMapping.get(relation.target) || normalizeEntityId(relation.target)

    // 只有当两个节点都存在时才添加边
    if (graph.getNode(sourceId) && graph.getNode(targetId)) {
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
  })

  // 3. 处理状态变化
  stateChanges?.forEach(change => {
    const charId = nodeMapping.get(change.character) || normalizeEntityId(change.character)
    const node = graph.getNode(charId)

    if (node) {
      const updatedProperties = { ...node.properties }

      switch (change.changeType) {
        case 'death':
          updatedProperties.status = 'dead'
          updatedProperties.deathChapter = chapter
          break
        case 'revival':
          updatedProperties.status = 'alive'
          updatedProperties.revivalChapter = chapter
          break
        case 'injury':
          updatedProperties.condition = 'injured'
          updatedProperties.injuryChapter = chapter
          break
        case 'breakthrough':
          updatedProperties.powerLevel = change.toState
          updatedProperties.breakthroughChapter = chapter
          break
        default:
          updatedProperties[change.changeType] = change.toState
      }

      graph.updateNode(charId, { properties: updatedProperties })
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

  // 获取现有实体作为上下文
  const existingEntities = graph.getAllNodes().map(n => n.label)
  const existingCharacters = graph.getAllNodes('character')

  // 1. 提取实体
  result.entities = await extractEntities(text, {
    existingEntities,
    chapter
  })

  // 2. 提取关系
  if (result.entities.length > 0) {
    result.relations = await extractRelations(text, result.entities, { chapter })
  }

  // 3. 提取状态变化
  const characters = [
    ...result.entities.filter(e => e.type === 'character'),
    ...existingCharacters
  ]
  if (characters.length > 0) {
    result.stateChanges = await extractStateChanges(text, characters)
  }

  // 4. 更新图谱
  if (options.updateGraph !== false) {
    result.graphUpdates = updateGraphWithExtraction(graph, result, chapter)
  }

  // 5. 检测冲突
  result.conflicts = graph.detectConflicts()

  return result
}

/**
 * 增量更新 - 只分析新增内容
 */
async function incrementalUpdate(newText, previousText, graph, chapter) {
  // 简单实现：比较新旧文本，只处理差异部分
  const newPart = newText.slice(previousText.length)

  if (newPart.length < 50) {
    return null // 内容太少，跳过
  }

  return analyzeChapter(newPart, graph, chapter, { updateGraph: true })
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
