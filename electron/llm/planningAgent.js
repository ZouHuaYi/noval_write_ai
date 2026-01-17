/**
 * Planning Agent - 规划代理
 * 负责将事件分配到章节，生成写作计划
 */
const llmService = require('./llmService')
const { safeParseJSON } = require('../utils/helpers')

/**
 * 任务状态
 */
const TASK_STATUS = {
  PENDING: 'pending',       // 待处理
  IN_PROGRESS: 'in_progress', // 进行中
  COMPLETED: 'completed',   // 已完成
  BLOCKED: 'blocked'        // 被阻塞
}

/**
 * 任务优先级
 */
const TASK_PRIORITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
}

/**
 * 生成章节计划
 * 将事件节点分配到具体章节，生成写作任务
 * @param {Object} options
 * @param {Array} options.events - 事件节点列表
 * @param {number} options.targetChapters - 目标章节数
 * @param {number} options.wordsPerChapter - 每章目标字数
 * @param {string} options.pacing - 节奏风格 (fast/medium/slow)
 * @returns {Promise<Object>}
 */
async function generateChapterPlan({
  events,
  targetChapters = 10,
  wordsPerChapter = 3000,
  pacing = 'medium'
}) {
  // 按章节分组现有事件
  const chapterEvents = new Map()
  events.forEach(event => {
    const chapter = event.chapter || 1
    if (!chapterEvents.has(chapter)) {
      chapterEvents.set(chapter, [])
    }
    chapterEvents.get(chapter).push(event)
  })

  // 构建章节计划
  const chapters = []
  for (let i = 1; i <= targetChapters; i++) {
    const eventsInChapter = chapterEvents.get(i) || []
    const mainEvent = eventsInChapter.find(e => e.eventType === 'plot' || e.eventType === 'conflict')

    chapters.push({
      chapterNumber: i,
      title: mainEvent ? mainEvent.label : `第 ${i} 章`,
      events: eventsInChapter.map(e => e.id),
      targetWords: wordsPerChapter,
      status: eventsInChapter.length > 0 ? TASK_STATUS.PENDING : TASK_STATUS.BLOCKED,
      priority: determinePriority(i, targetChapters, eventsInChapter),
      focus: determineFocus(eventsInChapter),
      writingHints: []
    })
  }

  // 生成写作提示
  const systemPrompt = `你是一个小说写作规划师，负责为每个章节生成具体的写作提示。
请根据章节包含的事件，给出 2-3 条简洁的写作建议。`

  for (const chapter of chapters) {
    if (chapter.events.length === 0) continue

    const chapterEventsData = events.filter(e => chapter.events.includes(e.id))
    const eventDescriptions = chapterEventsData
      .map(e => `- ${e.label}: ${e.description || '无描述'}`)
      .join('\n')

    try {
      const response = await llmService.callChatModel({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `第 ${chapter.chapterNumber} 章包含以下事件：\n${eventDescriptions}\n\n请给出 2-3 条写作建议，返回 JSON 数组格式。` }
        ],
        temperature: 0.6,
        maxTokens: 500
      })

      const hints = safeParseJSON(response)
      if (Array.isArray(hints)) {
        chapter.writingHints = hints
      } else if (hints?.hints) {
        chapter.writingHints = hints.hints
      }
    } catch (error) {
      console.error(`生成第 ${chapter.chapterNumber} 章写作提示失败:`, error)
    }
  }

  return {
    chapters,
    summary: {
      totalChapters: targetChapters,
      totalEvents: events.length,
      averageEventsPerChapter: (events.length / targetChapters).toFixed(1),
      estimatedTotalWords: targetChapters * wordsPerChapter
    }
  }
}

/**
 * 确定章节优先级
 */
function determinePriority(chapterNum, totalChapters, events) {
  // 第一章和最后一章高优先级
  if (chapterNum === 1 || chapterNum === totalChapters) {
    return TASK_PRIORITY.HIGH
  }

  // 包含冲突或解决事件的章节高优先级
  if (events.some(e => e.eventType === 'conflict' || e.eventType === 'resolution')) {
    return TASK_PRIORITY.HIGH
  }

  // 高潮章节高优先级 (70%-80% 位置)
  const position = chapterNum / totalChapters
  if (position >= 0.7 && position <= 0.85) {
    return TASK_PRIORITY.HIGH
  }

  return TASK_PRIORITY.MEDIUM
}

/**
 * 确定章节写作重点
 */
function determineFocus(events) {
  const focuses = []

  const eventTypes = events.map(e => e.eventType)

  if (eventTypes.includes('conflict')) {
    focuses.push('冲突描写')
  }
  if (eventTypes.includes('character')) {
    focuses.push('角色刻画')
  }
  if (eventTypes.includes('resolution')) {
    focuses.push('情节收束')
  }
  if (eventTypes.includes('plot')) {
    focuses.push('情节推进')
  }
  if (eventTypes.includes('transition')) {
    focuses.push('场景过渡')
  }

  return focuses.slice(0, 3)
}

/**
 * 创建写作任务看板
 * @param {Array} chapters - 章节计划
 * @returns {Object} 看板数据
 */
function createKanbanBoard(chapters) {
  const board = {
    columns: [
      {
        id: 'pending',
        title: '待写作',
        tasks: []
      },
      {
        id: 'in_progress',
        title: '写作中',
        tasks: []
      },
      {
        id: 'review',
        title: '待审核',
        tasks: []
      },
      {
        id: 'completed',
        title: '已完成',
        tasks: []
      }
    ]
  }

  chapters.forEach(chapter => {
    const task = {
      id: `task_chapter_${chapter.chapterNumber}`,
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      priority: chapter.priority,
      eventCount: chapter.events.length,
      targetWords: chapter.targetWords,
      focus: chapter.focus,
      hints: chapter.writingHints,
      status: chapter.status,
      progress: 0,
      createdAt: Date.now()
    }

    // 根据状态分配到不同列
    switch (chapter.status) {
      case TASK_STATUS.PENDING:
        board.columns[0].tasks.push(task)
        break
      case TASK_STATUS.IN_PROGRESS:
        board.columns[1].tasks.push(task)
        break
      case TASK_STATUS.COMPLETED:
        board.columns[3].tasks.push(task)
        break
      default:
        board.columns[0].tasks.push(task)
    }
  })

  // 按优先级排序
  board.columns.forEach(column => {
    column.tasks.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
  })

  return board
}

/**
 * 智能分配算法
 * 根据依赖关系和优先级推荐下一个要写的章节
 * @param {Array} events - 事件列表
 * @param {Array} chapters - 章节列表
 * @param {Object} currentProgress - 当前进度
 * @returns {Object} 推荐的下一个任务
 */
function recommendNextTask(events, chapters, currentProgress = {}) {
  const completedChapters = new Set(
    Object.entries(currentProgress)
      .filter(([_, status]) => status === TASK_STATUS.COMPLETED)
      .map(([id, _]) => parseInt(id))
  )

  // 构建事件依赖图
  const eventDependencyMet = new Map()
  events.forEach(event => {
    const deps = event.dependencies || []
    const allDepsMet = deps.every(depId => {
      const depEvent = events.find(e => e.id === depId)
      return depEvent && completedChapters.has(depEvent.chapter)
    })
    eventDependencyMet.set(event.id, allDepsMet)
  })

  // 筛选可写章节
  const availableChapters = chapters.filter(chapter => {
    // 已完成的跳过
    if (completedChapters.has(chapter.chapterNumber)) return false

    // 检查所有事件的依赖是否满足
    const chapterEvents = events.filter(e => e.chapter === chapter.chapterNumber)
    return chapterEvents.every(e => eventDependencyMet.get(e.id) !== false)
  })

  if (availableChapters.length === 0) {
    return null
  }

  // 按优先级和章节号排序
  availableChapters.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (priorityDiff !== 0) return priorityDiff
    return a.chapterNumber - b.chapterNumber
  })

  const recommended = availableChapters[0]

  return {
    chapter: recommended,
    reason: buildRecommendationReason(recommended, events, completedChapters),
    blockedBy: findBlockingDependencies(events, recommended, completedChapters)
  }
}

/**
 * 构建推荐理由
 */
function buildRecommendationReason(chapter, events, completedChapters) {
  const reasons = []

  if (chapter.chapterNumber === 1) {
    reasons.push('开篇章节，优先写作')
  }

  if (chapter.priority === TASK_PRIORITY.HIGH) {
    reasons.push('高优先级章节')
  }

  const chapterEvents = events.filter(e => e.chapter === chapter.chapterNumber)
  if (chapterEvents.some(e => e.eventType === 'conflict')) {
    reasons.push('包含重要冲突事件')
  }

  if (completedChapters.has(chapter.chapterNumber - 1)) {
    reasons.push('前一章已完成，可顺序写作')
  }

  return reasons.length > 0 ? reasons.join('；') : '按顺序写作'
}

/**
 * 查找阻塞依赖
 */
function findBlockingDependencies(events, chapter, completedChapters) {
  const blocking = []

  const chapterEvents = events.filter(e => e.chapter === chapter.chapterNumber)
  chapterEvents.forEach(event => {
    if (event.dependencies) {
      event.dependencies.forEach(depId => {
        const depEvent = events.find(e => e.id === depId)
        if (depEvent && !completedChapters.has(depEvent.chapter)) {
          blocking.push({
            eventId: depId,
            eventLabel: depEvent.label,
            chapter: depEvent.chapter
          })
        }
      })
    }
  })

  return blocking
}

/**
 * 估算写作时间
 * @param {Object} chapter - 章节信息
 * @param {number} wordsPerHour - 每小时预计字数
 * @returns {Object}
 */
function estimateWritingTime(chapter, wordsPerHour = 500) {
  const baseHours = chapter.targetWords / wordsPerHour

  // 根据事件数量调整
  const eventComplexity = chapter.events?.length || 1
  const complexityFactor = 1 + (eventComplexity - 1) * 0.2

  // 根据优先级调整（高优先级需要更多打磨时间）
  const priorityFactor = chapter.priority === TASK_PRIORITY.HIGH ? 1.3 : 1

  const estimatedHours = baseHours * complexityFactor * priorityFactor

  return {
    estimatedHours: Math.round(estimatedHours * 10) / 10,
    estimatedMinutes: Math.round(estimatedHours * 60),
    breakdown: {
      writing: Math.round(baseHours * 60),
      complexity: Math.round((complexityFactor - 1) * baseHours * 60),
      polish: Math.round((priorityFactor - 1) * baseHours * 60)
    }
  }
}

/**
 * 生成写作日程
 * @param {Array} chapters - 章节计划
 * @param {Object} options - 配置选项
 */
function generateWritingSchedule(chapters, options = {}) {
  const {
    startDate = new Date(),
    hoursPerDay = 3,
    wordsPerHour = 500,
    restDays = [0] // 周日休息
  } = options

  const schedule = []
  let currentDate = new Date(startDate)
  let currentChapterIndex = 0

  while (currentChapterIndex < chapters.length) {
    // 跳过休息日
    if (restDays.includes(currentDate.getDay())) {
      currentDate.setDate(currentDate.getDate() + 1)
      continue
    }

    const chapter = chapters[currentChapterIndex]
    const timeEstimate = estimateWritingTime(chapter, wordsPerHour)

    // 如果一天能完成
    if (timeEstimate.estimatedHours <= hoursPerDay) {
      schedule.push({
        date: new Date(currentDate),
        chapter: chapter.chapterNumber,
        title: chapter.title,
        estimatedHours: timeEstimate.estimatedHours,
        notes: `完成第 ${chapter.chapterNumber} 章`
      })
      currentChapterIndex++
    } else {
      // 需要多天
      const daysNeeded = Math.ceil(timeEstimate.estimatedHours / hoursPerDay)
      for (let day = 0; day < daysNeeded; day++) {
        schedule.push({
          date: new Date(currentDate),
          chapter: chapter.chapterNumber,
          title: chapter.title,
          estimatedHours: hoursPerDay,
          notes: `第 ${chapter.chapterNumber} 章 (第 ${day + 1}/${daysNeeded} 天)`
        })
        currentDate.setDate(currentDate.getDate() + 1)

        // 跳过休息日
        while (restDays.includes(currentDate.getDay())) {
          currentDate.setDate(currentDate.getDate() + 1)
        }
      }
      currentChapterIndex++
      continue
    }

    currentDate.setDate(currentDate.getDate() + 1)
  }

  return {
    schedule,
    summary: {
      startDate,
      estimatedEndDate: schedule.length > 0 ? schedule[schedule.length - 1].date : startDate,
      totalDays: schedule.length,
      totalHours: schedule.reduce((sum, s) => sum + s.estimatedHours, 0)
    }
  }
}

module.exports = {
  generateChapterPlan,
  createKanbanBoard,
  recommendNextTask,
  estimateWritingTime,
  generateWritingSchedule,
  TASK_STATUS,
  TASK_PRIORITY
}
