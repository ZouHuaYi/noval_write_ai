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
// 控制流水线日志详细程度（默认只输出关键日志）
const PIPELINE_VERBOSE = process.env.PIPELINE_VERBOSE === '1'

function logVerbose(...args) {
  if (PIPELINE_VERBOSE) {
    console.log(...args)
  }
}

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

// 简单文本标准化
function normalizeText(value = '') {
  return String(value)
    .replace(/\s+/g, '')
    .replace(/[^\w\u4e00-\u9fa5]/g, '')
    .toLowerCase()
}

// 生成字符 n-gram（用于相似度判定）
function buildNgrams(text, n = 2) {
  const normalized = normalizeText(text)
  if (!normalized) return new Set()
  if (normalized.length <= n) return new Set([normalized])
  const grams = new Set()
  for (let i = 0; i <= normalized.length - n; i += 1) {
    grams.add(normalized.slice(i, i + n))
  }
  return grams
}

function calcJaccard(a, b) {
  if (!a.size && !b.size) return 0
  let intersection = 0
  a.forEach(item => {
    if (b.has(item)) intersection += 1
  })
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

function calcIntersectionSize(a, b) {
  if (!a.size || !b.size) return 0
  let intersection = 0
  a.forEach(item => {
    if (b.has(item)) intersection += 1
  })
  return intersection
}

function buildProgressSummary({ novelId, existingEvents = [], startChapter }) {
  const chapters = chapterDAO.getChaptersByNovel(novelId) || []
  const cutoff = Number(startChapter) > 1 ? Number(startChapter) - 1 : null
  const doneChapters = cutoff
    ? chapters.filter(ch => Number(ch.chapterNumber) <= cutoff)
    : chapters

  const sortedChapters = [...doneChapters].sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0))
  const recentChapters = sortedChapters.slice(-5)

  const historicalEvents = cutoff
    ? existingEvents.filter(evt => Number(evt.chapter) <= cutoff)
    : existingEvents
  const coreEvents = historicalEvents
    .filter(evt => evt.label || evt.description)
    .slice(-12)
    .map(evt => `- 第${evt.chapter || '?'}章 ${evt.label || '未命名'}：${(evt.description || '').slice(0, 40)}`)
    .join('\n')

  const conflictEvents = historicalEvents.filter(evt => evt.eventType === 'conflict')
  const resolutionEvents = historicalEvents.filter(evt => evt.eventType === 'resolution')

  const recentChapterLabels = recentChapters.length
    ? recentChapters.map(ch => `- 第${ch.chapterNumber}章：${ch.title || '未命名'}`).join('\n')
    : '无'

  return [
    `【已写关键事件】\n${coreEvents || '无'}`,
    `【已出现冲突】\n${conflictEvents.slice(-6).map(evt => `- ${evt.label || evt.id}`).join('\n') || '无'}`,
    `【已解决事件】\n${resolutionEvents.slice(-6).map(evt => `- ${evt.label || evt.id}`).join('\n') || '无'}`,
    `【最近章节】\n${recentChapterLabels}`
  ].join('\n')
}

function buildRepeatBans(existingEvents = []) {
  const recent = existingEvents.slice(-12)
  if (!recent.length) return '无'
  const labels = recent
    .map(evt => evt.label || '')
    .filter(Boolean)
    .slice(0, 8)
  return labels.length ? `避免重复以下事件模式：\n${labels.map((label, idx) => `${idx + 1}. ${label}`).join('\n')}` : '无'
}

function checkEventRepeat({ existingEvents = [], newEvents = [], threshold = 0.48 }) {
  const recentEvents = existingEvents.slice(-60)
  if (!recentEvents.length || !newEvents.length) {
    return { hasRepeat: false, maxScore: 0, repeatedPairs: [] }
  }

  const repeatedPairs = []
  let maxScore = 0

  newEvents.forEach(newEvt => {
    const newText = `${newEvt.label || ''}${newEvt.description || ''}`
    const newGrams = buildNgrams(newText, 2)
    let best = { score: 0, target: null }
    recentEvents.forEach(oldEvt => {
      const oldText = `${oldEvt.label || ''}${oldEvt.description || ''}`
      const oldGrams = buildNgrams(oldText, 2)
      const score = calcJaccard(newGrams, oldGrams)
      if (score > best.score) {
        best = { score, target: oldEvt }
      }
    })
    if (best.score >= threshold && best.target) {
      repeatedPairs.push({
        newLabel: newEvt.label || '未命名',
        oldLabel: best.target.label || '未命名',
        score: Number(best.score.toFixed(2))
      })
      if (best.score > maxScore) maxScore = best.score
    }
  })

  return {
    hasRepeat: repeatedPairs.length > 0,
    maxScore: Number(maxScore.toFixed(2)),
    repeatedPairs
  }
}

// 正文推进度检查（对比最近章节相似度与新信息比例）
function checkChapterProgress({ novelId, chapterNumber, content, recentCount = 5 }) {
  if (!content) {
    return { shouldRetry: false, maxSimilarity: 0, novelty: 1, compared: [] }
  }

  const chapters = chapterDAO.getChaptersByNovel(novelId) || []
  const history = chapters
    .filter(ch => Number(ch.chapterNumber) < Number(chapterNumber) && ch.content)
    .sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0))

  const recent = history.slice(-recentCount)
  if (!recent.length) {
    return { shouldRetry: false, maxSimilarity: 0, novelty: 1, compared: [] }
  }

  const currentGrams = buildNgrams(content, 2)
  const historyUnion = new Set()
  let maxSimilarity = 0
  const compared = []

  recent.forEach(ch => {
    const grams = buildNgrams(ch.content || '', 2)
    grams.forEach(g => historyUnion.add(g))
    const similarity = calcJaccard(currentGrams, grams)
    if (similarity > maxSimilarity) maxSimilarity = similarity
    compared.push({ chapter: ch.chapterNumber, similarity: Number(similarity.toFixed(2)) })
  })

  const intersectionSize = calcIntersectionSize(currentGrams, historyUnion)
  const novelty = currentGrams.size > 0 ? 1 - (intersectionSize / currentGrams.size) : 1

  const shouldRetry = maxSimilarity >= 0.38 || novelty < 0.35

  return {
    shouldRetry,
    maxSimilarity: Number(maxSimilarity.toFixed(2)),
    novelty: Number(novelty.toFixed(2)),
    compared
  }
}

// 快速风格风险检测（命中才触发 AI 清洗）
function shouldReviewChapterStyle(content = '') {
  if (!content || content.length < 800) return false
  const suspiciousPatterns = [
    /场景\d+/,
    /小结|总结|提纲|要点/,
    /一、|二、|三、|四、/
  ]
  if (suspiciousPatterns.some(pattern => pattern.test(content))) return true
  const mustCount = (content.match(/他必须|她必须|必须/g) || []).length
  const summaryCount = (content.match(/因此|总之|于是/g) || []).length
  return mustCount >= 3 || summaryCount >= 3
}

// 小并发执行（默认并发 2）
async function runWithConcurrency(items = [], limit = 2, handler) {
  const executing = []
  const results = []

  for (const item of items) {
    const task = Promise.resolve().then(() => handler(item))
    results.push(task)
    executing.push(task)

    task.finally(() => {
      const idx = executing.indexOf(task)
      if (idx >= 0) executing.splice(idx, 1)
    })

    if (executing.length >= limit) {
      await Promise.race(executing)
    }
  }

  return Promise.all(results)
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

  const progressSummary = buildProgressSummary({
    novelId,
    existingEvents,
    startChapter
  })
  const repeatBans = buildRepeatBans(existingEvents)

  let result = await outlineAgent.generateEventGraph({
    novelTitle: novel?.title || '未命名',
    genre: novel?.genre || '',
    synopsis: novel?.description || '',
    existingOutline: inputOutline || '',
    knowledgeContext,
    progressSummary,
    repeatBans,
    configOverride,
    targetChapters: targetChapters,
    startChapter,
    endChapter,
    existingEvents
  })

  const repeatCheck = checkEventRepeat({
    existingEvents,
    newEvents: result?.events || []
  })

  if (repeatCheck.hasRepeat) {
    const repeatHint = repeatCheck.repeatedPairs
      .slice(0, 5)
      .map(item => `- 新事件「${item.newLabel}」过像「${item.oldLabel}」(相似度 ${item.score})`)
      .join('\n')
    const retryRepeatBans = `${repeatBans}\n\n【重复检测结果】\n${repeatHint}\n请强制改变冲突类型/代价/线索形态，避免情节回环。`

    console.warn('[pipeline:generateEventBatch] 检测到事件重复，触发重生成')
    result = await outlineAgent.generateEventGraph({
      novelTitle: novel?.title || '未命名',
      genre: novel?.genre || '',
      synopsis: novel?.description || '',
      existingOutline: inputOutline || '',
      knowledgeContext: `${knowledgeContext}\n【额外约束】必须引入新的冲突/代价/线索类型，禁止重复前序套路。`,
      progressSummary,
      repeatBans: retryRepeatBans,
      configOverride,
      targetChapters: targetChapters,
      startChapter,
      endChapter,
      existingEvents
    })
  }

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
  logVerbose(`[章节批次] 小说信息: ${novel?.title || '未找到'}`)
  
  const meta = planningDAO.getPlanningMeta(novelId)
  logVerbose(`[章节批次] 规划元数据:`, meta ? { targetChapters: meta.targetChapters, wordsPerChapter: meta.wordsPerChapter } : '无')
  
  const chapters = planningDAO.listPlanningChapters(novelId)
  logVerbose(`[章节批次] 规划章节总数: ${chapters.length}`)

  const completed = []
  const processChapter = async (chapterNumber) => {
    // 确保 chapterNumber 是数值类型
    const numChapterNumber = Number(chapterNumber)
    logVerbose(`\n[章节批次] ========== 处理第 ${numChapterNumber} 章 ==========`)
    
    const plan = chapters.find(ch => ch.chapterNumber === numChapterNumber)
    if (!plan) {
      console.warn(`[章节批次] ⚠️ 第 ${numChapterNumber} 章没有找到规划，跳过`)
      return
    }
    logVerbose(`[章节批次] 找到规划: ${plan.title}, 目标字数: ${plan.targetWords}`)

    // 查询时也使用数值类型
    let chapter = chapterDAO.getChapterByNovelAndNumber(novelId, numChapterNumber)
    logVerbose(`[章节批次] 查询结果:`, chapter ? `找到章节 ID=${chapter.id}` : '未找到')
    
    if (!chapter) {
      logVerbose(`[章节批次] 章节不存在，创建新章节...`)
      logVerbose(`[章节批次] novelId=${novelId}, chapterNumber=${numChapterNumber} (类型: ${typeof numChapterNumber})`)
      
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
            logVerbose(`[章节批次] 重新查询成功, ID: ${chapter.id}`)
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
      logVerbose(`[章节批次] 使用已有章节, ID: ${chapter.id}`)
      chapterDAO.updateChapter(chapter.id, { status: 'writing' })
    }

    // 更新规划状态为进行中
    planningDAO.upsertPlanningChapters(novelId, [{
      ...plan,
      status: 'in_progress'
    }])

    // 章节生成目标字数默认上调到 1800
    const targetWords = plan.targetWords || meta?.wordsPerChapter || 1800
    logVerbose(`[章节批次] 开始生成内容, 目标字数: ${targetWords}`)

    try {
      const resolved = promptService.resolvePrompt('chapter.generator.system', { systemPrompt: systemPrompt || DEFAULT_CHAPTER_SYSTEM_PROMPT })
      const finalSystemPrompt = resolved.systemPrompt || systemPrompt || DEFAULT_CHAPTER_SYSTEM_PROMPT
      const originalContent = chapter.content || ''
      const maxRetries = 2
      let attempt = 0
      let generationResult = null
      let progressCheck = null

      while (attempt <= maxRetries) {
        if (attempt > 0) {
          // 回退到原始内容，避免重复叠加
          chapterDAO.updateChapter(chapter.id, { content: originalContent })
          try {
            chapterGenerator.resetGeneration(chapter.id)
          } catch (resetError) {
            console.warn('[章节批次] 重置生成状态失败:', resetError?.message || resetError)
          }
        }

        const progressSummary = buildProgressSummary({
          novelId,
          existingEvents: planningDAO.listPlanningEvents(novelId),
          startChapter: numChapterNumber
        })
        const extraPrompt = attempt === 0
          ? ''
          : `【推进度拦截：请强制推进】\n${progressSummary}\n\n必须引入不可逆变化（身份暴露/关系决裂/关键证据获取或损失/关键地点或资源发生变化），并避免复用最近章节的冲突与场景套路。`

        generationResult = await chapterGenerator.generateChapterChunks({
          novelId,
          chapterId: chapter.id,
          novelTitle: novel?.title || '未命名',
          extraPrompt,
          systemPrompt: finalSystemPrompt,
          targetWords,
          validateMode: 'final',
          configOverride,
          modelSource: 'pipeline'
        })

        progressCheck = checkChapterProgress({
          novelId,
          chapterNumber: numChapterNumber,
          content: generationResult?.chapter?.content || ''
        })

        if (!progressCheck.shouldRetry) {
          break
        }

        console.warn(`[章节批次] 第 ${chapterNumber} 章推进度不足，触发重写:`, progressCheck)
        attempt += 1
      }

      // 章节生成后进行反 AI 清洗（仅在需要时触发）
      if (shouldReviewChapterStyle(generationResult?.chapter?.content || '')) {
        await chapterGenerator.applyAntiAiPolish({
          novelId,
          chapterId: chapter.id,
          content: generationResult?.chapter?.content || '',
          configOverride: reviewConfigOverride || configOverride
        })
      }
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
    logVerbose(`[章节批次] 第 ${chapterNumber} 章状态已更新为 completed`)
  }

  // 小并发执行，提升批次整体速度
  const concurrency = 2
  await runWithConcurrency(chapterNumbers, concurrency, processChapter)

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
