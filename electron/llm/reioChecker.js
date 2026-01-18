/**
 * ReIO 输出重写模块
 * 实现 StoryWriter 的自检机制：AI 生成后自动检查逻辑一致性
 * 
 * 核心流程：Generate → Check → Rewrite (if needed) → Output
 */

const llmService = require('./llmService')
const reioStatsDAO = require('../database/reioStatsDAO')

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
 * 重置 ReIO 统计
 */
function resetReIOStats() {
  reioStats.totalChecks = 0
  reioStats.passedChecks = 0
  reioStats.failedChecks = 0
  reioStats.totalRewrites = 0
  reioStats.lastCheckTime = null
  reioStats.lastCheckResult = null
  try {
    reioStatsDAO.resetReioStats()
  } catch (error) {
    console.error('重置 ReIO 统计失败:', error)
  }
}

/**
 * 从记忆上下文中提取活跃角色
 * @param {string} memoryContext - 记忆上下文
 * @returns {string[]} 角色名列表
 */
function extractActiveCharacters(memoryContext) {
  if (!memoryContext) return []

  const characters = []
  // 匹配 【人物当前状态】 部分的角色名
  const charMatch = memoryContext.match(/【人物当前状态[^】]*】([\s\S]*?)(?=【|$)/)
  if (charMatch) {
    const lines = charMatch[1].split('\n')
    for (const line of lines) {
      const nameMatch = line.match(/^[\s-]*([^:：\s]+)[:：]/)
      if (nameMatch) {
        characters.push(nameMatch[1])
      }
    }
  }

  return characters.slice(0, 10) // 限制数量
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

    // 解析规则文本
    const rulesText = worldview.rules
    const rules = rulesText
      .split(/[\n。；;]/)
      .map(r => r.trim())
      .filter(r => r.length > 5 && r.length < 200)
      .slice(0, 10)

    return rules
  } catch (error) {
    console.error('提取世界规则失败:', error)
    return []
  }
}

/**
 * ReIO Checker - 检查 AI 生成的内容是否符合要求
 * @param {Object} options
 * @param {string} options.generatedText - AI 生成的文本
 * @param {string} options.eventGoal - 当前事件/章节目标
 * @param {string} options.memoryContext - 记忆上下文（人物状态、历史事件等）
 * @param {string[]} options.activeCharacters - 当前场景活跃角色
 * @param {string[]} options.worldRules - 世界规则约束
 * @param {string} options.novelId - 小说 ID（用于自动提取规则）
 * @returns {Promise<{passed: boolean, issues: string[], suggestion?: string}>}
 */
async function checkContent({
  generatedText,
  eventGoal,
  memoryContext,
  activeCharacters = [],
  worldRules = [],
  novelId
}) {
  reioStats.totalChecks++
  reioStats.lastCheckTime = Date.now()

  if (!generatedText || generatedText.length < 50) {
    const result = { passed: false, issues: ['生成内容过短'], suggestion: '需要更多内容' }
    reioStats.failedChecks++
    reioStats.lastCheckResult = result
    try {
      reioStatsDAO.upsertReioStats(reioStats)
    } catch (error) {
      console.error('保存 ReIO 统计失败:', error)
    }
    return result
  }

  // 自动提取活跃角色
  if (activeCharacters.length === 0 && memoryContext) {
    activeCharacters = extractActiveCharacters(memoryContext)
  }

  // 自动提取世界规则
  if (worldRules.length === 0 && novelId) {
    worldRules = await extractWorldRules(novelId)
  }

  const systemPrompt = `你是一个专业的小说内容审核员，负责检查 AI 生成的小说内容是否符合要求。

你需要从以下几个维度进行检查：

1. **目标一致性**: 内容是否围绕事件/章节目标展开，是否偏题
2. **逻辑连贯性**: 情节发展是否合理，是否存在前后矛盾
3. **角色一致性**: 角色行为是否符合其性格设定，是否突兀
4. **世界观一致性**: 是否违反了已建立的世界规则

请以 JSON 格式返回检查结果：
{
  "passed": true/false,
  "score": 1-10,
  "deviatesFromGoal": true/false,
  "hasLogicConflict": true/false,
  "hasCharacterInconsistency": true/false,
  "hasWorldRuleViolation": true/false,
  "issues": ["问题1", "问题2"],
  "rewriteSuggestion": "具体的修改建议",
  "highlights": ["亮点1", "亮点2"]
}`

  const userPrompt = `请检查以下 AI 生成的小说内容：

【事件/章节目标】
${eventGoal || '无明确目标'}

【记忆上下文（已确认的人物状态和历史事件）】
${memoryContext || '无可用记忆'}

【当前场景活跃角色】
${activeCharacters.length > 0 ? activeCharacters.join('、') : '未指定'}

【世界规则约束】
${worldRules.length > 0 ? worldRules.map((r, i) => `${i + 1}. ${r}`).join('\n') : '无特殊规则'}

【待检查的生成内容】
${generatedText}

请进行全面检查并返回 JSON 格式结果。对于通过的内容，score 应大于 7；对于需要重写的内容，请给出具体的修改建议。`

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
      reioStats.passedChecks++
    } else {
      reioStats.failedChecks++
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
    // 提取 JSON 块
    let jsonStr = response
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    } else {
      // 尝试找到 JSON 对象
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
    // 解析失败时，尝试从文本中提取关键信息
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

/**
 * 请求 AI 重写内容
 */
async function rewriteContent({
  originalText,
  issues,
  suggestion,
  eventGoal,
  memoryContext,
  systemPrompt
}) {
  reioStats.totalRewrites++
  try {
    reioStatsDAO.upsertReioStats(reioStats)
  } catch (error) {
    console.error('保存 ReIO 统计失败:', error)
  }


  const rewritePrompt = `你之前生成的内容经过审核，发现以下问题需要修正：

【发现的问题】
${issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

【修改建议】
${suggestion || '请根据问题进行修正，保持故事连贯性'}

【事件目标】
${eventGoal || '保持情节连贯'}

【记忆约束（不可违反）】
${memoryContext || '无'}

【原始内容】
${originalText}

请重写这段内容，务必：
1. 修正上述所有问题
2. 保持与前文的连贯性
3. 保留原文的精彩之处
4. 只输出修正后的正文，不要任何解释`

  const rewritten = await llmService.callChatModel({
    messages: [
      { role: 'system', content: systemPrompt || '你是一位专业的小说作家，擅长在保持故事连贯性的同时修正问题。' },
      { role: 'user', content: rewritePrompt }
    ],
    temperature: 0.7
  })

  return rewritten?.trim() || originalText
}

/**
 * 完整的 ReIO 流程：生成 -> 检查 -> 重写（如需要）
 */
async function generateWithReIO({
  generate,
  context,
  maxRetries = 2,
  onCheck,
  onRewrite
}) {
  const {
    eventGoal,
    memoryContext,
    activeCharacters,
    worldRules,
    systemPrompt,
    novelId
  } = context

  let content = await generate()
  let rewriteCount = 0
  let checkResult = { passed: true }
  const checkHistory = []

  for (let i = 0; i < maxRetries; i++) {
    checkResult = await checkContent({
      generatedText: content,
      eventGoal,
      memoryContext,
      activeCharacters,
      worldRules,
      novelId
    })

    checkHistory.push({
      attempt: i + 1,
      result: checkResult,
      contentLength: content.length
    })

    // 回调通知
    if (onCheck) {
      onCheck(checkResult, i + 1)
    }

    if (checkResult.passed) {
      break
    }

    console.log(`ReIO 检查未通过 (第 ${i + 1} 次)，分数: ${checkResult.score}，问题:`, checkResult.issues)

    const previousContent = content
    content = await rewriteContent({
      originalText: content,
      issues: checkResult.issues,
      suggestion: checkResult.rewriteSuggestion,
      eventGoal,
      memoryContext,
      systemPrompt
    })

    rewriteCount++

    // 回调通知
    if (onRewrite) {
      onRewrite(previousContent, content, rewriteCount)
    }
  }

  return {
    content,
    checkResult,
    rewriteCount,
    checkHistory,
    stats: getReIOStats()
  }
}

/**
 * 快速一致性检查（轻量级，只检查关键问题）
 */
async function quickConsistencyCheck(generatedText, constraints) {
  if (!constraints || constraints.length === 0) {
    return { passed: true, reason: '无约束条件' }
  }

  const systemPrompt = `你是一个快速审核员。判断以下内容是否违反约束条件。
只回答 YES（符合）或 NO（违反）。
如果回答 NO，在第二行简述违反了哪条约束。`

  const userPrompt = `【约束条件】
${constraints.map((c, i) => `${i + 1}. ${c}`).join('\n')}

【待检查内容】
${generatedText}

是否符合所有约束条件？`

  try {
    const response = await llmService.callChatModel({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      maxTokens: 150
    })

    const lines = response.trim().split('\n')
    const firstLine = lines[0].toUpperCase()
    const passed = firstLine.includes('YES') || firstLine.startsWith('是')

    return {
      passed,
      reason: passed ? '' : (lines[1] || '未说明具体原因')
    }
  } catch (error) {
    return { passed: true, error: error.message }
  }
}

/**
 * 批量检查多段内容
 */
async function batchCheck(contents, context) {
  const results = []
  for (const content of contents) {
    const result = await checkContent({
      generatedText: content,
      ...context
    })
    results.push(result)
  }
  return results
}

module.exports = {
  checkContent,
  rewriteContent,
  generateWithReIO,
  quickConsistencyCheck,
  batchCheck,
  getReIOStats,
  resetReIOStats,
  extractActiveCharacters,
  extractWorldRules
}

