/**
 * Outline Agent - 大纲智能代理
 * 负责生成结构化的事件节点 (EventNode) JSON
 */
const llmService = require('./llmService')
const { safeParseJSON } = require('../utils/helpers')

/**
 * 事件类型定义
 */
const EVENT_TYPES = {
  PLOT: 'plot',           // 情节推进事件
  CHARACTER: 'character', // 角色发展事件
  CONFLICT: 'conflict',   // 冲突事件
  RESOLUTION: 'resolution', // 解决事件
  TRANSITION: 'transition'  // 过渡事件
}

/**
 * 生成事件图谱
 * @param {Object} options
 * @param {string} options.novelTitle - 小说标题
 * @param {string} options.genre - 小说类型
 * @param {string} options.synopsis - 故事梗概
 * @param {string} options.existingOutline - 现有大纲内容
 * @param {number} options.targetChapters - 目标章节数
 * @returns {Promise<{events: Array, graph: Object}>}
 */
async function generateEventGraph({
  novelTitle,
  genre,
  synopsis,
  existingOutline,
  targetChapters = 10,
  startChapter = 1,
  endChapter = null
}) {
  const systemPrompt = `你是一个专业的小说故事架构师，擅长将故事大纲分解为结构化的事件图谱。

你需要分析故事，生成一系列 EventNode（事件节点），每个节点包含：
- id: 唯一标识符 (格式: event_{序号})
- label: 事件标题（简短有力）
- eventType: 事件类型 (plot/character/conflict/resolution/transition)
- description: 事件详细描述
- chapter: 建议所属章节
- characters: 相关角色列表
- preconditions: 前置条件（需要先发生什么）
- postconditions: 后置影响（会导致什么）
- dependencies: 依赖的事件 ID 列表

事件类型说明：
- plot: 情节推进事件（故事核心进展）
- character: 角色发展事件（角色成长、关系变化）
- conflict: 冲突事件（矛盾爆发、对抗）
- resolution: 解决事件（冲突解决、问题克服）
- transition: 过渡事件（场景转换、时间跳跃）

请以 JSON 格式返回，结构如下：
{
  "events": [
    {
      "id": "event_1",
      "label": "...",
      "eventType": "...",
      "description": "...",
      "chapter": 1,
      "characters": ["角色1", "角色2"],
      "preconditions": ["条件1"],
      "postconditions": ["影响1"],
      "dependencies": []
    }
  ],
  "summary": "整体故事结构摘要",
  "mainCharacters": ["主要角色1", "主要角色2"],
  "mainConflicts": ["核心冲突1", "核心冲突2"]
}`

  const rangeLabel = endChapter != null ? `第 ${startChapter} 章 - 第 ${endChapter} 章` : `第 ${startChapter} 章起`
  const chaptersCount = endChapter != null ? Math.max(endChapter - startChapter + 1, 1) : targetChapters

  const userPrompt = `请为以下小说生成事件图谱：

【小说标题】
${novelTitle}

【小说类型】
${genre || '未指定'}

【故事梗概】
${synopsis || '无'}

【现有大纲】
${existingOutline || '无'}

【目标章节范围】
${rangeLabel}

请生成 ${Math.max(chaptersCount * 2, 6)} 个左右的事件节点，确保：
1. 事件之间有清晰的因果关系（通过 dependencies 表示）
2. 覆盖该章节范围的开端、发展与阶段性收束
3. 角色发展事件与情节事件交织
4. 每个章节有 2-3 个主要事件

返回 JSON 格式的事件图谱。`


  try {
    const response = await llmService.callChatModel({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      maxTokens: 8000
    })

    const result = safeParseJSON(response)

    if (!result || !result.events) {
      // 尝试提取 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0])
        } catch (e) {
          throw new Error('无法解析事件图谱 JSON')
        }
      }
      throw new Error('生成的内容不包含有效的事件数据')
    }

    return {
      ...result,
      range: { startChapter, endChapter }
    }

  } catch (error) {
    console.error('生成事件图谱失败:', error)
    throw error
  }
}

/**
 * 从现有章节提取事件节点
 * @param {Object} options
 * @param {Array} options.chapters - 章节列表
 * @param {string} options.novelId - 小说 ID
 * @returns {Promise<Array>}
 */
async function extractEventsFromChapters({ chapters, novelId }) {
  const events = []

  for (const chapter of chapters) {
    if (!chapter.content || chapter.content.length < 100) continue

    const systemPrompt = `你是一个故事分析师，负责从章节内容中提取关键事件。
请以 JSON 数组格式返回提取的事件，每个事件包含：
- label: 事件标题
- eventType: 事件类型
- description: 事件描述
- characters: 相关角色`

    const userPrompt = `请从以下章节内容中提取关键事件：

【章节】第 ${chapter.chapterNumber} 章 - ${chapter.title}

【内容】
${chapter.content.slice(0, 3000)}

请提取 2-4 个关键事件，返回 JSON 数组。`

    try {
      const response = await llmService.callChatModel({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.5,
        maxTokens: 1500
      })

      const chapterEvents = safeParseJSON(response)
      if (Array.isArray(chapterEvents)) {
        chapterEvents.forEach((event, index) => {
          events.push({
            id: `event_${chapter.chapterNumber}_${index + 1}`,
            label: event.label,
            eventType: event.eventType || 'plot',
            description: event.description,
            chapter: chapter.chapterNumber,
            characters: event.characters || [],
            preconditions: [],
            postconditions: [],
            dependencies: []
          })
        })
      }
    } catch (error) {
      console.error(`提取第 ${chapter.chapterNumber} 章事件失败:`, error)
    }
  }

  return events
}

/**
 * 分析事件依赖关系
 * @param {Array} events - 事件列表
 * @returns {Promise<Array>} 带依赖关系的事件列表
 */
async function analyzeEventDependencies(events) {
  if (events.length < 2) return events

  const systemPrompt = `你是一个故事逻辑分析师，负责分析事件之间的因果依赖关系。

对于每个事件，判断它依赖哪些之前的事件（必须先发生）。
只返回有依赖关系的事件及其依赖，格式为：
{
  "dependencies": {
    "event_id": ["dependency_id_1", "dependency_id_2"]
  }
}`

  const eventSummary = events.map(e =>
    `${e.id}: 第${e.chapter}章 - ${e.label} (${e.description?.slice(0, 50)}...)`
  ).join('\n')

  const userPrompt = `请分析以下事件之间的依赖关系：

${eventSummary}

返回 JSON 格式的依赖关系映射。`

  try {
    const response = await llmService.callChatModel({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      maxTokens: 2000
    })

    const result = safeParseJSON(response)

    if (result?.dependencies) {
      events.forEach(event => {
        if (result.dependencies[event.id]) {
          event.dependencies = result.dependencies[event.id]
        }
      })
    }
  } catch (error) {
    console.error('分析事件依赖关系失败:', error)
  }

  return events
}

/**
 * 扩展事件节点
 * 为单个事件生成更详细的内容
 */
async function expandEventNode(event, context = {}) {
  const systemPrompt = `你是一个故事细节专家，负责扩展事件节点的详细内容。

请为事件补充以下信息：
1. 更详细的描述（200-300字）
2. 场景环境描写
3. 角色心理状态
4. 可能的对话提示
5. 这个事件的情感基调

返回 JSON 格式：
{
  "expandedDescription": "详细描述",
  "scene": "场景描写",
  "characterStates": {"角色名": "心理状态"},
  "dialogueHints": ["对话提示1", "对话提示2"],
  "emotionalTone": "情感基调",
  "writingNotes": "写作建议"
}`

  const userPrompt = `请扩展以下事件节点：

【事件】${event.label}
【类型】${event.eventType}
【章节】第 ${event.chapter} 章
【当前描述】${event.description}
【相关角色】${event.characters?.join('、') || '未指定'}

${context.worldview ? `【世界观背景】\n${context.worldview}` : ''}
${context.characterInfo ? `【角色信息】\n${context.characterInfo}` : ''}

请返回 JSON 格式的扩展内容。`

  try {
    const response = await llmService.callChatModel({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      maxTokens: 1500
    })

    return safeParseJSON(response)
  } catch (error) {
    console.error('扩展事件节点失败:', error)
    return null
  }
}

/**
 * 验证事件图谱的一致性
 */
async function validateEventGraph(events) {
  const issues = []

  // 检查 ID 唯一性
  const ids = new Set()
  events.forEach(event => {
    if (ids.has(event.id)) {
      issues.push(`重复的事件 ID: ${event.id}`)
    }
    ids.add(event.id)
  })

  // 检查依赖关系有效性
  events.forEach(event => {
    if (event.dependencies) {
      event.dependencies.forEach(depId => {
        if (!ids.has(depId)) {
          issues.push(`无效的依赖: ${event.id} -> ${depId}`)
        }
      })
    }
  })

  // 检查章节分布
  const chapterCounts = {}
  events.forEach(event => {
    if (event.chapter) {
      chapterCounts[event.chapter] = (chapterCounts[event.chapter] || 0) + 1
    }
  })

  // 检查是否有空白章节
  const chapters = Object.keys(chapterCounts).map(Number).sort((a, b) => a - b)
  if (chapters.length > 1) {
    for (let i = chapters[0]; i <= chapters[chapters.length - 1]; i++) {
      if (!chapterCounts[i]) {
        issues.push(`第 ${i} 章没有事件`)
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    stats: {
      totalEvents: events.length,
      chapterCounts,
      eventTypeCounts: events.reduce((acc, e) => {
        acc[e.eventType] = (acc[e.eventType] || 0) + 1
        return acc
      }, {})
    }
  }
}

module.exports = {
  generateEventGraph,
  extractEventsFromChapters,
  analyzeEventDependencies,
  expandEventNode,
  validateEventGraph,
  EVENT_TYPES
}
