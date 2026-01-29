/**
 * ReIO 输出检查模块
 * 实现 StoryWriter 的自检机制：生成后做一致性检查
 */

const llmService = require('./llmService')
const reioStatsDAO = require('../database/reioStatsDAO')
const promptService = require('../prompt/promptService')

// ReIO 检查统计
const reioStats = {
  totalChecks: 0,
  passedChecks: 0,
  failedChecks: 0,
  totalRewrites: 0,
  lastCheckTime: null,
  lastCheckResult: null
}

try {
  const stored = reioStatsDAO.getReioStats()
  if (stored) {
    reioStats.totalChecks = stored.totalChecks || 0
    reioStats.passedChecks = stored.passedChecks || 0
    reioStats.failedChecks = stored.failedChecks || 0
    reioStats.totalRewrites = stored.totalRewrites || 0
    reioStats.lastCheckTime = stored.lastCheckTime || null
    reioStats.lastCheckResult = stored.lastCheckResult || null
  }
} catch (error) {
  if (!String(error?.message || '').includes('数据库未初始化')) {
    console.error('读取 ReIO 统计失败:', error)
  }
}

/**
 * 获取 ReIO 统计信息
 */
function getReIOStats() {
  return { ...reioStats }
}

/**
 * 从记忆上下文中提取活跃角色
 * @param {string} memoryContext - 记忆上下文
 * @returns {string[]} 角色名列表
 */
function extractActiveCharacters(memoryContext) {
  if (!memoryContext) return []

  const characters = []
  // 解析“人物当前状态”段落中的角色名
  const charMatch = memoryContext.match(/【人物当前状态】([\s\S]*?)(?=【|$)/)
  if (charMatch) {
    const lines = charMatch[1].split('\n')
    for (const line of lines) {
      const nameMatch = line.match(/^[\s-]*([^:：\s]+)[:：]/)
      if (nameMatch) {
        characters.push(nameMatch[1])
      }
    }
  }

  return characters.slice(0, 10)
}

/**
 * 从世界观设定中提取规则
 * @param {string} novelId - 小说 ID
 * @returns {Promise<string[]>} 规则列表
 */
async function extractWorldRules(novelId) {
  if (!novelId) return []

  try {
    const worldviewDAO = require('../database/worldviewDAO')
    const worldview = worldviewDAO.getWorldviewByNovel(novelId)

    if (!worldview || !worldview.rules) return []

    const rulesText = worldview.rules
    const rules = rulesText
      .split(/[\n。；;]/)
      .map(r => r.trim())
      .filter(r => r.length > 5 && r.length < 200)
      .slice(0, 10)

    return rules
  } catch (error) {
    console.error('提取世界观规则失败:', error)
    return []
  }
}

/**
 * ReIO Checker - 检查 AI 生成的内容是否符合要求
 * @param {Object} options
 * @param {string} options.generatedText - AI 生成文本
 * @param {string} options.eventGoal - 当前事件/章节目标
 * @param {string} options.memoryContext - 记忆上下文
 * @param {string[]} options.activeCharacters - 当前活跃角色
 * @param {string[]} options.worldRules - 世界规则约束
 * @param {string} options.novelId - 小说 ID（用于自动提取规则）
 */
async function checkContent({
  generatedText,
  eventGoal,
  memoryContext,
  activeCharacters = [],
  worldRules = [],
  novelId
}) {
  reioStats.totalChecks += 1
  reioStats.lastCheckTime = Date.now()

  if (!generatedText || generatedText.length < 50) {
    const result = { passed: false, issues: ['生成内容过短'], suggestion: '需要更多内容' }
    reioStats.failedChecks += 1
    reioStats.lastCheckResult = result
    try {
      reioStatsDAO.upsertReioStats(reioStats)
    } catch (error) {
      console.error('保存 ReIO 统计失败:', error)
    }
    return result
  }

  // 自动提取活跃角色与世界规则
  if (activeCharacters.length === 0 && memoryContext) {
    activeCharacters = extractActiveCharacters(memoryContext)
  }
  if (worldRules.length === 0 && novelId) {
    worldRules = await extractWorldRules(novelId)
  }

  const { systemPrompt } = promptService.resolvePrompt('reio.check.system')
  const userPrompt = promptService.renderPrompt('reio.check.user', '', {
    eventGoal: eventGoal || '无明确目标',
    memoryContext: memoryContext || '无可用记忆',
    activeCharacters: activeCharacters.length > 0 ? activeCharacters.join('、') : '未指定',
    worldRules: worldRules.length > 0 ? worldRules.map((r, i) => `${i + 1}. ${r}`).join('\n') : '无特殊规则',
    generatedText
  })

  try {
    const response = await llmService.callChatModel({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      maxTokens: 1000
    })

    const result = parseCheckResult(response)

    if (result.passed) {
      reioStats.passedChecks += 1
    } else {
      reioStats.failedChecks += 1
    }

    reioStats.lastCheckResult = result
    try {
      reioStatsDAO.upsertReioStats(reioStats)
    } catch (error) {
      console.error('保存 ReIO 统计失败:', error)
    }
    return result
  } catch (error) {
    console.error('ReIO 检查失败:', error)
    const result = { passed: true, issues: [], warning: '检查服务暂时不可用' }
    reioStats.lastCheckResult = result
    try {
      reioStatsDAO.upsertReioStats(reioStats)
    } catch (dbError) {
      console.error('保存 ReIO 统计失败:', dbError)
    }
    return result
  }
}

/**
 * 解析检查结果 JSON
 */
function parseCheckResult(response) {
  try {
    let jsonStr = response
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    } else {
      const jsonObjMatch = response.match(/\{[\s\S]*\}/)
      if (jsonObjMatch) {
        jsonStr = jsonObjMatch[0]
      }
    }

    const parsed = JSON.parse(jsonStr)

    return {
      passed: Boolean(parsed.passed),
      score: Number(parsed.score) || (parsed.passed ? 8 : 5),
      deviatesFromGoal: Boolean(parsed.deviatesFromGoal),
      hasLogicConflict: Boolean(parsed.hasLogicConflict),
      hasCharacterInconsistency: Boolean(parsed.hasCharacterInconsistency),
      hasWorldRuleViolation: Boolean(parsed.hasWorldRuleViolation),
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      rewriteSuggestion: parsed.rewriteSuggestion || '',
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : []
    }
  } catch (e) {
    const lowerResponse = response.toLowerCase()
    const hasIssues = lowerResponse.includes('问题') ||
      lowerResponse.includes('冲突') ||
      lowerResponse.includes('不一致') ||
      lowerResponse.includes('违反') ||
      (lowerResponse.includes('no') && !lowerResponse.includes('novel'))

    return {
      passed: !hasIssues,
      score: hasIssues ? 5 : 7,
      issues: hasIssues ? ['检查返回了非结构化的问题描述'] : [],
      rawResponse: response
    }
  }
}

module.exports = {
  checkContent,
  getReIOStats,
  extractActiveCharacters,
  extractWorldRules
}
