const settingsDAO = require('../database/settingsDAO')

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
    const key = `planning_data_${novelId}`
    const data = settingsDAO.getSetting(key)

    if (!data || !data.chapters) return ''

    // 找到匹配的章节规划
    const chapterPlan = data.chapters.find(c => c.chapterNumber === chapterNumber)
    if (!chapterPlan) return ''

    let summary = `【章节计划 - 第 ${chapterNumber} 章】\n`
    summary += `目标：${chapterPlan.title}\n`
    if (chapterPlan.description) {
      summary += `内容要点：${chapterPlan.description}\n`
    }

    // 查找关联的事件 (如果有 events 数据)
    if (data.events && data.events.length > 0) {
      const relatedEvents = data.events.filter(e => e.chapter === chapterNumber)
      if (relatedEvents.length > 0) {
        summary += `关键事件：\n`
        relatedEvents.forEach(e => {
          summary += `- ${e.label}：${e.description || '无描述'}\n`
          if (e.characters && e.characters.length > 0) {
            summary += `  参与角色：${e.characters.join('、')}\n`
          }
        })
      }
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
