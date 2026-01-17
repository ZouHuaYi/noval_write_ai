/**
 * Planning IPC Handlers
 * 处理规划相关的 IPC 请求
 */
const outlineAgent = require('../llm/outlineAgent')
const planningAgent = require('../llm/planningAgent')

const outlineDAO = require('../database/outlineDAO')
const chapterDAO = require('../database/chapterDAO')
const settingsDAO = require('../database/settingsDAO')
const { buildKnowledgeSummary } = require('../llm/knowledgeContext')

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

      // 2. 构建知识库/记忆上下文
      const memoryContext = buildKnowledgeSummary({
        novelId,
        types: ['character', 'location', 'timeline', 'plot'],
        maxItems: 12,
        currentChapter: chapterNumber,
        maxChars: 1200
      })

      return {
        outlineContext,
        memoryContext
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
        targetChapters: options.targetChapters || 10
      })
      return result
    } catch (error) {
      console.error('生成事件图谱失败:', error)
      throw error
    }
  })

  // 从章节提取事件
  ipcMain.handle('outline:extractEvents', async (_, options) => {
    try {
      const events = await outlineAgent.extractEventsFromChapters({
        chapters: options.chapters,
        novelId: options.novelId
      })
      return events
    } catch (error) {
      console.error('提取事件失败:', error)
      throw error
    }
  })

  // 分析事件依赖
  ipcMain.handle('outline:analyzeDependencies', async (_, events) => {
    try {
      const result = await outlineAgent.analyzeEventDependencies(events)
      return result
    } catch (error) {
      console.error('分析依赖失败:', error)
      throw error
    }
  })

  // 扩展事件节点
  ipcMain.handle('outline:expandEvent', async (_, event, context) => {
    try {
      const result = await outlineAgent.expandEventNode(event, context)
      return result
    } catch (error) {
      console.error('扩展事件失败:', error)
      throw error
    }
  })

  // 验证事件图谱
  ipcMain.handle('outline:validateGraph', async (_, events) => {
    try {
      const result = await outlineAgent.validateEventGraph(events)
      return result
    } catch (error) {
      console.error('验证图谱失败:', error)
      throw error
    }
  })

  // ===== Planning Agent =====

  // 生成章节计划
  ipcMain.handle('planning:generatePlan', async (_, options) => {
    try {
      const result = await planningAgent.generateChapterPlan({
        events: options.events,
        targetChapters: options.targetChapters,
        wordsPerChapter: options.wordsPerChapter,
        pacing: options.pacing
      })
      return result
    } catch (error) {
      console.error('生成章节计划失败:', error)
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

  // 估算写作时间
  ipcMain.handle('planning:estimateTime', async (_, chapter, wordsPerHour) => {
    try {
      const estimate = planningAgent.estimateWritingTime(chapter, wordsPerHour)
      return estimate
    } catch (error) {
      console.error('估算时间失败:', error)
      throw error
    }
  })

  // 生成写作日程
  ipcMain.handle('planning:generateSchedule', async (_, chapters, options) => {
    try {
      const schedule = planningAgent.generateWritingSchedule(chapters, options)
      return schedule
    } catch (error) {
      console.error('生成日程失败:', error)
      throw error
    }
  })

  // ===== 规划数据持久化 =====

  // 保存规划数据 (事件图谱 + 章节计划 + 看板状态)
  ipcMain.handle('planning:saveData', async (_, novelId, data) => {
    try {
      const key = `planning_data_${novelId}`
      settingsDAO.setSetting(key, data, '规划工作台数据')
      return { success: true }
    } catch (error) {
      console.error('保存规划数据失败:', error)
      throw error
    }
  })

  // 加载规划数据
  ipcMain.handle('planning:loadData', async (_, novelId) => {
    try {
      const key = `planning_data_${novelId}`
      const data = settingsDAO.getSetting(key)
      return data || null
    } catch (error) {
      console.error('加载规划数据失败:', error)
      throw error
    }
  })

  // 清除规划数据
  ipcMain.handle('planning:clearData', async (_, novelId) => {
    try {
      const key = `planning_data_${novelId}`
      settingsDAO.deleteSetting(key)
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
