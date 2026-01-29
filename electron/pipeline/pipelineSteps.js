const outlineAgent = require('../llm/outlineAgent')
const planningAgent = require('../llm/planningAgent')
const chapterGenerator = require('../llm/chapterGenerator')
const worldviewService = require('../worldviewService')
const planningDAO = require('../database/planningDAO')
const chapterDAO = require('../database/chapterDAO')
const novelDAO = require('../database/novelDAO')
const { safeParseJSON } = require('../utils/helpers')
const { buildKnowledgeSummary } = require('../llm/knowledgeContext')
const llmService = require('../llm/llmService')
const { getGraphManager } = require('../graph/graphManager')
const promptService = require('../prompt/promptService')

// 章节生成默认系统提示
const DEFAULT_CHAPTER_SYSTEM_PROMPT = '你是小说写作助手，只负责产出草稿式正文。保持原文叙事视角与文风，语言精炼克制，避免赘述与空泛描写，不重复已有内容，不输出标题或说明，只输出章节正文。禁止比喻与情绪直给，允许出现未说完的话与轻微误判，避免模板句与时间戳化表达。'

// 解析分析结果并补全默认值（优先保留用户设置）
function normalizeAnalysis(result, fallback = {}) {
  // 以用户设置为准：只在未填写时使用模型建议
  const pickNumber = (userValue, modelValue, defaultValue) => {
    const userNumber = Number(userValue)
    if (Number.isFinite(userNumber) && userNumber > 0) return userNumber
    const modelNumber = Number(modelValue)
    if (Number.isFinite(modelNumber) && modelNumber > 0) return modelNumber
    return defaultValue
  }

  return {
    synopsis: result?.synopsis || fallback.synopsis || '',
    targetChapters: pickNumber(fallback.targetChapters, result?.targetChapters, 10),
    // 默认每章目标字数上调到 1800，避免低字数误导后续计划
    wordsPerChapter: pickNumber(fallback.wordsPerChapter, result?.wordsPerChapter, 1800),
    pacing: result?.pacing || fallback.pacing || 'medium',
    eventBatchSize: pickNumber(fallback.eventBatchSize, result?.eventBatchSize, 5),
    chapterBatchSize: pickNumber(fallback.chapterBatchSize, result?.chapterBatchSize, 2),
    notes: result?.notes || ''
  }
}

// 合并事件（保持既有事件信息）
function mergeEvents(existingEvents = [], newEvents = []) {
  const merged = [...existingEvents]
  const existingMap = new Map(existingEvents.map(event => [event.id, event]))

  newEvents.forEach(event => {
    if (event.id && existingMap.has(event.id)) {
      const existing = existingMap.get(event.id)
      if (event.description && event.description !== existing.description) {
        existing.description = event.description
      }
      if (event.chapter != null) {
        existing.chapter = event.chapter
      }
      if (event.eventType) {
        existing.eventType = event.eventType
      }
      if (Array.isArray(event.characters) && event.characters.length) {
        existing.characters = Array.from(new Set([...(existing.characters || []), ...event.characters]))
      }
      if (Array.isArray(event.dependencies) && event.dependencies.length) {
        existing.dependencies = Array.from(new Set([...(existing.dependencies || []), ...event.dependencies]))
      }
      return
    }
    merged.push(event)
    if (event.id) {
      existingMap.set(event.id, event)
    }
  })

  return merged
}

async function resolvePipelineConfig(settings = {}, stage = 'default') {
  try {
    const allConfigs = await llmService.getAllLLMConfigs()
    
    const stageKeyMap = {
      analyze: 'analysisModelConfigId',
      events_batch: 'eventModelConfigId',
      plan: 'planModelConfigId',
      chapter_batch: 'chapterModelConfigId',
      review: 'reviewModelConfigId'
    }
    const stageKey = stageKeyMap[stage]
    let selectedId = (stageKey && settings[stageKey]) || settings.modelConfigId
    // 分析评估默认跟随事件生成模型，避免走系统默认
    if (stage === 'analyze' && !selectedId && settings.eventModelConfigId) {
      selectedId = settings.eventModelConfigId
    }
    if (!selectedId) return null
    return allConfigs.find(cfg => cfg.id === selectedId) || null
  } catch (error) {
    console.error('解析流水线模型配置失败:', error)
    return null
  }
}

// 分析评估输入
async function analyzeInput({ novelId, inputWorldview, inputRules, inputOutline, settings, configOverride }) {
  const novel = novelDAO.getNovelById(novelId)
  const { systemPrompt } = promptService.resolvePrompt('pipeline.analyzeInput.system')
  const userPrompt = promptService.renderPrompt('pipeline.analyzeInput.user', '', {
    novelTitle: novel?.title || '未命名',
    inputWorldview: inputWorldview || '无',
    inputRules: inputRules || '无',
    inputOutline: inputOutline || '无'
  })

  const response = await llmService.callChatModel({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.4,
    maxTokens: 1200,
    configOverride
  })

  const parsed = safeParseJSON(response)
  return normalizeAnalysis(parsed || {}, settings || {})
}

// 生成事件批次
async function generateEventBatch({
  novelId,
  startChapter,
  endChapter,
  targetChapters,
  inputOutline,
  configOverride
}) {
  const novel = novelDAO.getNovelById(novelId)
  const existingEvents = planningDAO.listPlanningEvents(novelId)
  // 构建知识图谱摘要，用于事件生成上下文
  const knowledgeContext = buildKnowledgeSummary({
    novelId,
    types: ['character', 'location', 'item', 'organization'],
    maxItems: 12,
    maxChars: 1200
  })

  const result = await outlineAgent.generateEventGraph({
    novelTitle: novel?.title || '未命名',
    genre: novel?.genre || '',
    synopsis: novel?.description || '',
    existingOutline: inputOutline || '',
    knowledgeContext,
    configOverride,
    targetChapters: targetChapters,
    startChapter,
    endChapter,
    existingEvents
  })

  // 保存章级骨架，供规划摘要与正文生成使用
  if (Array.isArray(result?.chapterBeats)) {
    const currentMeta = planningDAO.getPlanningMeta(novelId) || {}
    planningDAO.upsertPlanningMeta(novelId, {
      ...currentMeta,
      chapterBeats: result.chapterBeats
    })
    console.log(`[pipeline:generateEventBatch] 已保存章级骨架: ${result.chapterBeats.length} 条, novelId=${novelId}`)
  }

  const merged = mergeEvents(existingEvents, result?.events || [])
  planningDAO.upsertPlanningEvents(novelId, merged)

  return {
    range: { startChapter, endChapter },
    addedEvents: (result?.events || []).length,
    totalEvents: merged.length
  }
}

// 生成章节计划
async function generatePlan({ novelId, settings, startChapter, endChapter, configOverride }) {
  const events = planningDAO.listPlanningEvents(novelId) || []
  const targetChapters = Number(settings?.targetChapters) || 10
  // 章节计划字数默认上调到 1800
  const wordsPerChapter = Number(settings?.wordsPerChapter) || 1800
  const rangeStart = Number(startChapter) || 1
  const rangeEnd = Number(endChapter) || targetChapters

  // 只规划当前范围内的事件
  const rangeEvents = events.filter(event => {
    const chapter = Number(event.chapter)
    return Number.isFinite(chapter) && chapter >= rangeStart && chapter <= rangeEnd
  })

  const result = await planningAgent.generateChapterPlan({
    events: rangeEvents,
    targetChapters,
    wordsPerChapter,
    pacing: settings?.pacing || 'medium',
    startChapter: rangeStart,
    endChapter: rangeEnd,
    mode: 'pipeline',
    configOverride
  })

  planningDAO.upsertPlanningChapters(novelId, result.chapters || [])
  // 仅更新元信息，不干扰其它章节范围
  planningDAO.upsertPlanningMeta(novelId, {
    synopsis: settings?.synopsis || null,
    targetChapters,
    wordsPerChapter,
    lockWritingTarget: false
  })

  return {
    chaptersCount: result.chapters?.length || 0,
    summary: result.summary || null
  }
}

// 生成章节批次
async function generateChapterBatch({ novelId, chapterNumbers, systemPrompt, configOverride, reviewConfigOverride }) {
  console.log(`[章节批次] 开始生成, novelId: ${novelId}, 章节: [${chapterNumbers.join(', ')}]`)
  
  const novel = novelDAO.getNovelById(novelId)
  console.log(`[章节批次] 小说信息: ${novel?.title || '未找到'}`)
  
  const meta = planningDAO.getPlanningMeta(novelId)
  console.log(`[章节批次] 规划元数据:`, meta ? { targetChapters: meta.targetChapters, wordsPerChapter: meta.wordsPerChapter } : '无')
  
  const chapters = planningDAO.listPlanningChapters(novelId)
  console.log(`[章节批次] 规划章节总数: ${chapters.length}`)

  const completed = []
  for (const chapterNumber of chapterNumbers) {
    // 确保 chapterNumber 是数值类型
    const numChapterNumber = Number(chapterNumber)
    console.log(`\n[章节批次] ========== 处理第 ${numChapterNumber} 章 ==========`)
    
    const plan = chapters.find(ch => ch.chapterNumber === numChapterNumber)
    if (!plan) {
      console.warn(`[章节批次] ⚠️ 第 ${numChapterNumber} 章没有找到规划，跳过`)
      continue
    }
    console.log(`[章节批次] 找到规划: ${plan.title}, 目标字数: ${plan.targetWords}`)

    // 查询时也使用数值类型
    let chapter = chapterDAO.getChapterByNovelAndNumber(novelId, numChapterNumber)
    console.log(`[章节批次] 查询结果:`, chapter ? `找到章节 ID=${chapter.id}` : '未找到')
    
    if (!chapter) {
      console.log(`[章节批次] 章节不存在，创建新章节...`)
      console.log(`[章节批次] novelId=${novelId}, chapterNumber=${numChapterNumber} (类型: ${typeof numChapterNumber})`)
      
      try {
        const createdId = chapterDAO.createChapter(novelId, {
          title: plan.title || `第 ${numChapterNumber} 章`,
          chapterNumber: numChapterNumber,
          status: 'writing',
          content: ''
        })
        chapter = chapterDAO.getChapterById(createdId)
        console.log(`[章节批次] 新章节已创建, ID: ${createdId}`)
      } catch (createError) {
        // 如果是唯一约束错误，尝试重新查询（可能是并发问题）
        if (createError.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          console.warn(`[章节批次] 创建时发生唯一约束冲突，尝试重新查询...`)
          chapter = chapterDAO.getChapterByNovelAndNumber(novelId, numChapterNumber)
          if (chapter) {
            console.log(`[章节批次] 重新查询成功, ID: ${chapter.id}`)
          } else {
            // 如果还是找不到，列出该小说的所有章节以便调试
            const allChapters = chapterDAO.getChaptersByNovel(novelId)
            console.error(`[章节批次] 该小说所有章节:`, allChapters.map(c => ({ id: c.id, num: c.chapterNumber })))
            throw createError
          }
        } else {
          throw createError
        }
      }
    } else {
      console.log(`[章节批次] 使用已有章节, ID: ${chapter.id}`)
      chapterDAO.updateChapter(chapter.id, { status: 'writing' })
    }

    // 更新规划状态为进行中
    planningDAO.upsertPlanningChapters(novelId, [{
      ...plan,
      status: 'in_progress'
    }])

    // 章节生成目标字数默认上调到 1800
    const targetWords = plan.targetWords || meta?.wordsPerChapter || 1800
    console.log(`[章节批次] 开始生成内容, 目标字数: ${targetWords}`)

    try {
    const resolved = promptService.resolvePrompt('chapter.generator.system', { systemPrompt: systemPrompt || DEFAULT_CHAPTER_SYSTEM_PROMPT })
    const finalSystemPrompt = resolved.systemPrompt || systemPrompt || DEFAULT_CHAPTER_SYSTEM_PROMPT
    const generationResult = await chapterGenerator.generateChapterChunks({
      novelId,
      chapterId: chapter.id,
      novelTitle: novel?.title || '未命名',
      extraPrompt: '',
      systemPrompt: finalSystemPrompt,
      targetWords,
      configOverride,
      modelSource: 'pipeline'
    })

    // 章节生成后进行反 AI 清洗（仅流水线使用）
    await chapterGenerator.applyAntiAiPolish({
      novelId,
      chapterId: chapter.id,
      content: generationResult?.chapter?.content || '',
      configOverride: reviewConfigOverride || configOverride
    })
      console.log(`[章节批次] ✅ 第 ${chapterNumber} 章生成成功`)
    } catch (error) {
      console.error(`[章节批次] ❌ 第 ${chapterNumber} 章生成失败:`, error)
      console.error(`[章节批次] 错误详情:`, error.stack || error.message)
      throw error // 重新抛出错误以便上层处理
    }

    // 生成完成后更新状态
    chapterDAO.updateChapter(chapter.id, { status: 'completed' })
    planningDAO.upsertPlanningChapters(novelId, [{
      ...plan,
      status: 'completed'
    }])

    completed.push(chapterNumber)
    console.log(`[章节批次] 第 ${chapterNumber} 章状态已更新为 completed`)
  }

  console.log(`[章节批次] 批次完成, 成功生成章节: [${completed.join(', ')}]`)
  return {
    chapters: completed
  }
}

// 图谱同步与统计
async function syncGraph({ novelId }) {
  const manager = getGraphManager()
  const graph = manager.exportForVisualization(novelId)
  return {
    nodeCount: graph?.nodes?.length || 0,
    edgeCount: graph?.edges?.length || 0
  }
}

// 同步保存世界观与规则
function persistWorldview({ novelId, inputWorldview, inputRules }) {
  if (!inputWorldview && !inputRules) return null
  return worldviewService.saveWorldview(novelId, {
    worldview: inputWorldview || '',
    rules: inputRules || ''
  })
}

module.exports = {
  resolvePipelineConfig,
  analyzeInput,
  generateEventBatch,
  generatePlan,
  generateChapterBatch,
  syncGraph,
  persistWorldview,
  DEFAULT_CHAPTER_SYSTEM_PROMPT
}
