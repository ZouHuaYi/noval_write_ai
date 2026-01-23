const llmService = require('../llm/llmService')
const outlineAgent = require('../llm/outlineAgent')
const planningAgent = require('../llm/planningAgent')
const chapterGenerator = require('../llm/chapterGenerator')
const worldviewService = require('../worldviewService')
const planningDAO = require('../database/planningDAO')
const chapterDAO = require('../database/chapterDAO')
const novelDAO = require('../database/novelDAO')
const { safeParseJSON } = require('../utils/helpers')
const { getGraphManager } = require('../graph/graphManager')

// 章节生成默认系统提示
const DEFAULT_CHAPTER_SYSTEM_PROMPT = '你是小说写作助手。根据给定上下文续写章节，保持原文叙事视角与文风，语言精炼克制，避免赘述与空泛描写，不重复已有内容，不输出标题或说明，只输出章节正文。'

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
    wordsPerChapter: pickNumber(fallback.wordsPerChapter, result?.wordsPerChapter, 1200),
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

// 分析评估输入
async function analyzeInput({ novelId, inputWorldview, inputRules, inputOutline, settings }) {
  const novel = novelDAO.getNovelById(novelId)
  const systemPrompt = '你是小说策划评估助手，请根据输入的世界观、规则与章节大纲，估算章节数、每章字数、节奏与分批策略。必须输出 JSON。'
  const userPrompt = `【小说标题】\n${novel?.title || '未命名'}\n\n【世界观设定】\n${inputWorldview || '无'}\n\n【规则设定】\n${inputRules || '无'}\n\n【章节大纲】\n${inputOutline || '无'}\n\n请输出 JSON：\n{\n  "synopsis": "一句话梗概",\n  "targetChapters": 预计章节数(数字),\n  "wordsPerChapter": 每章目标字数(数字),\n  "pacing": "fast|medium|slow",\n  "eventBatchSize": 事件生成每批覆盖章节数(数字),\n  "chapterBatchSize": 章节生成每批章节数(数字),\n  "notes": "可选备注"\n}`

  const response = await llmService.callChatModel({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.4,
    maxTokens: 1200
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
  inputOutline
}) {
  const novel = novelDAO.getNovelById(novelId)
  const existingEvents = planningDAO.listPlanningEvents(novelId)

  const result = await outlineAgent.generateEventGraph({
    novelTitle: novel?.title || '未命名',
    genre: novel?.genre || '',
    synopsis: novel?.description || '',
    existingOutline: inputOutline || '',
    targetChapters: targetChapters,
    startChapter,
    endChapter,
    existingEvents
  })

  const merged = mergeEvents(existingEvents, result?.events || [])
  planningDAO.upsertPlanningEvents(novelId, merged)

  return {
    range: { startChapter, endChapter },
    addedEvents: (result?.events || []).length,
    totalEvents: merged.length
  }
}

// 生成章节计划
async function generatePlan({ novelId, settings }) {
  const events = planningDAO.listPlanningEvents(novelId) || []
  const targetChapters = Number(settings?.targetChapters) || 10
  const wordsPerChapter = Number(settings?.wordsPerChapter) || 1200

  const result = await planningAgent.generateChapterPlan({
    events,
    targetChapters,
    wordsPerChapter,
    pacing: settings?.pacing || 'medium',
    startChapter: 1,
    endChapter: targetChapters
  })

  planningDAO.upsertPlanningChapters(novelId, result.chapters || [])
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
async function generateChapterBatch({ novelId, chapterNumbers, systemPrompt }) {
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

    const targetWords = plan.targetWords || meta?.wordsPerChapter || 1200
    console.log(`[章节批次] 开始生成内容, 目标字数: ${targetWords}`)

    try {
      await chapterGenerator.generateChapterChunks({
        novelId,
        chapterId: chapter.id,
        novelTitle: novel?.title || '未命名',
        extraPrompt: '',
        systemPrompt: systemPrompt || DEFAULT_CHAPTER_SYSTEM_PROMPT,
        targetWords
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
  analyzeInput,
  generateEventBatch,
  generatePlan,
  generateChapterBatch,
  syncGraph,
  persistWorldview,
  DEFAULT_CHAPTER_SYSTEM_PROMPT
}
