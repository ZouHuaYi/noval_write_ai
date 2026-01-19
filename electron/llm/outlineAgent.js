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
  endChapter = null,
  existingEvents = [] // 新增：已有的事件列表
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
- dependencies: 依赖的事件 ID 列表（如果新事件依赖已有事件，使用已有事件的实际 ID）

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

  // 构建已有事件的摘要信息
  let existingEventsContext = ''
  if (existingEvents && existingEvents.length > 0) {
    // 只选择早于起始章节的事件
    const eventsBeforeRange = existingEvents.filter(e => e.chapter < startChapter)

    if (eventsBeforeRange.length > 0) {
      // 找出这些事件所在的章节号，并排序
      const chapterNumbers = [...new Set(eventsBeforeRange.map(e => e.chapter))].sort((a, b) => b - a)

      // 只取最接近起始章节的5个章节
      const relevantChapters = chapterNumbers.slice(0, 5)
      const relevantEvents = eventsBeforeRange.filter(e => relevantChapters.includes(e.chapter))

      if (relevantEvents.length > 0) {
        existingEventsContext = `\n【已有事件】（可以在 dependencies 中引用这些事件的 ID）\n`
        existingEventsContext += `以下是第 ${Math.min(...relevantChapters)} - ${Math.max(...relevantChapters)} 章的事件：\n\n`

        // 按章节分组显示
        relevantChapters.forEach(chapterNum => {
          const chapterEvents = relevantEvents.filter(e => e.chapter === chapterNum)
          if (chapterEvents.length > 0) {
            existingEventsContext += `第${chapterNum}章：\n`
            chapterEvents.forEach(event => {
              existingEventsContext += `  - ID: ${event.id}, 标题: ${event.label}\n`
              if (event.description) {
                existingEventsContext += `    描述: ${event.description.substring(0, 50)}${event.description.length > 50 ? '...' : ''}\n`
              }
            })
          }
        })

        existingEventsContext += `\n提示：如果新生成的事件需要依赖这些已有事件，请在 dependencies 数组中使用它们的实际 ID。\n`
      }
    }
  }

  const userPrompt = `请为以下小说生成事件图谱：

【小说标题】
${novelTitle}

【小说类型】
${genre || '未指定'}

【故事梗概】
${synopsis || '无'}

【现有大纲】
${existingOutline || '无'}
${existingEventsContext}
【目标章节范围】
${rangeLabel}

请生成 ${Math.max(chaptersCount * 2, 6)} 个左右的事件节点，确保：
1. 事件之间有清晰的因果关系（通过 dependencies 表示）
2. 覆盖该章节范围的开端、发展与阶段性收束
3. 角色发展事件与情节事件交织
4. 每个章节有 2-3 个主要事件
5. 如果新事件需要依赖【已有事件】，请使用它们的实际 ID

重要：必须为每个事件填写 chapter，且 chapter 必须在 ${startChapter} 到 ${endChapter ?? (startChapter + chaptersCount - 1)} 的范围内。不能全部是第 1 章。

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

    // 使用时间戳确保事件 ID 唯一
    const timestamp = Date.now()

    // 第一步：创建 ID 映射表（LLM 生成的简单 ID -> 实际唯一 ID）
    const idMapping = new Map()

    const normalizedEvents = Array.isArray(result.events) ? result.events.map((event, index) => {
      const chapterNum = Number(event.chapter)
      // 如果事件已有 ID 且不是简单的 event_N 格式，保留原 ID
      // 否则生成新的唯一 ID
      const hasCustomId = event.id && !event.id.match(/^event_\d+$/)
      const oldId = event.id || `event_${index + 1}`
      const newId = hasCustomId ? event.id : `event_${timestamp}_${index + 1}`

      // 记录 ID 映射关系
      if (oldId !== newId) {
        idMapping.set(oldId, newId)
      }

      return {
        id: newId,
        label: event.label || `事件 ${index + 1}`,
        eventType: event.eventType || 'plot',
        description: event.description || '',
        chapter: Number.isFinite(chapterNum) ? chapterNum : null,
        characters: Array.isArray(event.characters) ? event.characters : [],
        preconditions: Array.isArray(event.preconditions) ? event.preconditions : [],
        postconditions: Array.isArray(event.postconditions) ? event.postconditions : [],
        dependencies: Array.isArray(event.dependencies) ? event.dependencies : []
      }
    }) : []

    // 第二步：更新所有事件的依赖关系，将旧 ID 映射到新 ID
    normalizedEvents.forEach(event => {
      if (event.dependencies && event.dependencies.length > 0) {
        event.dependencies = event.dependencies.map(depId => {
          // 如果依赖 ID 在映射表中，使用新 ID；否则保持原样
          return idMapping.get(depId) || depId
        })
      }
    })

    const rangeStart = startChapter
    const rangeEnd = endChapter != null ? endChapter : Math.max(rangeStart, rangeStart + targetChapters - 1)
    const rangeSize = Math.max(rangeEnd - rangeStart + 1, 1)

    const withinRange = normalizedEvents.filter(event => typeof event.chapter === 'number' && event.chapter >= rangeStart && event.chapter <= rangeEnd)
    const missingChapter = normalizedEvents.filter(event => event.chapter == null || event.chapter < rangeStart || event.chapter > rangeEnd)

    if (withinRange.length === 0 && normalizedEvents.length > 0) {
      normalizedEvents.forEach((event, idx) => {
        event.chapter = rangeStart + (idx % rangeSize)
      })
    } else if (missingChapter.length > 0) {
      missingChapter.forEach((event, idx) => {
        event.chapter = rangeStart + (idx % rangeSize)
      })
    }

    // 确保每个章节至少有 1 个事件
    const chaptersWithEvents = new Set()
    normalizedEvents.forEach(event => {
      if (typeof event.chapter === 'number') {
        chaptersWithEvents.add(event.chapter)
      }
    })

    for (let chapter = rangeStart; chapter <= rangeEnd; chapter += 1) {
      if (!chaptersWithEvents.has(chapter)) {
        normalizedEvents.push({
          id: `event_${normalizedEvents.length + 1}`,
          label: `第 ${chapter} 章事件补充`,
          eventType: 'plot',
          description: '',
          chapter,
          characters: [],
          preconditions: [],
          postconditions: [],
          dependencies: []
        })
      }
    }

    return {
      ...result,
      events: normalizedEvents,
      range: { startChapter: rangeStart, endChapter: rangeEnd }
    }

  } catch (error) {
    console.error('生成事件图谱失败:', error)
    throw error
  }
}

module.exports = {
  generateEventGraph,
  EVENT_TYPES
}