const planningDAO = require('../database/planningDAO')


function normalizeText(value) {
  return (value || '').toString().trim()
}

/**
 * 构建写作规划摘要
 * @param {Object} params
 * @param {string} params.novelId - 小说 ID
 * @param {number} params.chapterNumber - 当前章节号
 * @returns {string} 规划内容摘要
 */
function buildPlanningSummary({ novelId, chapterNumber }) {
  if (!novelId || chapterNumber == null) return ''

  try {
    const chapters = planningDAO.listPlanningChapters(novelId)
    if (!chapters.length) return ''

    const chapterPlan = chapters.find(c => c.chapterNumber === chapterNumber)
    if (!chapterPlan) return ''

    let summary = `【章节计划 - 第 ${chapterNumber} 章】\n`
    summary += `目标：${chapterPlan.title}\n`
    if (chapterPlan.targetWords) {
      summary += `目标字数：${chapterPlan.targetWords} 字\n`
    }
    if (chapterPlan.summary) {
      summary += `内容要点：${chapterPlan.summary}\n`
    }
    if (Array.isArray(chapterPlan.focus) && chapterPlan.focus.length) {
      summary += `写作重点：${chapterPlan.focus.join('、')}\n`
    }
    if (Array.isArray(chapterPlan.writingHints) && chapterPlan.writingHints.length) {
      summary += `写作提示：${chapterPlan.writingHints.join('；')}\n`
    }

    const events = planningDAO.listPlanningEvents(novelId)
    let relatedEvents = []
    if (Array.isArray(chapterPlan.events) && chapterPlan.events.length) {
      const eventMap = new Map(events.map(e => [e.id, e]))
      relatedEvents = chapterPlan.events
        .map(id => eventMap.get(id))
        .filter(Boolean)
    } else if (events.length > 0) {
      relatedEvents = events.filter(e => e.chapter === chapterNumber)
    }

    if (relatedEvents.length > 0) {
      summary += `关键事件：\n`
      relatedEvents.forEach(e => {
        summary += `- ${e.label || e.id}：${e.description || '无描述'}\n`
        if (e.characters && e.characters.length > 0) {
          summary += `  参与角色：${e.characters.join('、')}\n`
        }
      })
    }

    return summary
  } catch (error) {
    console.error('构建规划摘要失败:', error)
    return ''
  }
}

module.exports = {
  buildPlanningSummary
}
