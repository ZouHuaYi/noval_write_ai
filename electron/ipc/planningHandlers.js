/**
 * Planning IPC Handlers
 * 处理规划相关的 IPC 请求
 */
const outlineAgent = require('../llm/outlineAgent')
const planningAgent = require('../llm/planningAgent')

const outlineDAO = require('../database/outlineDAO')
const chapterDAO = require('../database/chapterDAO')
const planningDAO = require('../database/planningDAO')
const worldviewService = require('../worldviewService')
const { buildKnowledgeSummary } = require('../llm/knowledgeContext')
const { buildPlanningSummary } = require('../llm/planningContext')

function mergeEvents(existingEvents = [], newEvents = []) {
  console.log('[mergeEvents] 现有事件数量:', existingEvents.length)
  console.log('[mergeEvents] 新事件数量:', newEvents.length)
  console.log('[mergeEvents] 现有事件 IDs:', existingEvents.map(e => e.id))
  console.log('[mergeEvents] 新事件 IDs:', newEvents.map(e => e.id))

  const merged = [...existingEvents]
  const existingMap = new Map(existingEvents.map(event => [event.id, event]))

  newEvents.forEach(event => {
    // 如果事件有 ID 且已存在，则更新该事件
    if (event.id && existingMap.has(event.id)) {
      const existing = existingMap.get(event.id)
      console.log('[mergeEvents] 更新现有事件:', event.id)
      // 更新事件属性
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

    // 新事件，直接添加
    console.log('[mergeEvents] 添加新事件:', event.id)
    merged.push(event)
    if (event.id) {
      existingMap.set(event.id, event)
    }
  })

  console.log('[mergeEvents] 合并后事件数量:', merged.length)
  console.log('[mergeEvents] 合并后事件 IDs:', merged.map(e => e.id))
  return merged
}

function buildOutlineContext(outlines = []) {
  if (!outlines.length) return ''
  return outlines.map(outline => {
    const start = outline.startChapter
    const end = outline.endChapter
    let range = '未设置范围'
    if (start && end) range = `第 ${start} 章 - 第 ${end} 章`
    else if (start) range = `第 ${start} 章起`
    else if (end) range = `至第 ${end} 章`
    const content = outline.content?.trim() || '（该大纲暂无内容）'
    return `【${outline.title}】(${range})\n${content}`
  }).join('\n\n')
}

function registerPlanningHandlers(ipcMain) {
  // ===== Context Building =====
  ipcMain.handle('planning:buildContext', async (_, { novelId, chapterId }) => {
    try {
      const chapter = await chapterDAO.getChapterById(chapterId)
      if (!chapter) throw new Error('章节不存在')

      const chapterNumber = chapter.chapterNumber

      // 1. 构建大纲上下文
      const outlines = await outlineDAO.getOutlinesByNovel(novelId)
      const matchedOutlines = outlines.filter(outline => {
        if (outline.startChapter == null || outline.endChapter == null) return false
        return chapterNumber && chapterNumber >= outline.startChapter && chapterNumber <= outline.endChapter
      })
      const outlineContext = buildOutlineContext(matchedOutlines)

      // 2. 构建知识图谱上下文
      const memoryContext = buildKnowledgeSummary({
        novelId,
        types: ['character', 'location', 'item', 'organization'],
        maxItems: 10,
        maxChars: 1200
      })

      // 3. 构建规划工作台上下文 (事件 + 任务)
      const planningContext = buildPlanningSummary({
        novelId,
        chapterNumber
      })

      // 4. 构建世界观与规则上下文
      const worldview = await worldviewService.getWorldview(novelId)
      let worldviewContext = ''
      if (worldview) {
        if (worldview.worldview) worldviewContext += `【世界背景设定】\n${worldview.worldview.trim()}\n`
        if (worldview.rules) worldviewContext += `\n【核心规则与限制】\n${worldview.rules.trim()}`
      }

      return {
        outlineContext,
        memoryContext: [memoryContext, planningContext].filter(Boolean).join('\n\n'),
        worldviewContext
      }
    } catch (error) {
      console.error('构建上下文失败:', error)
      throw error
    }
  })

  // ===== Outline Agent =====
  // ... existing handlers ...

  // 生成事件图谱
  ipcMain.handle('outline:generateEventGraph', async (_, options) => {
    try {
      const result = await outlineAgent.generateEventGraph({
        novelTitle: options.novelTitle,
        genre: options.genre,
        synopsis: options.synopsis,
        existingOutline: options.existingOutline,
        targetChapters: options.targetChapters || 10,
        startChapter: options.startChapter || 1,
        endChapter: options.endChapter ?? null
      })

      if (options.mergeEvents) {
        let existingEvents = options.existingEvents || []
        if (options.overrideRange && options.startChapter != null && options.endChapter != null) {
          const start = Number(options.startChapter)
          const end = Number(options.endChapter)
          existingEvents = existingEvents.filter(event => {
            const chapter = Number(event.chapter)
            if (!Number.isFinite(chapter)) return true
            return chapter < start || chapter > end
          })

          return {
            ...result,
            events: existingEvents.concat(result.events || [])
          }
        }
        const merged = mergeEvents(existingEvents, result.events || [])
        return {
          ...result,
          events: merged
        }
      }

      return result
    } catch (error) {
      console.error('生成事件图谱失败:', error)
      throw error
    }
  })


  // ===== Planning Agent =====

  ipcMain.handle('planning:getChapterPlan', async (_, novelId, chapterNumber) => {
    try {
      const chapters = planningDAO.listPlanningChapters(novelId)
      return chapters.find(ch => ch.chapterNumber === chapterNumber) || null
    } catch (error) {
      console.error('获取章节规划失败:', error)
      throw error
    }
  })

  ipcMain.handle('planning:updateChapterStatus', async (_, novelId, chapterNumber, status, extra = {}) => {
    try {
      const chapters = planningDAO.listPlanningChapters(novelId)
      const chapter = chapters.find(ch => ch.chapterNumber === chapterNumber)
      if (!chapter) return null

      const updated = {
        ...chapter,
        status,
        ...extra
      }
      planningDAO.upsertPlanningChapters(novelId, [updated])

      const dbStatus = status === 'completed' ? 'completed' : status === 'in_progress' ? 'writing' : 'draft'
      const existing = chapterDAO.getChapterByNovelAndNumber(novelId, chapterNumber)
      if (existing) {
        chapterDAO.updateChapter(existing.id, { status: dbStatus })
      }

      return updated
    } catch (error) {
      console.error('更新章节规划状态失败:', error)
      throw error
    }
  })

  ipcMain.handle('planning:updateChapter', async (_, novelId, chapterNumber, patch = {}) => {
    try {
      const chapters = planningDAO.listPlanningChapters(novelId)
      const chapter = chapters.find(ch => ch.chapterNumber === chapterNumber)
      if (!chapter) return null

      const updated = {
        ...chapter,
        ...patch,
        chapterNumber: chapter.chapterNumber
      }
      planningDAO.upsertPlanningChapters(novelId, [updated])

      const existing = chapterDAO.getChapterByNovelAndNumber(novelId, chapterNumber)
      if (existing && patch.title != null) {
        chapterDAO.updateChapter(existing.id, { title: patch.title })
      }

      return updated
    } catch (error) {
      console.error('更新章节规划失败:', error)
      throw error
    }
  })

  ipcMain.handle('planning:updateChapterNumber', async (_, novelId, fromChapter, toChapter) => {
    try {
      const fromNumber = Number(fromChapter)
      const toNumber = Number(toChapter)
      if (!Number.isFinite(fromNumber) || !Number.isFinite(toNumber)) {
        throw new Error('无效章节号')
      }

      if (fromNumber === toNumber) {
        return { success: true, chapter: fromNumber }
      }

      const chapters = planningDAO.listPlanningChapters(novelId)
      const target = chapters.find(ch => ch.chapterNumber === fromNumber)
      if (!target) {
        throw new Error('章节规划不存在')
      }

      const conflict = chapters.find(ch => ch.chapterNumber === toNumber)
      if (conflict) {
        throw new Error('目标章节号已存在')
      }

      const updated = {
        ...target,
        chapterNumber: toNumber
      }
      planningDAO.upsertPlanningChapters(novelId, [updated])

      const events = planningDAO.listPlanningEvents(novelId)
      const updatedEvents = events
        .filter(event => event.chapter === fromNumber)
        .map(event => ({
          ...event,
          chapter: toNumber
        }))
      if (updatedEvents.length) {
        planningDAO.upsertPlanningEvents(novelId, updatedEvents)
      }

      const existing = chapterDAO.getChapterByNovelAndNumber(novelId, fromNumber)
      if (existing) {
        chapterDAO.updateChapter(existing.id, { chapterNumber: toNumber })
      }

      return { success: true, chapter: toNumber }
    } catch (error) {
      console.error('更新章节号失败:', error)
      throw error
    }
  })

  ipcMain.handle('planning:getMeta', async (_, novelId) => {
    try {
      return planningDAO.getPlanningMeta(novelId)
    } catch (error) {
      console.error('获取规划元数据失败:', error)
      throw error
    }
  })

  ipcMain.handle('planning:updateMeta', async (_, novelId, meta) => {
    try {
      planningDAO.upsertPlanningMeta(novelId, meta || {})
      return planningDAO.getPlanningMeta(novelId)
    } catch (error) {
      console.error('更新规划元数据失败:', error)
      throw error
    }
  })


  // 生成章节计划
  ipcMain.handle('planning:generatePlan', async (_, options) => {
    try {
      // 解析前端传递的参数
      const { mode, startChapter, endChapter, appendCount, targetChapters, wordsPerChapter = 3000 } = options

      // 过滤出有章节关联的事件
      const chapterEvents = (options.events || []).filter(event => event.chapter != null)

      console.log('[planning:generatePlan] 参数:', {
        mode,
        startChapter,
        endChapter,
        eventsCount: chapterEvents.length,
        targetChapters
      })

      // 根据模式计算章节范围
      let effectiveStart = startChapter || 1
      let effectiveEnd = endChapter

      if (!effectiveEnd) {
        // 如果没有指定结束章节，根据事件推断
        const eventChapters = chapterEvents.map(e => e.chapter).filter(c => c != null)
        effectiveEnd = eventChapters.length > 0 ? Math.max(...eventChapters) : (effectiveStart + (targetChapters || 10) - 1)
      }

      const result = await planningAgent.generateChapterPlan({
        events: chapterEvents,
        targetChapters: targetChapters || (effectiveEnd - effectiveStart + 1),
        wordsPerChapter,
        pacing: options.pacing || 'medium',
        startChapter: effectiveStart,
        endChapter: effectiveEnd
      })

      console.log('[planning:generatePlan] 生成结果:', {
        chaptersCount: result.chapters?.length,
        summary: result.summary
      })

      return {
        ...result,
        unassignedEvents: (options.events || []).filter(event => event.chapter == null)
      }
    } catch (error) {
      console.error('生成章节计划失败:', error)
      throw error
    }
  })

  ipcMain.handle('planning:ensureChapter', async (_, novelId, payload) => {
    try {
      const chapterNumber = Number(payload?.chapterNumber)
      if (!Number.isFinite(chapterNumber)) {
        throw new Error('无效章节号')
      }

      const chapterPlan = planningDAO.listPlanningChapters(novelId)
        .find(ch => ch.chapterNumber === chapterNumber)
      if (!chapterPlan) {
        throw new Error('章节规划不存在')
      }

      let chapter = chapterDAO.getChapterByNovelAndNumber(novelId, chapterNumber)
      if (!chapter) {
        const createdId = chapterDAO.createChapter(novelId, {
          title: chapterPlan.title || `第 ${chapterNumber} 章`,
          chapterNumber,
          status: 'writing',
          content: ''
        })
        chapter = chapterDAO.getChapterById(createdId)
      } else {
        chapter = chapterDAO.updateChapter(chapter.id, {
          status: 'writing'
        })
      }

      if (chapterPlan.status !== 'in_progress') {
        planningDAO.upsertPlanningChapters(novelId, [{
          ...chapterPlan,
          status: 'in_progress'
        }])
      }

      return chapter
    } catch (error) {
      console.error('确保章节失败:', error)
      throw error
    }
  })


  // 创建看板
  ipcMain.handle('planning:createKanban', async (_, chapters) => {
    try {
      const board = planningAgent.createKanbanBoard(chapters)
      return board
    } catch (error) {
      console.error('创建看板失败:', error)
      throw error
    }
  })

  // 推荐下一个任务
  ipcMain.handle('planning:recommendTask', async (_, events, chapters, progress) => {
    try {
      const recommendation = planningAgent.recommendNextTask(events, chapters, progress)
      return recommendation
    } catch (error) {
      console.error('推荐任务失败:', error)
      throw error
    }
  })

  // ===== 规划数据持久化 =====

  // 保存规划数据 (事件图谱 + 章节计划 + 看板状态)
  ipcMain.handle('planning:saveData', async (_, novelId, data) => {
    try {
      const { PlanningEventListSchema, PlanningChapterListSchema, PlanningMetaSchema } = require('../validation/planningSchemas')

      const eventsResult = PlanningEventListSchema.safeParse(data?.events || [])
      if (!eventsResult.success) {
        throw new Error(`事件数据校验失败: ${eventsResult.error.issues.map(i => i.message).join('; ')}`)
      }

      const chaptersResult = PlanningChapterListSchema.safeParse(data?.chapters || [])
      if (!chaptersResult.success) {
        throw new Error(`章节数据校验失败: ${chaptersResult.error.issues.map(i => i.message).join('; ')}`)
      }

      const metaResult = PlanningMetaSchema.safeParse(data?.generateOptions || {})
      if (!metaResult.success) {
        throw new Error(`规划元数据校验失败: ${metaResult.error.issues.map(i => i.message).join('; ')}`)
      }

      const chapterNumbers = chaptersResult.data.map(ch => Number(ch.chapterNumber)).filter(Number.isFinite)
      const numberSet = new Set(chapterNumbers)
      if (numberSet.size !== chapterNumbers.length) {
        throw new Error('章节数据校验失败: 章节号重复')
      }

      // 职责分离后，事件可以关联尚未创建的章节，仅记录警告
      const unlinkedEvents = (eventsResult.data || []).filter(event => {
        if (event.chapter == null) return false
        return !numberSet.has(Number(event.chapter))
      })
      if (unlinkedEvents.length > 0) {
        console.log(`[planning:saveData] 有 ${unlinkedEvents.length} 个事件关联的章节尚未创建，这是正常的（请使用"生成计划"创建章节）`)
      }

      planningDAO.deletePlanningEventsByNovel(novelId)
      planningDAO.deletePlanningChaptersByNovel(novelId)
      planningDAO.upsertPlanningEvents(novelId, eventsResult.data)
      planningDAO.upsertPlanningChapters(novelId, chaptersResult.data)
      planningDAO.upsertPlanningMeta(novelId, metaResult.data)

      const dbChapters = chapterDAO.getChaptersByNovel(novelId)
      const dbByNumber = new Map(dbChapters.map(ch => [ch.chapterNumber, ch]))
      const plannedNumbers = new Set()

      chaptersResult.data.forEach(plan => {
        const chapterNumber = plan.chapterNumber
        plannedNumbers.add(chapterNumber)
        const status = plan.status || 'pending'
        const dbStatus = status === 'completed' ? 'completed' : status === 'in_progress' ? 'writing' : 'draft'
        const existing = dbByNumber.get(chapterNumber)
        if (existing) {
          const updates = {
            status: dbStatus
          }
          if (plan.title) {
            updates.title = plan.title
          }
          chapterDAO.updateChapter(existing.id, updates)
        }
      })

      return { success: true }
    } catch (error) {
      console.error('保存规划数据失败:', error)
      throw error
    }
  })

  // 加载规划数据
  ipcMain.handle('planning:loadData', async (_, novelId) => {
    try {
      const events = planningDAO.listPlanningEvents(novelId)
      const chapters = planningDAO.listPlanningChapters(novelId)
      const meta = planningDAO.getPlanningMeta(novelId)

      if (!events.length && !chapters.length && !meta) {
        return null
      }

      return {
        events,
        chapters,
        kanbanBoard: planningAgent.createKanbanBoard(chapters),
        generateOptions: meta || {}
      }
    } catch (error) {
      console.error('加载规划数据失败:', error)
      throw error
    }
  })

  // 清除规划数据
  ipcMain.handle('planning:clearData', async (_, novelId) => {
    try {
      planningDAO.deletePlanningEventsByNovel(novelId)
      planningDAO.deletePlanningChaptersByNovel(novelId)
      planningDAO.clearPlanningMeta(novelId)
      return { success: true }
    } catch (error) {
      console.error('清除规划数据失败:', error)
      throw error
    }
  })

}

module.exports = {
  registerPlanningHandlers
}
