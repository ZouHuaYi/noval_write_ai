/**
 * Outline Agent - 大纲智能代理
 * 负责生成结构化的事件节点 (EventNode) JSON
 */
const llmService = require('./llmService')
const { safeParseJSON } = require('../utils/helpers')
const promptService = require('../prompt/promptService')

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

// 检测事件图谱是否存在明显 AI 任务链味
function detectOutlineAiSmell(events = []) {
  const text = events.map(event => `${event.label || ''}\n${event.description || ''}`).join('\n')
  const mustCount = (text.match(/必须|得|立刻|赶紧/g) || []).length
  const findCount = (text.match(/发现|找到|线索|证据/g) || []).length
  const goCount = (text.match(/前往|赶到|去往|前去|赶去/g) || []).length

  const issues = []
  if (mustCount >= 10) issues.push('推进词过密（必须/得/立刻/赶紧）')
  if (findCount >= 12) issues.push('线索词过密（发现/线索/证据）')
  if (goCount >= 10) issues.push('移动事件过密（前往/赶到）')

  return {
    hasSmell: issues.length > 0,
    issues
  }
}

// 生成章级骨架（ChapterBeats），先定节奏再拆事件
async function generateChapterBeats({
  novelTitle,
  genre,
  synopsis,
  existingOutline,
  knowledgeContext,
  targetChapters = 10,
  startChapter = 1,
  endChapter = null,
  configOverride
}) {
  const { systemPrompt } = promptService.resolvePrompt('outline.chapterBeats.system')

  const rangeStart = startChapter
  const rangeEnd = endChapter != null ? endChapter : (startChapter + targetChapters - 1)
  const rangeLabel = `第 ${rangeStart} 章 - 第 ${rangeEnd} 章`

  const userPrompt = promptService.renderPrompt('outline.chapterBeats.user', '', {
    novelTitle: novelTitle || '未命名',
    genre: genre || '未指定',
    synopsis: synopsis || '无',
    existingOutline: existingOutline || '无',
    knowledgeContext: knowledgeContext || '无',
    rangeLabel,
    rangeStart,
    rangeEnd
  })

  const response = await llmService.callChatModel({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.6,
    maxTokens: 3000,
    configOverride
  })

  let parsed = safeParseJSON(response)
  if (!parsed || !Array.isArray(parsed.chapterBeats)) {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      parsed = safeParseJSON(jsonMatch[0])
    }
  }

  if (!parsed || !Array.isArray(parsed.chapterBeats)) {
    const repaired = await repairChapterBeatsJSON(response, configOverride)
    if (!repaired || !Array.isArray(repaired.chapterBeats)) {
      throw new Error('无法解析 ChapterBeats JSON')
    }
    parsed = repaired
  }

  // 修正章范围（兜底补齐）
  const beatsMap = new Map(parsed.chapterBeats.map(beat => [Number(beat.chapter), beat]))
  const chapterBeats = []
  for (let chapter = rangeStart; chapter <= rangeEnd; chapter += 1) {
    const beat = beatsMap.get(chapter) || {}
    chapterBeats.push({
      chapter,
      purpose: beat.purpose || '',
      turningPoint: beat.turningPoint || '',
      cost: beat.cost || '',
      misconception: beat.misconception || '',
      nextHook: beat.nextHook || ''
    })
  }

  return {
    chapterBeats,
    range: { startChapter: rangeStart, endChapter: rangeEnd }
  }
}

// 基于章级骨架生成事件图谱（EventNodes）
async function generateEventGraphFromBeats({
  novelTitle,
  genre,
  synopsis,
  existingOutline,
  knowledgeContext,
  progressSummary,
  repeatBans,
  emotionArcSummary,
  breathChapters,
  chapterBeats = [],
  existingEvents = [],
  startChapter = 1,
  endChapter = null,
  configOverride
}) {
  const { systemPrompt } = promptService.resolvePrompt('outline.eventGraph.system')

  let existingEventsContext = ''
  if (existingEvents && existingEvents.length) {
    const rangeStart = Number(startChapter)
    if (Number.isFinite(rangeStart)) {
      const eventsBeforeRange = existingEvents.filter(event => event.chapter < rangeStart)
      if (eventsBeforeRange.length > 0) {
        const chapterNumbers = [...new Set(eventsBeforeRange.map(event => event.chapter))].sort((a, b) => b - a)
        const relevantChapters = chapterNumbers.slice(0, 5)
        const relevantEvents = eventsBeforeRange.filter(event => relevantChapters.includes(event.chapter))
        if (relevantEvents.length > 0) {
          existingEventsContext = `【已有事件（可引用 dependencies）】\n`
          existingEventsContext += `以下是第 ${Math.min(...relevantChapters)} - ${Math.max(...relevantChapters)} 章的事件：\n\n`
          relevantChapters.forEach(chapterNum => {
            const chapterEvents = relevantEvents.filter(event => event.chapter === chapterNum)
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
    } else {
      existingEventsContext = `【已有事件（可引用 dependencies）】\n` + existingEvents
        .slice(-20)
        .map(event => `- ${event.id} (第${event.chapter}章): ${event.label}`)
        .join('\n')
    }
  }

  const userPrompt = promptService.renderPrompt('outline.eventGraph.user', '', {
    novelTitle: novelTitle || '未命名',
    genre: genre || '未指定',
    synopsis: synopsis || '无',
    existingOutline: existingOutline || '无',
    knowledgeContext: knowledgeContext || '无',
    emotionArcSummary: emotionArcSummary || '无',
    breathChapters: breathChapters || '无',
    progressSummary: progressSummary || '无',
    repeatBans: repeatBans || '无',
    existingEventsContext: existingEventsContext || '',
    chapterBeatsJson: JSON.stringify(chapterBeats, null, 2)
  })

  const response = await llmService.callChatModel({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.65,
    maxTokens: 8000,
    configOverride
  })

  let result = safeParseJSON(response)
  if (!result || !result.events) {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      result = safeParseJSON(jsonMatch[0])
    }
  }

  if (!result || !Array.isArray(result.events)) {
    const repaired = await repairEventGraphJSON(response, configOverride)
    if (!repaired || !repaired.events) {
      throw new Error('无法解析事件图谱 JSON')
    }
    result = repaired
  }

  return result
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
  knowledgeContext,
  progressSummary,
  repeatBans,
  emotionArcSummary,
  breathChapters,
  configOverride,
  targetChapters = 10,
  startChapter = 1,
  endChapter = null,
  existingEvents = [] // 新增：已有的事件列表
}) {
  const rangeStart = startChapter
  const rangeEnd = endChapter != null ? endChapter : Math.max(rangeStart, rangeStart + targetChapters - 1)
  const rangeLabel = `第 ${rangeStart} 章 - 第 ${rangeEnd} 章`

  console.log(`[事件图谱] ========== 生成事件图谱 ==========`)
  console.log(`[事件图谱] 小说: ${novelTitle}, 章节范围: ${rangeLabel}`)
  console.log(`[事件图谱] 已有事件总数: ${existingEvents?.length || 0}`)

  try {
    // 先生成章级骨架，降低任务链味
    const beatsResult = await generateChapterBeats({
      novelTitle,
      genre,
      synopsis,
      existingOutline,
      knowledgeContext,
      targetChapters,
      startChapter,
      endChapter,
      configOverride
    })

    const chapterBeats = beatsResult.chapterBeats

    // 再根据骨架生成事件图谱
    let result = await generateEventGraphFromBeats({
      novelTitle,
      genre,
      synopsis,
      existingOutline,
      knowledgeContext,
      progressSummary,
      repeatBans,
      emotionArcSummary,
      breathChapters,
      chapterBeats,
      existingEvents,
      startChapter,
      endChapter,
      configOverride
    })

    // 可选：检测 AI 味，必要时重试一次
    const smell = detectOutlineAiSmell(result.events || [])
    if (smell.hasSmell) {
      console.log(`[事件图谱] 检测到 AI 味，重试一次: ${smell.issues.join('；')}`)
      result = await generateEventGraphFromBeats({
        novelTitle,
        genre,
        synopsis,
        existingOutline,
        knowledgeContext: `${knowledgeContext || ''}\n【额外约束】避免推进词复读，避免任务链事件，线索必须付代价。`,
        progressSummary,
        repeatBans,
        emotionArcSummary,
        breathChapters,
        chapterBeats,
        existingEvents,
        startChapter,
        endChapter,
        configOverride
      })
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

      // 生成阶段强制保证 label 非空，避免后续章节标题为空
      const trimmedLabel = typeof event.label === 'string' ? event.label.trim() : ''
      // 为每个事件补充“无关/喘息”描写，保证节奏缓冲
      const baseDesc = typeof event.description === 'string' ? event.description.trim() : ''
      // 随机喘息描写模板池（用于缓冲节奏，避免千篇一律）
      const breathTemplates = [
        '喘息描写：角色处理一件与主线无关的琐事，顺带交代生活质感。',
        '喘息描写：角色短暂停下观察环境细节，氛围形成停顿。',
        '喘息描写：角色与同伴进行轻松对话，缓冲紧张情节。',
        '喘息描写：角色回想一个无关的小片段，带出情感余韵。',
        '喘息描写：角色整理物品或路线，节奏轻轻降速。',
        '喘息描写：角色处理一段日常互动，不推进主线。',
        '喘息描写：角色在等待/移动中留意身边变化，作为过渡。'
      ]
      // 使用事件索引做可复现选择，避免随机导致结果不可复现
      const templateIndex = Math.abs(Number.isFinite(index) ? index : 0) % breathTemplates.length
      const breathDesc = breathTemplates[templateIndex]
      // 兜底：缺失时补齐“目标/行动/代价/误判 + 喘息描写”，保证每个事件可写
      const fallbackDesc = '目标：角色当下想要一个小而明确的结果；行动：做出一个具体动作；代价：付出时间/暴露破绽或消耗资源；误判：以为这个决定不会影响后续。'
      const mergedDesc = baseDesc
        ? (baseDesc.includes('喘息描写') ? baseDesc : `${baseDesc}；${breathDesc}`)
        : `${fallbackDesc}；${breathDesc}`

      return {
        id: newId,
        label: trimmedLabel || `事件 ${index + 1}`,
        eventType: event.eventType || 'plot',
        description: mergedDesc,
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
      chapterBeats,
      range: { startChapter: rangeStart, endChapter: rangeEnd }
    }
  } catch (error) {
    console.error('生成事件图谱失败:', error)
    throw error
  }
}

module.exports = {
  generateEventGraph,
  generateChapterBeats,
  generateEventGraphFromBeats,
  EVENT_TYPES
}

// 修复章级骨架 JSON 输出
async function repairChapterBeatsJSON(rawText, configOverride) {
  if (!rawText) return null
  const { systemPrompt } = promptService.resolvePrompt('outline.repairJson.system')
  const userPrompt = promptService.renderPrompt('outline.repairJson.user', '', {
    rawText
  })
  try {
    const response = await llmService.callChatModel({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      maxTokens: 2000,
      configOverride
    })
    const parsed = safeParseJSON(response)
    if (parsed && Array.isArray(parsed.chapterBeats)) return parsed
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0])
      } catch (error) {
        return null
      }
    }
    return null
  } catch (error) {
    console.error('ChapterBeats JSON 修复失败:', error)
    return null
  }
}

// 修复事件图谱 JSON 输出
async function repairEventGraphJSON(rawText, configOverride) {
  if (!rawText) return null
  const { systemPrompt } = promptService.resolvePrompt('outline.repairJson.system')
  const userPrompt = promptService.renderPrompt('outline.repairJson.user', '', {
    rawText
  })
  try {
    const response = await llmService.callChatModel({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      maxTokens: 2000,
      configOverride
    })
    const parsed = safeParseJSON(response)
    if (parsed && parsed.events) return parsed
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0])
      } catch (error) {
        return null
      }
    }
    return null
  } catch (error) {
    console.error('事件图谱 JSON 修复失败:', error)
    return null
  }
}
