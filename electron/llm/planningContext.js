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

    // 读取章级骨架（ChapterBeats），用于强化章节约束
    const planningMeta = planningDAO.getPlanningMeta(novelId)
    const chapterBeats = Array.isArray(planningMeta?.chapterBeats) ? planningMeta.chapterBeats : []
    const chapterBeat = chapterBeats.find(beat => Number(beat.chapter) === Number(chapterNumber))
    console.log(`[buildPlanningSummary] 章级骨架读取: ${chapterBeats.length} 条, 命中=${Boolean(chapterBeat)}, novelId=${novelId}, chapter=${chapterNumber}`)
    const emotionArc = Array.isArray(planningMeta?.emotionArc) ? planningMeta.emotionArc : []
    const emotionNode = emotionArc.find(item => Number(item.chapter) === Number(chapterNumber))

    // 读取全量事件数据，后续用于章节映射
    const events = planningDAO.listPlanningEvents(novelId)
    const eventMap = new Map(events.map(e => [e.id, e]))
    let relatedEvents = []
    if (Array.isArray(chapterPlan.events) && chapterPlan.events.length) {
      relatedEvents = chapterPlan.events
        .map(id => eventMap.get(id))
        .filter(Boolean)
    } else if (events.length > 0) {
      relatedEvents = events.filter(e => e.chapter === chapterNumber)
    }

    // 从事件描述中提取代价/误判/关系信号，作为硬约束
    const costs = []
    const misconceptions = []
    const relationSignals = []
    if (chapterBeat) {
      const beatCost = normalizeText(chapterBeat.cost)
      const beatMisconception = normalizeText(chapterBeat.misconception)
      if (beatCost) costs.push(beatCost)
      if (beatMisconception) misconceptions.push(beatMisconception)
    }

    relatedEvents.forEach(event => {
      const desc = normalizeText(event.description)
      if (!desc) return
      if (desc.match(/代价|失去|暴露|受伤|误会|错过|破裂|被盯上|留下把柄/)) {
        costs.push(desc)
      }
      if (desc.match(/误判|以为|误以为|相信|认定|没想到|低估/)) {
        misconceptions.push(desc)
      }
      if (desc.match(/合作|交换|试探|背离|怀疑|站队|威胁|承诺|隐瞒|摊牌/)) {
        relationSignals.push(desc)
      }
    })

    // 去重（保留顺序），避免重复约束
    const uniqByPrefix = (items, size = 40) => {
      const seen = new Set()
      return items.filter(item => {
        const key = item.slice(0, size)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }

    const uniqCosts = uniqByPrefix(costs).slice(0, 3)
    const uniqMisconceptions = uniqByPrefix(misconceptions).slice(0, 3)
    const uniqRelations = uniqByPrefix(relationSignals).slice(0, 3)

    // 输出写作执行单，减少任务链/概述腔
    let summary = `【写作执行单 - 第 ${chapterNumber} 章】\n`
    summary += `章名：${normalizeText(chapterPlan.title) || `第 ${chapterNumber} 章`}\n`
    if (chapterPlan.targetWords) {
      summary += `字数上限：${chapterPlan.targetWords}（不必凑满）\n`
    }
    if (chapterPlan.summary) {
      summary += `本章落点：${normalizeText(chapterPlan.summary)}\n`
    }
    if (emotionNode) {
      summary += `情绪强度：${emotionNode.level ?? 50}（${normalizeText(emotionNode.label || '平稳')}）\n`
      if (emotionNode.isBreath) {
        summary += `缓冲章要求：允许节奏放缓，强化关系与细节，避免持续高压\n`
      }
    }
    if (Array.isArray(chapterPlan.focus) && chapterPlan.focus.length) {
      summary += `本章偏重：${chapterPlan.focus.join('、')}\n`
    }
    if (Array.isArray(chapterPlan.writingHints) && chapterPlan.writingHints.length) {
      // 写作提示只取最具体的两条，避免泛化建议
      const hints = chapterPlan.writingHints
        .map(item => normalizeText(item))
        .filter(Boolean)
        .filter(item => item.length <= 40)
        .slice(0, 2)
      if (hints.length > 0) {
        summary += `写作提示：${hints.join('；')}\n`
      }
    }

    if (chapterBeat) {
      // 章级骨架直接喂给正文生成器，强化节奏与代价
      summary += `\n【章级骨架】\n`
      if (chapterBeat.purpose) {
        summary += `- 本章目的：${normalizeText(chapterBeat.purpose)}\n`
      }
      if (chapterBeat.turningPoint) {
        summary += `- 本章转折：${normalizeText(chapterBeat.turningPoint)}\n`
      }
      if (chapterBeat.cost) {
        summary += `- 本章代价：${normalizeText(chapterBeat.cost)}\n`
      }
      if (chapterBeat.misconception) {
        summary += `- 本章误判：${normalizeText(chapterBeat.misconception)}\n`
      }
      if (chapterBeat.nextHook) {
        summary += `- 下一章钩子：${normalizeText(chapterBeat.nextHook)}\n`
      }
    }

    summary += `\n【硬约束】\n`
    if (uniqCosts.length > 0) {
      summary += `- 本章必须付出代价（至少发生1条）：\n`
      uniqCosts.forEach(item => {
        summary += `  - ${item}\n`
      })
    } else {
      summary += `- 本章必须付出代价：暴露行踪/失去证据/关系裂痕/受伤（至少选1项落地）\n`
    }

    if (uniqMisconceptions.length > 0) {
      summary += `- 本章允许出现误判（至少发生1条）：\n`
      uniqMisconceptions.forEach(item => {
        summary += `  - ${item}\n`
      })
    } else {
      summary += `- 本章允许出现误判：角色把一条线索当成安全出口，结果更危险\n`
    }

    if (uniqRelations.length > 0) {
      summary += `- 本章关系信号（至少出现1条）：\n`
      uniqRelations.forEach(item => {
        summary += `  - ${item}\n`
      })
    } else {
      summary += `- 本章关系信号：出现一次“交换条件/隐瞒/试探”，关系可持续变化\n`
    }

    summary += `- 禁止事项：不要连续使用“必须/得/立刻”；不要用“发现线索→赶去下一处”刷屏\n`

    if (relatedEvents.length > 0) {
      // 事件清单采用动作化短句，避免全知概述
      summary += `\n【本章事件清单】\n`
      relatedEvents.forEach(event => {
        const label = normalizeText(event.label || event.id)
        const desc = normalizeText(event.description)
        summary += `- ${label}\n`
        if (desc) {
          const trimmed = desc.length > 120 ? `${desc.slice(0, 120)}...` : desc
          summary += `  事件描述：${trimmed}\n`
        }
        if (Array.isArray(event.characters) && event.characters.length > 0) {
          summary += `  涉及角色：${event.characters.join('、')}\n`
        }
        if (Array.isArray(event.dependencies) && event.dependencies.length > 0) {
          summary += `  依赖：${event.dependencies.join(', ')}\n`
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
