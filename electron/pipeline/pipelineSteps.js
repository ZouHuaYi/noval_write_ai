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

function buildRepeatBans(existingEvents = [], options = {}) {
  const { novelId, recentWindow = 6, maxLocations = 8 } = options || {}

  const parts = []

  // 1) 事件模式去重：避免生成“同一类冲突/线索套路”的事件
  const recent = existingEvents.slice(-12)
  if (recent.length) {
    const labels = recent
      .map(evt => evt.label || '')
      .filter(Boolean)
      .slice(0, 8)
    if (labels.length) {
      parts.push(`避免重复以下事件模式：\n${labels.map((label, idx) => `${idx + 1}. ${label}`).join('\n')}`)
    }
  }

  // 2) 地点去重：避免“同地点重复演类似戏”，提升场景多样性
  if (novelId) {
    try {
      const manager = getGraphManager()
      const graph = manager.getGraph(novelId)
      const locationNodes = graph?.getAllNodes?.('location') || []
      if (locationNodes.length) {
        const chapters = chapterDAO.getChaptersByNovel(novelId) || []
        const maxChapter = chapters.length ? Math.max(...chapters.map(ch => Number(ch.chapterNumber) || 0)) : 0
        const start = Math.max(1, maxChapter - Number(recentWindow) + 1)
        const recentChapters = []
        for (let ch = start; ch <= maxChapter; ch += 1) recentChapters.push(ch)

        const candidates = locationNodes
          .map(node => {
            const mentioned = Array.isArray(node.mentionedInChapters) ? node.mentionedInChapters : []
            const inRecentCount = recentChapters.filter(ch => mentioned.includes(ch)).length
            const fallbackLast = mentioned.length ? Math.max(...mentioned.map(ch => Number(ch) || 0)) : 0
            const lastMention = Number.isFinite(Number(node.lastMention)) ? Number(node.lastMention) : fallbackLast
            return { label: (node.label || '').trim(), inRecentCount, lastMention }
          })
          // 最近窗口内出现过的地点都不建议继续作为“主场景”复用
          .filter(item => item.label && item.lastMention >= start && item.lastMention <= maxChapter)
          .sort((a, b) => {
            if (b.lastMention !== a.lastMention) return b.lastMention - a.lastMention
            return b.inRecentCount - a.inRecentCount
          })
          .slice(0, Math.max(1, Number(maxLocations)))

        if (candidates.length) {
          parts.push(
            `避免把以下高频地点当作“主场景/开场/高潮场景”（可路过但不要承载主要冲突）：\n${candidates
              .map((c, idx) => `${idx + 1}. ${c.label}`)
              .join('\n')}`
          )
        }
      }
    } catch (error) {
      console.warn('[buildRepeatBans] 构建地点禁区失败:', error?.message || error)
    }
  }

  return parts.length ? parts.join('\n\n') : '无'
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

/**
 * 统计子串出现次数（用于粗略识别“主场景地点”是否复用）
 * @param {string} text
 * @param {string} needle
 * @returns {number}
 */
function countOccurrences(text, needle) {
  if (!text || !needle) return 0
  let count = 0
  let index = 0
  while (true) {
    index = text.indexOf(needle, index)
    if (index === -1) break
    count += 1
    index += needle.length
  }
  return count
}

/**
 * 检测当前章节是否“主场景地点复用”（解决：隔章/多章反复在同地点演类似戏）
 * 说明：这是启发式检测，不追求完全准确，目的仅是触发重写提示。
 */
function detectLocationRepeat({ novelId, chapterNumber, content, recentChapters = [], recentWindow = 5 }) {
  const numericChapter = Number(chapterNumber)
  if (!novelId || !content || !Number.isFinite(numericChapter) || numericChapter <= 1) {
    return { locationRepeat: false, dominantLocation: '', repeatedIn: [], retryHint: '' }
  }

  try {
    const manager = getGraphManager()
    const graph = manager.getGraph(novelId)
    const locationNodes = graph?.getAllNodes?.('location') || []
    if (!locationNodes.length) return { locationRepeat: false, dominantLocation: '', repeatedIn: [], retryHint: '' }

    const start = Math.max(1, numericChapter - Number(recentWindow))

    // 仅从“最近窗口出现过的地点”里选候选，避免全量扫描带来开销
    const recentCandidates = locationNodes
      .map(node => {
        const mentioned = Array.isArray(node.mentionedInChapters) ? node.mentionedInChapters : []
        const fallbackLast = mentioned.length ? Math.max(...mentioned.map(ch => Number(ch) || 0)) : 0
        const lastMention = Number.isFinite(Number(node.lastMention)) ? Number(node.lastMention) : fallbackLast
        return { label: (node.label || '').trim(), lastMention }
      })
      .filter(item => item.label && item.lastMention >= start && item.lastMention <= numericChapter - 1)
      .sort((a, b) => b.lastMention - a.lastMention)
      .slice(0, 30)
      .map(item => item.label)

    if (!recentCandidates.length) return { locationRepeat: false, dominantLocation: '', repeatedIn: [], retryHint: '' }

    let dominantLocation = ''
    let dominantCount = 0
    recentCandidates.forEach(label => {
      const count = countOccurrences(content, label)
      if (count > dominantCount) {
        dominantLocation = label
        dominantCount = count
      }
    })

    // 主场景判定：同一地点至少出现 3 次（避免把“一笔带过”误判为主场景）
    if (!dominantLocation || dominantCount < 3) {
      return { locationRepeat: false, dominantLocation: '', repeatedIn: [], retryHint: '' }
    }

    const repeatedIn = []
    recentChapters.forEach(ch => {
      const count = countOccurrences(ch.content || '', dominantLocation)
      if (count >= 3) repeatedIn.push(ch.chapterNumber)
    })

    if (!repeatedIn.length) {
      return { locationRepeat: false, dominantLocation: '', repeatedIn: [], retryHint: '' }
    }

    return {
      locationRepeat: true,
      dominantLocation,
      repeatedIn,
      retryHint: `【场景重复警告】本章疑似把“${dominantLocation}”当作主场景复用（最近章节也多次以此为主场景）。请更换新的主场景；若必须出现旧地点，只能路过并让主要冲突发生在新地点。`
    }
  } catch (error) {
    return { locationRepeat: false, dominantLocation: '', repeatedIn: [], retryHint: '' }
  }
}

// 正文推进度检查（对比最近章节相似度与新信息比例）
function checkChapterProgress({ novelId, chapterNumber, content, recentCount = 5 }) {
  if (!content) {
    return { shouldRetry: false, maxSimilarity: 0, novelty: 1, compared: [], locationRepeat: false, retryHint: '' }
  }

  const chapters = chapterDAO.getChaptersByNovel(novelId) || []
  const history = chapters
    .filter(ch => Number(ch.chapterNumber) < Number(chapterNumber) && ch.content)
    .sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0))

  const recent = history.slice(-recentCount)
  if (!recent.length) {
    return { shouldRetry: false, maxSimilarity: 0, novelty: 1, compared: [], locationRepeat: false, retryHint: '' }
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

  const locationCheck = detectLocationRepeat({
    novelId,
    chapterNumber,
    content,
    recentChapters: recent,
    recentWindow: recentCount
  })

  const shouldRetry = maxSimilarity >= 0.38 || novelty < 0.35 || locationCheck.locationRepeat

  return {
    shouldRetry,
    maxSimilarity: Number(maxSimilarity.toFixed(2)),
    novelty: Number(novelty.toFixed(2)),
    compared,
    locationRepeat: locationCheck.locationRepeat,
    dominantLocation: locationCheck.dominantLocation,
    repeatedLocationChapters: locationCheck.repeatedIn,
    retryHint: locationCheck.retryHint
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

function normalizeEmotionLabel(level) {
  const value = Number(level)
  if (value >= 85) return '高潮'
  if (value >= 70) return '高压'
  if (value >= 55) return '紧张'
  if (value >= 40) return '平稳'
  return '缓冲'
}

function buildEmotionArc(targetChapters = 10) {
  const total = Math.max(1, Number(targetChapters) || 10)
  const curve = []
  const peak1 = Math.max(2, Math.round(total * 0.33))
  const peak2 = Math.max(peak1 + 2, Math.round(total * 0.66))

  for (let chapter = 1; chapter <= total; chapter += 1) {
    let level = 50
    if (chapter <= peak1) {
      // 整体下调 10 点，避免全书持续高压
      level = 20 + Math.round((chapter / peak1) * 40) // 20-60
    } else if (chapter <= peak2) {
      const ratio = (chapter - peak1) / Math.max(1, peak2 - peak1)
      // 整体下调 10 点，避免峰值过高
      level = 35 + Math.round(ratio * 45) // 35-80
    } else {
      const ratio = (chapter - peak2) / Math.max(1, total - peak2)
      // 整体下调 10 点，尾声更平缓
      level = 70 - Math.round(ratio * 30) // 70-40
    }

    const isBreath = level <= 40 || chapter % 3 === 0
    curve.push({
      chapter,
      level,
      label: normalizeEmotionLabel(level),
      isBreath
    })
  }

  return curve
}

function buildEmotionSummary(emotionArc = []) {
  if (!Array.isArray(emotionArc) || emotionArc.length === 0) return '无'
  const items = emotionArc.map(item => `第${item.chapter}章:${item.level}(${item.label}${item.isBreath ? ',缓冲' : ''})`)
  return items.join('；')
}

function buildBreathChapters(emotionArc = []) {
  if (!Array.isArray(emotionArc) || emotionArc.length === 0) return '无'
  const chapters = emotionArc.filter(item => item.isBreath).map(item => item.chapter)
  return chapters.length ? `缓冲章：${chapters.join('、')}` : '无'
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
  const currentMeta = planningDAO.getPlanningMeta(novelId) || {}
  const emotionArc = Array.isArray(currentMeta.emotionArc)
    ? currentMeta.emotionArc
    : buildEmotionArc(targetChapters)

  if (!Array.isArray(currentMeta.emotionArc) || currentMeta.emotionArc.length === 0) {
    planningDAO.upsertPlanningMeta(novelId, {
      ...currentMeta,
      emotionArc
    })
  }

  const emotionArcSummary = buildEmotionSummary(emotionArc)
  const breathChapters = buildBreathChapters(emotionArc)
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
  const repeatBans = buildRepeatBans(existingEvents, { novelId })

  let result = await outlineAgent.generateEventGraph({
    novelTitle: novel?.title || '未命名',
    genre: novel?.genre || '',
    synopsis: novel?.description || '',
    existingOutline: inputOutline || '',
    knowledgeContext,
    progressSummary,
    repeatBans,
    emotionArcSummary,
    breathChapters,
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
      emotionArcSummary,
      breathChapters,
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

  const currentMeta = planningDAO.getPlanningMeta(novelId) || {}
  const emotionArc = Array.isArray(currentMeta.emotionArc)
    ? currentMeta.emotionArc
    : buildEmotionArc(targetChapters)
  if (!Array.isArray(currentMeta.emotionArc) || currentMeta.emotionArc.length === 0) {
    planningDAO.upsertPlanningMeta(novelId, {
      ...currentMeta,
      emotionArc
    })
  }

  const result = await planningAgent.generateChapterPlan({
    events: rangeEvents,
    targetChapters,
    wordsPerChapter,
    pacing: settings?.pacing || 'medium',
    startChapter: rangeStart,
    endChapter: rangeEnd,
    mode: 'pipeline',
    emotionArc,
    configOverride
  })

  planningDAO.upsertPlanningChapters(novelId, result.chapters || [])
  // 仅更新元信息，不干扰其它章节范围
  planningDAO.upsertPlanningMeta(novelId, {
    synopsis: settings?.synopsis || null,
    targetChapters,
    wordsPerChapter,
    lockWritingTarget: false,
    emotionArc
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
        const retryHint = attempt > 0 && progressCheck?.retryHint
          ? `\n\n${progressCheck.retryHint}`
          : ''
        const extraPrompt = attempt === 0
          ? ''
          : `【推进度拦截：请强制推进】\n${progressSummary}\n\n必须引入不可逆变化（身份暴露/关系决裂/关键证据获取或损失/关键地点或资源发生变化），并避免复用最近章节的冲突与场景套路。${retryHint}`

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

  // 顺序执行，保证章节过渡顺畅
  for (const chapterNumber of chapterNumbers) {
    await processChapter(chapterNumber)
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
