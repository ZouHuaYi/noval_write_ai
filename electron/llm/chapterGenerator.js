const llmService = require('./llmService')
const chapterSnapshotDAO = require('../database/chapterSnapshotDAO')
const chapterGenerationDAO = require('../database/chapterGenerationDAO')
const chapterDAO = require('../database/chapterDAO')
const worldviewDAO = require('../database/worldviewDAO')
const { buildKnowledgeSummary } = require('./knowledgeContext')
const { buildPlanningSummary } = require('./planningContext')
const { getGraphManager } = require('../graph/graphManager')
const { safeParseJSON } = require('../utils/helpers')
const promptService = require('../prompt/promptService')

// 上下文缓存（避免相邻章节重复计算）
// 说明：仅缓存 1-2 章的规划/世界观/图谱摘要，减少重复开销
const CONTEXT_CACHE_TTL = 5 * 60 * 1000
const CONTEXT_CACHE_MAX = 6
const planningContextCache = new Map()
const worldRulesCache = new Map()
const graphContextCache = new Map()

function buildCacheKey(parts = []) {
  return parts.filter(Boolean).join(':')
}

function getCacheValue(cacheMap, key) {
  const cached = cacheMap.get(key)
  if (!cached) return null
  if (Date.now() - cached.updatedAt > CONTEXT_CACHE_TTL) {
    cacheMap.delete(key)
    return null
  }
  return cached.value
}

function setCacheValue(cacheMap, key, value) {
  cacheMap.set(key, { value, updatedAt: Date.now() })
  if (cacheMap.size > CONTEXT_CACHE_MAX) {
    const firstKey = cacheMap.keys().next().value
    if (firstKey) cacheMap.delete(firstKey)
  }
}

function hashText(text) {
  if (!text) return 'empty'
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i)
    hash |= 0
  }
  return String(hash)
}

/**
 * 构建“场景去重”约束（重点解决：同地点反复出现相似情节，读者产生复制感）
 * 说明：这里只做“主场景禁区”提示，允许旧地点路过/点到为止，但不允许承载主要冲突。
 * @param {Object} params
 * @param {string} params.novelId
 * @param {number} params.chapterNumber
 * @param {number} params.recentWindow 最近 N 章作为参考窗口
 * @param {number} params.maxLocations 最多列出多少个“高频地点”
 * @returns {string}
 */
function buildSceneDiversityPrompt({ novelId, chapterNumber, recentWindow = 5, maxLocations = 8 }) {
  const numericChapter = Number(chapterNumber)
  if (!novelId || !Number.isFinite(numericChapter) || numericChapter <= 1) return ''

  try {
    const manager = getGraphManager()
    const graph = manager.getGraph(novelId)
    if (!graph) return ''

    const start = Math.max(1, numericChapter - Number(recentWindow))
    const recentChapters = []
    for (let ch = start; ch <= numericChapter - 1; ch += 1) recentChapters.push(ch)
    if (recentChapters.length === 0) return ''

    const locationNodes = graph.getAllNodes('location') || []
    if (!locationNodes.length) return ''

    // 统计最近窗口内“出现过的地点”，优先挑选：出现章数多、最近出现过的地点
    const candidates = locationNodes
      .map(node => {
        const mentioned = Array.isArray(node.mentionedInChapters) ? node.mentionedInChapters : []
        const inRecentCount = recentChapters.filter(ch => mentioned.includes(ch)).length
        // 兼容旧数据：lastMention 缺失时，用 mentionedInChapters 取最大值兜底
        const fallbackLast = mentioned.length ? Math.max(...mentioned.map(ch => Number(ch) || 0)) : 0
        const lastMention = Number.isFinite(Number(node.lastMention)) ? Number(node.lastMention) : fallbackLast
        return {
          label: (node.label || '').trim(),
          inRecentCount,
          lastMention
        }
      })
      // 只屏蔽“最近窗口”内出现过的地点（哪怕只出现一次，也不建议连续/隔章复用为主场景）
      .filter(item => item.label && item.lastMention >= start && item.lastMention <= numericChapter - 1)
      .sort((a, b) => {
        if (b.lastMention !== a.lastMention) return b.lastMention - a.lastMention
        return b.inRecentCount - a.inRecentCount
      })
      .slice(0, Math.max(1, Number(maxLocations)))

    if (candidates.length === 0) return ''

    const labels = candidates.map((c, idx) => `${idx + 1}. ${c.label}`).join('\n')

    return [
      '【反复制硬约束（非常重要）】',
      `- 最近${recentWindow}章高频地点（禁止作为本章“主场景/开场/高潮场景”，可以路过但不能承载主要冲突）：`,
      labels,
      '- 本章必须选择一个“最近窗口内未高频出现”的新主场景，让核心冲突/关键线索/交易发生在新地点。',
      '- 如果剧情必须回到旧地点：必须发生不可逆变化，且冲突形态要变（例如偷听→公开对峙，搜索→交易，躲藏→追逐），避免“同地点不同台词”的复制感。'
    ].join('\n')
  } catch (error) {
    console.error('构建场景去重约束失败:', error)
    return ''
  }
}


// 章节字数与分块配置（默认与上限）
// 统一收敛为 1200 左右，强制控制章节总字数
// 流水线目标字数上调到 1500-2000，默认取中值 1800
const DEFAULT_TARGET_WORDS = 1800
const MAX_TARGET_WORDS = 2000

/**
 * 统计中文字数（包括标点）
 * @param {string} text 
 * @returns {number}
 */
function countWords(text) {
  if (!text) return 0
  // 移除空白字符后统计长度
  return text.replace(/\s/g, '').length
}

function normalizeTargetWords(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return DEFAULT_TARGET_WORDS
  }
  return Math.min(Math.round(numeric), MAX_TARGET_WORDS)
}

function resolveParagraphConfig(targetWords, overrides = {}) {
  const normalizedTargetWords = normalizeTargetWords(targetWords)
  // 段落字数固定区间，避免出现冗长水字
  // 提升段落区间以匹配 1500-2000 总字数
  const minParagraphWords = 250
  const maxParagraphWords = 500

  const overrideMin = Number(overrides.minParagraphWords)
  const overrideMax = Number(overrides.maxParagraphWords)
  const effectiveMin = Number.isFinite(overrideMin) && overrideMin > 0
    ? Math.max(minParagraphWords, Math.min(overrideMin, maxParagraphWords))
    : minParagraphWords
  const effectiveMax = Number.isFinite(overrideMax) && overrideMax > 0
    ? Math.max(effectiveMin, Math.min(overrideMax, maxParagraphWords))
    : maxParagraphWords
  const safeMax = Math.max(effectiveMax, effectiveMin)

  const avgParagraphWords = (effectiveMin + safeMax) / 2
  const computedMaxParagraphs = Math.ceil(normalizedTargetWords / avgParagraphWords)
  const overrideParagraphs = Number(overrides.maxParagraphs)
  // 允许更多段落，保证总字数能达到目标区间
  const effectiveMaxParagraphs = Number.isFinite(overrideParagraphs) && overrideParagraphs > 0
    ? Math.min(Math.max(Math.round(overrideParagraphs), 3), 8)
    : Math.min(Math.max(computedMaxParagraphs, 3), 8)

  return {
    normalizedTargetWords,
    minParagraphWords: effectiveMin,
    maxParagraphWords: safeMax,
    maxParagraphs: effectiveMaxParagraphs
  }
}

// 随机扰动段落长度，打破均匀节奏（增强人味）
function pickParagraphRange(config) {
  const roll = Math.random()
  if (roll < 0.15) return [80, 160]
  if (roll < 0.25) return [450, 650]
  return [config.minParagraphWords, config.maxParagraphWords]
}

/**
 * 获取知识图谱上下文摘要
 * @param {string} novelId 
 * @returns {Promise<string>}
 */
/**
 * 获取知识图谱上下文摘要 (智能筛选版)
 * 优先包含：
 * 1. 计划中提及的实体
 * 2. 已写内容中提及的实体
 * 3. 具有特殊状态(如"死亡","损坏")的实体
 * @param {string} novelId 
 * @param {string} contextText -用于匹配的上下文文本(计划+已写内容)
 * @returns {Promise<string>}
 */
async function getGraphContext(novelId, contextText = '') {
  try {
    const cacheKey = buildCacheKey(['graph', novelId, hashText(contextText)])
    const cached = getCacheValue(graphContextCache, cacheKey)
    if (cached != null) {
      return cached
    }
    const manager = getGraphManager()
    const graphData = manager.exportForVisualization(novelId)
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
      return ''
    }

    const { nodes, edges } = graphData

    // 1. 提取上下文关键词 (简单的 N-gram 或分词匹配)
    // 这里做个简单的包含匹配
    const textToMatch = contextText || ''
    
    // 2. 节点评分
    const scoredNodes = nodes.map(node => {
      let score = 0
      const label = node.data?.label || ''
      const desc = node.data?.description || ''
      const status = node.data?.properties?.status

      // 规则A: 上下文中提及 (+10分)
      if (textToMatch.includes(label)) {
        score += 10
      }

      // 规则B: 有特殊状态 (+5分，防止死人复活等)
      if (status) {
        score += 5
      }

      // 规则C: 描述中有提及 (+1分)
      // if (desc && textToMatch.includes(desc.slice(0, 5))) score += 1

      return { node, score }
    })

    // 3. 排序并筛选
    // 优先取分数高的，如果分数相同，取原本顺序
    scoredNodes.sort((a, b) => b.score - a.score)

    // 取前 20 个高关联节点 (数量可调整)
    const topNodes = scoredNodes
      .filter(item => item.score > 0 || scoredNodes.indexOf(item) < 10) // 至少保留前10个基础节点，或有分数的
      .slice(0, 20)
      .map(item => item.node)

    // 4. 获取相关边
    // 只保留两个端点都在 topNodes 中的边
    const nodeIds = new Set(topNodes.map(n => n.id))
    const relevantEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))

    // 5. 格式化输出
    const formatProps = (props) => {
        if (!props) return ''
        const parts = []
        if (props.status) parts.push(`状态:${props.status}`)
        if (props.condition) parts.push(`状况:${props.condition}`)
        if (props.owner) parts.push(`归属:${props.owner}`)
        if (props.currentLocation) parts.push(`位置:${props.currentLocation}`)
        if (props.powerLevel) parts.push(`层级:${props.powerLevel}`)
        return parts.length > 0 ? ` [${parts.join(', ')}]` : ''
    }

    const characters = topNodes
      .filter(n => n.data?.type === 'character')
      .map(n => `- ${n.data.label}${formatProps(n.data.properties)}: ${n.data.description || '无描述'}`)
      .join('\n')
    
    const locations = topNodes
      .filter(n => n.data?.type === 'location')
      .map(n => `- ${n.data.label}${formatProps(n.data.properties)}: ${n.data.description || '无描述'}`)
      .join('\n')

    const items = topNodes
      .filter(n => n.data?.type === 'item')
      .map(n => `- ${n.data.label}${formatProps(n.data.properties)}: ${n.data.description || '无描述'}`)
      .join('\n')

    const relations = relevantEdges
      .slice(0, 15)
      .map(e => `- ${e.data?.label || '关系'}`)
      .join('\n')

    let summary = ''
    if (characters) summary += `【角色状态】\n${characters}\n`
    if (locations) summary += `【地点状态】\n${locations}\n`
    if (items) summary += `【物品状态】\n${items}\n`
    if (relations) summary += `【当前关系】\n${relations}\n`
    
    const result = summary || ''
    // 缓存图谱摘要（相邻章节/重试可复用）
    setCacheValue(graphContextCache, cacheKey, result)
    return result
  } catch (error) {
    console.error('获取图谱上下文失败:', error)
    return ''
  }
}

/**
 * 更新知识图谱（增量抽取）
 * @param {string} novelId 
 * @param {number} chapterNumber - 章节号（数字）
 * @param {string} content - 当前完整内容
 * @param {string} previousContent - 上一次的内容（用于增量更新）
 */
async function updateGraph(novelId, chapterNumber, content, previousContent = '', options = {}) {
  try {
    const manager = getGraphManager()
    // 传递章节号和 previousContent，让 graphManager 判断是否增量更新
    await manager.onChapterUpdate(novelId, chapterNumber, content, previousContent, { modelSource: options?.modelSource })
    console.log(`[分块生成] 段落已更新到图谱 (第 ${chapterNumber} 章)`)
  } catch (error) {
    console.error('??????:', error)
    // ??????????????????????
    if (options?.modelSource === 'pipeline') {
      throw error
    }
    // ???/??????????
  }
}


/**
 * 构建单段落生成 Prompt
 */
function buildParagraphPrompt({
  novelTitle,
  chapterTitle,
  chapterNumber,
  chapterSoFar,
  knowledgeContext,
  planningContext,
  
  graphContext,
  extraPrompt,
  worldRules,
  emotionNode,
  lastChapterContentEnd,
  // 单段目标字数区间与段落配置保持一致
  targetWords = [250, 500]
}) {
  const emotionLevel = Number.isFinite(Number(emotionNode?.level)) ? Number(emotionNode.level) : 50
  const emotionLabel = emotionNode?.label || '平稳'
  const breathRequirement = emotionNode?.isBreath
    ? '本章为缓冲章：降低冲突密度，增加关系互动/细节观察/情感停顿，避免持续高压推进。'
    : '本章为推进章：可以保持紧张与节奏，但需避免持续同类冲突。'

  const outputRequirements = `
请生成本章的下一个段落，要求：
【硬约束】
1) 字数控制在 ${targetWords[0]}-${targetWords[1]} 字之间（宁可短一点，不要硬凑满）
2) 必须紧密承接上文，不重复已写内容，不复述背景
3) 只能写“正在发生的事”，禁止总结、解释、讲道理
4) 禁止提纲式小标题、禁止分点、禁止“场景一/小结”式结构
5) 禁止连续使用相同句式（例如反复“他攥紧/他想起/他必须”）
6) 段落内最多出现 1 次“必须/得/立刻/赶紧”类催促词（尽量不用）
7) 同一段落内“黑西装/脚步声/黄铜”这类压迫符号最多出现 1 次，避免复读
8) 人物动作、对话、心理活动等不要自我重复，避免重复叙述或使用相同句式
9) 人物动作、对话等带有性格特征，人物色彩鲜明
10）情节紧凑，不拖沓，不啰嗦
11）写得像人类作者，每段必须推进新信息，禁止复述，禁止模板句，减少意象复读

【风格约束（反AI关键）】
1) 允许出现 0-1 处比喻，但必须是具体物象类（不许抽象抒情），能删就删
2) 禁止直接点名情绪词（如“紧张/压抑/恐惧/愤怒”），用动作与事实表现
3) 必须包含 1 句“非推进剧情但真实”的句子：
   - 这句必须与人物习惯/关系/错误有关
   - 禁止只是环境装饰（例如茶垢/糖霜/天气描写）

【悬疑与可读性】
1) 段落里至少出现 1 个明确风险（具体威胁/损失/后果），不能只写“感觉不妙”
2) 段落里至少出现 1 个“关系信号”（合作/试探/背离/交换条件），必须可持续
3) 章节里至少有 1 段表达不完整或被打断，让读者短暂误解人物动机
4) 线索出现必须伴随代价（丢时间/丢证据/暴露行踪/伤口/信任受损/被误会）
5) 段落不要自我重复，重复叙述导致节奏拖沓

【段落收束】
1) 段落结尾：
   - 70% 概率给出下一步具体行动或时间点
   - 30% 概率只留下一个未说破的决定（不写“明天必须去XX”也能收住）
   你自行判断当前段落属于哪一种。
2）章末留钩子，但不要强行升高强度

只输出正文内容，不要任何解释。`

  return promptService.renderPrompt('chapter.generator.user', '', {
    novelTitle: novelTitle || '未命名',
    chapterNumber: chapterNumber ?? '?',
    chapterTitle: chapterTitle || '未命名',
    lastChapterContentEnd: lastChapterContentEnd || '无',
    chapterSoFar: chapterSoFar || '无',
    planningContext: planningContext || '无',
    knowledgeContext: knowledgeContext || '无设定数据',
    graphContext: graphContext || '无',
    worldRules: worldRules || '无世界观数据',
    emotionLabel,
    emotionLevel,
    breathRequirement,
    extraPrompt: extraPrompt || '无',
    outputRequirements
  })
}

/**
 * 生成单个段落（300-500字）
 * @returns {Promise<string>} 生成的段落文本
 */
async function generateParagraph({
  novelTitle,
  chapterTitle,
  chapterNumber,
  chapterSoFar,
  knowledgeContext,
  planningContext,
  graphContext,
  extraPrompt,
  systemPrompt,
  worldRules,
  lastChapterContentEnd,
  // 单段目标字数区间与段落配置保持一致
  targetWords = [250, 500],
  configOverride
}) {
  const override = promptService.getPromptOverride('chapter.generator.system')
  const defaultPrompt = promptService.resolvePrompt('chapter.generator.system').systemPrompt
  const overridePrompt = override?.systemPrompt?.trim()
  const finalSystemPrompt = overridePrompt || systemPrompt || defaultPrompt || ''
  const userPrompt = buildParagraphPrompt({
    novelTitle,
    chapterTitle,
    chapterNumber,
    chapterSoFar,
    knowledgeContext,
    planningContext,
    graphContext,
    extraPrompt,
    worldRules,
    lastChapterContentEnd,
    targetWords
  })

  const content = await llmService.callChatModel({
    messages: [
      { role: 'system', content: finalSystemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.75, // 高温度，保持创意和灵性
    // 适配更长段落输出，避免提前截断
    maxTokens: 1500,
    configOverride
  })

  return content?.trim() || ''
}

/**
 * 校验段落一致性
 * @returns {Promise<{isValid: boolean, issues: Array, fixedParagraph: string}>}
 */
async function validateParagraph({
  paragraph,
  chapterSoFar,
  graphContext,
  extraPrompt,
  configOverride
}) {
  if (!paragraph || paragraph.trim().length === 0) {
    return { isValid: true, issues: [], fixedParagraph: '' }
  }

  const { systemPrompt } = promptService.resolvePrompt('chapter.validateParagraph.system')
  const userPrompt = promptService.renderPrompt('chapter.validateParagraph.user', '', {
    chapterSoFar: chapterSoFar || '无',
    graphContext: graphContext || '无',
    paragraph,
    extraConstraint: extraPrompt ? `【额外约束】\n${extraPrompt}` : ''
  })

  try {
    const response = await llmService.callChatModel({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2, // 低温度，严谨校验
      maxTokens: 2000,
      configOverride
    })

    const parsed = safeParseJSON(response)

    if (!parsed) {
      console.warn('[分块生成] 段落校验结果解析失败，默认通过')
      return { isValid: true, issues: [], fixedParagraph: '' }
    }

    return {
      isValid: parsed.isValid !== false,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      fixedParagraph: parsed.fixedParagraph || ''
    }
  } catch (error) {
    console.error('[分块生成] 段落校验失败:', error)
    return { isValid: true, issues: [], fixedParagraph: '' }
  }
}

// 审查章节是否存在明显 AI 痕迹
async function reviewChapterStyle({ content, configOverride }) {
  if (!content) return { needRewrite: false, issues: [], suggestion: '' }

  const { systemPrompt } = promptService.resolvePrompt('chapter.reviewStyle.system')
  const userPrompt = promptService.renderPrompt('chapter.reviewStyle.user', '', {
    content
  })

  try {
    const response = await llmService.callChatModel({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      maxTokens: 800,
      configOverride
    })
    const parsed = safeParseJSON(response)
    if (!parsed) return { needRewrite: false, issues: [], suggestion: '' }
    return {
      needRewrite: Boolean(parsed.needRewrite),
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggestion: parsed.suggestion || ''
    }
  } catch (error) {
    console.error('[分块生成] 章节风格审查失败:', error)
    return { needRewrite: false, issues: [], suggestion: '' }
  }
}

// 反 AI 风格重写（保留事实与剧情）
async function rewriteChapterStyle({ content, issues = [], configOverride }) {
  if (!content) return ''

  const { systemPrompt } = promptService.resolvePrompt('chapter.rewriteStyle.system')
  const userPrompt = promptService.renderPrompt('chapter.rewriteStyle.user', '', {
    issues: issues.length ? issues.map(item => `- ${item}`).join('\n') : '- 无具体问题，但需要降 AI 痕迹',
    content
  })

  const response = await llmService.callChatModel({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.4,
    maxTokens: 2000,
    configOverride
  })

  return response?.trim() || ''
}

// 章节反 AI 清洗入口（仅在需要时重写）
async function applyAntiAiPolish({ novelId, chapterId, content, configOverride }) {
  if (!novelId || !chapterId || !content) return { changed: false }

  const review = await reviewChapterStyle({ content, configOverride })
  if (!review.needRewrite) return { changed: false, issues: review.issues }

  const rewritten = await rewriteChapterStyle({ content, issues: review.issues, configOverride })
  if (!rewritten) return { changed: false, issues: review.issues }

  const chapter = await chapterDAO.getChapterById(chapterId)
  if (chapter) {
    // 保存重写前快照，便于回退
    createSnapshot(novelId, chapter, 'anti_ai_rewrite')
  }
  await chapterDAO.updateChapter(chapterId, { content: rewritten })

  return { changed: true, issues: review.issues }
}

async function buildGenerationContext({ novelId, chapterId }) {
  const chapter = await chapterDAO.getChapterById(chapterId)
  if (!chapter) {
    throw new Error('章节不存在')
  }
  const chapterNumber = chapter.chapterNumber ?? null

  const planningCacheKey = buildCacheKey(['planning', novelId, chapterNumber])
  let planningContext = getCacheValue(planningContextCache, planningCacheKey)
  if (planningContext == null) {
    planningContext = chapterNumber != null
      ? buildPlanningSummary({ novelId, chapterNumber })
      : ''
    // 缓存规划摘要（相邻章节可复用）
    setCacheValue(planningContextCache, planningCacheKey, planningContext)
  }

  // 获取世界观设定，规则设置
  const worldRulesCacheKey = buildCacheKey(['worldRules', novelId])
  let worldRules = getCacheValue(worldRulesCache, worldRulesCacheKey)
  if (worldRules == null) {
    const worldview = worldviewDAO.getWorldviewByNovel(novelId)
    worldRules = `${worldview?.worldview || '无世界观数据'}\n${worldview?.rules || '无规则数据'}`
    // 缓存世界观规则（多章共享）
    setCacheValue(worldRulesCache, worldRulesCacheKey, worldRules)
  }
  // 读取情绪曲线配置
  const planningDAO = require('../database/planningDAO')
  const planningMeta = planningDAO.getPlanningMeta(novelId) || {}
  const emotionArc = Array.isArray(planningMeta.emotionArc) ? planningMeta.emotionArc : []
  const emotionNode = emotionArc.find(item => Number(item.chapter) === Number(chapterNumber)) || null
  // 获取上一章节最后一段内容（更有上下文意义）
  const lastChapter = chapterNumber > 1 ? await chapterDAO.getChapterByNovelAndNumber(novelId, chapterNumber - 1) : null
  const lastChapterContent = lastChapter?.content || ''
  // 按段落分割，取最后一段（非空段落）
  let lastChapterContentEnd = ''
  if (lastChapterContent) {
    const paragraphs = lastChapterContent.split(/\n\n+/).filter(p => p.trim().length > 0)
    lastChapterContentEnd = paragraphs.length > 0 ? paragraphs[paragraphs.length - 1].trim() : ''
    // 如果最后一段太短（少于 300 字），尝试取最后两段
    if (lastChapterContentEnd.length < 300 && paragraphs.length > 1) {
      lastChapterContentEnd = paragraphs.slice(-2).join('\n\n').trim()
    }
    // 如果太长（超过 800 字），截取最后 800 字
    if (lastChapterContentEnd.length > 800) {
      lastChapterContentEnd = lastChapterContentEnd.slice(-800)
    }
  }

  // 场景去重约束：尽量避免“同地点重复演类似戏”，降低读者的复制感
  const sceneDiversityPrompt = buildSceneDiversityPrompt({
    novelId,
    chapterNumber,
    recentWindow: 5,
    maxLocations: 8
  })

  return {
    chapter,
    chapterNumber,
    planningContext,
    worldRules,
    lastChapterContentEnd,
    emotionNode,
    sceneDiversityPrompt
  }
}

function ensureGeneration(novelId, chapterId, options) {
  const existing = chapterGenerationDAO.getGenerationByChapter(chapterId)
  if (existing) return existing
  return chapterGenerationDAO.createGeneration({
    novelId,
    chapterId,
    chunkSize: options.chunkSize,
    maxChunks: options.maxChunks
  })
}

function createSnapshot(novelId, chapter, reason) {
  return chapterSnapshotDAO.createSnapshot({
    novelId,
    chapterId: chapter.id,
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    content: chapter.content,
    reason
  })
}

/**
 * 分块生成章节内容
 * 核心流程：循环生成段落 -> 校验 -> 更新图谱 -> 拼接
 */
async function generateChapterChunks({
  novelId,
  chapterId,
  novelTitle,
  extraPrompt,
  systemPrompt,
  targetWords = DEFAULT_TARGET_WORDS, // 目标总字数
  minParagraphWords,
  maxParagraphWords,
  maxParagraphs, // 最大段落数
  maxRetries = 2, // 每段最大重试次数
  validateMode = 'per_paragraph', // 校验模式：per_paragraph | final
  configOverride,
  modelSource
}) {
  if (!novelId || !chapterId) {
    throw new Error('生成章节需要 novelId 与 chapterId')
  }

  const paragraphConfig = resolveParagraphConfig(targetWords, {
    minParagraphWords,
    maxParagraphWords,
    maxParagraphs
  })

  console.log(`[分块生成] ========== 开始生成章节 ==========`)
  console.log(`[分块生成] 章节ID: ${chapterId}, 小说ID: ${novelId}`)
  console.log(`[分块生成] 目标字数: ${paragraphConfig.normalizedTargetWords}`)
  console.log(`[分块生成] 分块配置: ${paragraphConfig.minParagraphWords}-${paragraphConfig.maxParagraphWords} 字/段，最多 ${paragraphConfig.maxParagraphs} 段`)

  let generationContext
  try {
    generationContext = await buildGenerationContext({ novelId, chapterId })
  } catch (error) {
    console.error(`[分块生成] ❌ 构建生成上下文失败:`, error)
    throw error
  }
  const { chapter, chapterNumber, planningContext, worldRules, lastChapterContentEnd, emotionNode, sceneDiversityPrompt } = generationContext

  // 将“反复制”约束合并进 extraPrompt（避免改动 prompt 模板，且 pipeline/workbench 都能生效）
  const finalExtraPrompt = [extraPrompt, sceneDiversityPrompt].filter(Boolean).join('\n\n')
  // 兼容旧代码路径：后续若继续读取 extraPrompt，这里统一指向合并后的版本
  extraPrompt = finalExtraPrompt
  console.log(`[分块生成] 章节号: ${chapterNumber}, 标题: ${chapter.title}`)
  console.log(`[分块生成] 规划上下文长度: ${planningContext?.length || 0} 字符`)
  console.log(`[分块生成] 世界规则长度: ${worldRules?.length || 0} 字符`)
  console.log(`[分块生成] 上一章结尾长度: ${lastChapterContentEnd?.length || 0} 字符`)
  
  // 构建知识上下文
  const knowledgeContext = buildKnowledgeSummary({
    novelId,
    types: ['character', 'location', 'timeline', 'plot'],
    maxItems: 12,
    currentChapter: chapterNumber,
    maxChars: 1200
  })
  console.log(`[分块生成] 知识上下文长度: ${knowledgeContext?.length || 0} 字符`)

  // 创建生成前快照
  createSnapshot(novelId, chapter, 'pre_generate')

  // 初始化
  const paragraphs = []
  let chapterSoFar = chapter.content || '' // 保留已有内容
  console.log(`[分块生成] 已有内容长度: ${chapterSoFar?.length || 0} 字符`)
  
  // 初始化图谱上下文（包含计划和已有内容）
  let graphContext
  try {
    graphContext = await getGraphContext(novelId, `${planningContext}\n${chapterSoFar}`)
    console.log(`[分块生成] 图谱上下文长度: ${graphContext?.length || 0} 字符`)
  } catch (error) {
    console.error(`[分块生成] ⚠️ 获取图谱上下文失败:`, error)
    graphContext = ''
  }
  let paragraphIndex = 0
  
  // 计算总上下文大小（用于监控 token 使用）
  const totalContextSize = (planningContext?.length || 0) + (worldRules?.length || 0) + 
    (lastChapterContentEnd?.length || 0) + (knowledgeContext?.length || 0) + (graphContext?.length || 0)
  console.log(`[分块生成] 📊 总上下文大小: ${totalContextSize} 字符 (预估 token: ${Math.ceil(totalContextSize / 2)})`)

  // 循环生成段落
  while (countWords(chapterSoFar) < paragraphConfig.normalizedTargetWords && paragraphIndex < paragraphConfig.maxParagraphs) {
    paragraphIndex++
    console.log(`[分块生成] 生成第 ${paragraphIndex} 段...`)

    // 1. 生成一段（长度带扰动，避免节奏过于平均）
    const paragraphRange = pickParagraphRange(paragraphConfig)
    let paragraph = await generateParagraph({
      novelTitle,
      chapterTitle: chapter.title,
      chapterNumber,
      chapterSoFar,
      knowledgeContext,
      planningContext,
      graphContext,
      extraPrompt: finalExtraPrompt,
      systemPrompt,
      worldRules,
      emotionNode,
      lastChapterContentEnd,
      targetWords: paragraphRange,
      configOverride
    })

    if (!paragraph || paragraph.trim().length === 0) {
      console.warn(`[分块生成] 第 ${paragraphIndex} 段生成为空，尝试重新生成`)
      continue
    }

    // 2. 校验段落
    let finalParagraph = paragraph
    let validation = { isValid: true, issues: [], fixedParagraph: '' }

    if (validateMode === 'per_paragraph') {
      validation = await validateParagraph({
        paragraph,
        chapterSoFar,
        graphContext,
        extraPrompt: finalExtraPrompt,
        configOverride
      })

      // 3. 处理校验结果
      if (validation.fixedParagraph && validation.fixedParagraph.trim().length > 0) {
        // 有修正版本，使用修正后的
        console.log(`[分块生成] 第 ${paragraphIndex} 段已修正`)
        finalParagraph = validation.fixedParagraph
      } else if (!validation.isValid) {
        // 校验不通过且无修正，尝试重试
        console.log(`[分块生成] 第 ${paragraphIndex} 段校验不通过，尝试重试...`)
        for (let retry = 0; retry < maxRetries; retry++) {
          const retryRange = pickParagraphRange(paragraphConfig)
          paragraph = await generateParagraph({
            novelTitle,
            chapterTitle: chapter.title,
            chapterNumber,
            chapterSoFar,
            knowledgeContext,
            planningContext,
            graphContext,
            extraPrompt: `${extraPrompt || ''}\n【上次问题】${validation.issues.map(i => i.description).join('; ')}`,
            systemPrompt,
            worldRules,
            emotionNode,
            lastChapterContentEnd,
            targetWords: retryRange,
            configOverride
          })

          validation = await validateParagraph({
            paragraph,
            chapterSoFar,
            graphContext,
            extraPrompt: finalExtraPrompt,
            configOverride
          })

          if (validation.isValid || (validation.fixedParagraph && validation.fixedParagraph.trim().length > 0)) {
            finalParagraph = validation.fixedParagraph || paragraph
            console.log(`[分块生成] 第 ${paragraphIndex} 段重试成功`)
            break
          }
        }
      }
    }

    // 4. 先累加段落
    const previousChapterContent = paragraphs.join('\n\n') // 之前的内容
    paragraphs.push(finalParagraph)
    chapterSoFar = paragraphs.join('\n\n') // 当前完整内容

    // 5. 更新图谱（增量抽取）
    // 传递章节号、当前累计内容、上一次内容（用于增量更新）
    await updateGraph(novelId, chapterNumber, chapterSoFar, previousChapterContent, { modelSource })

    // 6. 更新图谱上下文供下一段使用 (加入新生成的内容作为上下文)
    graphContext = await getGraphContext(novelId, `${planningContext}\n${chapterSoFar}`)
    
    console.log(`[分块生成] 第 ${paragraphIndex} 段完成，当前总字数: ${countWords(chapterSoFar)}`)
  }

  // 将原有内容和新生成内容合并
  const existingContent = chapter.content || ''
  let newContent = existingContent 
    ? existingContent + '\n\n' + paragraphs.join('\n\n')
    : paragraphs.join('\n\n')

  if (validateMode === 'final') {
    // 最终章节校验（减少每段校验开销）
    const finalGraphContext = await getGraphContext(novelId, `${planningContext}\n${newContent}`)
    const finalValidation = await validateParagraph({
      paragraph: newContent,
      chapterSoFar: '',
      graphContext: finalGraphContext,
      extraPrompt: finalExtraPrompt,
      configOverride
    })

    if (finalValidation.fixedParagraph && finalValidation.fixedParagraph.trim().length > 0) {
      // 使用修正后的章节内容
      newContent = finalValidation.fixedParagraph.trim()
      console.log('[分块生成] 已应用最终章节修正')
    }
  }

  // 更新到章节
  await chapterDAO.updateChapter(chapter.id, { content: newContent })

  console.log(`[分块生成] 章节生成完成，总段落数: ${paragraphs.length}，总字数: ${countWords(newContent)}`)

  return {
    chapter: {
      ...chapter,
      content: newContent
    },
    status: 'completed',
    paragraphCount: paragraphs.length,
    totalWords: countWords(newContent),
    contextSummary: {
      knowledgeContext,
      planningContext
    }
  }
}

function getGenerationStatus(chapterId) {
  return chapterGenerationDAO.getGenerationByChapter(chapterId)
}

function resetGeneration(chapterId) {
  chapterGenerationDAO.deleteGeneration(chapterId)
  return { success: true }
}

module.exports = {
  generateChapterChunks,
  applyAntiAiPolish,
  getGenerationStatus,
  resetGeneration,
  // 导出用于单独调用
  generateParagraph,
  validateParagraph,
  getGraphContext
}
