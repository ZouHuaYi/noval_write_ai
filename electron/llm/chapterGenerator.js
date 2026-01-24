const llmService = require('./llmService')
const chapterSnapshotDAO = require('../database/chapterSnapshotDAO')
const chapterGenerationDAO = require('../database/chapterGenerationDAO')
const chapterDAO = require('../database/chapterDAO')
const worldviewDAO = require('../database/worldviewDAO')
const { buildKnowledgeSummary } = require('./knowledgeContext')
const { buildPlanningSummary } = require('./planningContext')
const { getGraphManager } = require('../graph/graphManager')
const { safeParseJSON } = require('../utils/helpers')

const formatSection = (title, content) => `【${title}】\n${content || '无'}\n`

// 章节字数与分块配置（默认与上限）
// 统一收敛为 1200 左右，强制控制章节总字数
const DEFAULT_TARGET_WORDS = 1200
const MAX_TARGET_WORDS = 1200

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
  const minParagraphWords = 200
  const maxParagraphWords = 400

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
  const effectiveMaxParagraphs = Number.isFinite(overrideParagraphs) && overrideParagraphs > 0
    ? Math.min(Math.max(Math.round(overrideParagraphs), 3), 6)
    : Math.min(Math.max(computedMaxParagraphs, 3), 6)

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
    
    return summary || ''
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
async function updateGraph(novelId, chapterNumber, content, previousContent = '') {
  try {
    const manager = getGraphManager()
    // 传递章节号和 previousContent，让 graphManager 判断是否增量更新
    await manager.onChapterUpdate(novelId, chapterNumber, content, previousContent)
    console.log(`[分块生成] 段落已更新到图谱 (第 ${chapterNumber} 章)`)
  } catch (error) {
    console.error('更新图谱失败:', error)
    // 图谱更新失败不阻塞生成流程
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
  lastChapterContentEnd,
  targetWords = [300, 500]
}) {
  return [
    formatSection('小说信息', `标题：${novelTitle || '未命名'}\n章节：第 ${chapterNumber ?? '?'} 章 · ${chapterTitle || '未命名'}`),
    formatSection('上一章节结尾', lastChapterContentEnd || '无'),
    formatSection('本章已写内容', chapterSoFar || '无'),
    formatSection('章节计划', planningContext || '无'),
    formatSection('知识与设定', knowledgeContext || '无设定数据'),
    formatSection('图谱上下文', graphContext || '无'),
    formatSection('世界观与规则', worldRules || '无世界观数据'),
    formatSection('作者补充要求', extraPrompt || '无'),
    formatSection('输出要求', `
请生成本章的下一个段落，要求：
【硬约束】
1) 字数控制在 ${targetWords[0]}-${targetWords[1]} 字之间（宁可短一点，不要硬凑满）
2) 必须紧密承接上文，不重复已写内容，不复述背景
3) 只能写“正在发生的事”，禁止总结、解释、讲道理
4) 禁止提纲式小标题、禁止分点、禁止“场景一/小结”式结构
5) 禁止连续使用相同句式（例如反复“他攥紧/他想起/他必须”）
6) 段落内最多出现 1 次“必须/得/立刻/赶紧”类催促词（尽量不用）
7) 同一段落内“黑西装/脚步声/黄铜”这类压迫符号最多出现 1 次，避免复读

【风格约束（反AI关键）】
8) 允许出现 0-1 处比喻，但必须是具体物象类（不许抽象抒情），能删就删
9) 禁止直接点名情绪词（如“紧张/压抑/恐惧/愤怒”），用动作与事实表现
10) 必须包含 1 句“非推进剧情但真实”的句子：
   - 这句必须与人物习惯/关系/错误有关
   - 禁止只是环境装饰（例如茶垢/糖霜/天气描写）

【悬疑与可读性】
11) 段落里至少出现 1 个明确风险（具体威胁/损失/后果），不能只写“感觉不妙”
12) 段落里至少出现 1 个“关系信号”（合作/试探/背离/交换条件），必须可持续
13) 至少有 1 句话表达不完整或被打断，让读者短暂误解人物动机
14) 线索出现必须伴随代价（丢时间/丢证据/暴露行踪/伤口/信任受损/被误会）

【段落收束】
15) 段落结尾：
   - 70% 概率给出下一步具体行动或时间点
   - 30% 概率只留下一个未说破的决定（不写“明天必须去XX”也能收住）
   你自行判断当前段落属于哪一种。

只输出正文内容，不要任何解释。`)
  ].join('\n')
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
  targetWords = [300, 500],
  configOverride
}) {
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
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.75, // 高温度，保持创意和灵性
    maxTokens: 1000,
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

  const systemPrompt = `你是小说一致性审校AI。你只负责检查"硬性矛盾"，并进行最小修改修复。

【重要规则】
1. 只修硬性冲突（角色设定矛盾、时间线错误、地点冲突、关系冲突、逻辑断裂）
2. 不要润色文风，不要改写成更普通的表达
3. 不要增加额外剧情，不要删除有效内容
4. 修复时保留原段落的风格与节奏，只做最小必要修改

【输出要求】
你必须输出严格 JSON，不要输出任何额外文字。
如果没有发现硬性矛盾，isValid 设为 true，fixedParagraph 留空。`

  const userPrompt = `【已生成章节内容】
${chapterSoFar || '无'}

【知识图谱/已知设定】
${graphContext || '无'}

【新生成段落（待校验）】
${paragraph}

${extraPrompt ? `【额外约束】\n${extraPrompt}` : ''}

请输出 JSON：
{
  "isValid": true或false,
  "issues": [{"type":"角色冲突|时间冲突|逻辑断裂|地点冲突|关系冲突","description":"问题描述","suggestedFix":"修复建议"}],
  "fixedParagraph": "如需修复，请给出修复后的完整段落；若无需修复则为空字符串"
}`

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

  const systemPrompt = `你是小说质量审校助手，只检查 AI 痕迹并输出 JSON。
不要改写正文，只给出是否需要重写与问题列表。`
  const userPrompt = `请审查下面章节内容是否存在：
1. 提纲式小标题扩写
2. 高频模板句或局部复读
3. 直接点名情绪（如“压抑/紧张”）
4. 参数化数字点缀（无意义数值）
5. 时间戳规律重复

只输出 JSON：
{
  "needRewrite": true/false,
  "issues": ["问题描述"],
  "suggestion": "一句话修复建议"
}

章节内容：
${content}`

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

  const systemPrompt = `你是小说修订助手，目标是降低 AI 痕迹。
你必须保留所有事实与剧情，不允许新增情节。
禁止比喻，禁止情绪直给，避免时间戳与模板句。`
  const userPrompt = `请根据以下问题对章节做最小改写：
${issues.length ? issues.map(item => `- ${item}`).join('\n') : '- 无具体问题，但需要降 AI 痕迹'}

只输出修订后的正文：
${content}`

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

  const planningContext = chapterNumber != null
    ? buildPlanningSummary({ novelId, chapterNumber })
    : ''

  // 获取世界观设定，规则设置
  const worldview = worldviewDAO.getWorldviewByNovel(novelId)
  const worldRules = `${worldview?.worldview || '无世界观数据'}\n${worldview?.rules || '无规则数据'}`
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

  return {
    chapter,
    chapterNumber,
    planningContext,
    worldRules,
    lastChapterContentEnd
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
  configOverride
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
  const { chapter, chapterNumber, planningContext, worldRules, lastChapterContentEnd } = generationContext
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
      extraPrompt,
      systemPrompt,
      worldRules,
      lastChapterContentEnd,
      targetWords: paragraphRange,
      configOverride
    })

    if (!paragraph || paragraph.trim().length === 0) {
      console.warn(`[分块生成] 第 ${paragraphIndex} 段生成为空，尝试重新生成`)
      continue
    }

    // 2. 校验段落
    let validation = await validateParagraph({
      paragraph,
      chapterSoFar,
      graphContext,
      extraPrompt,
      configOverride
    })

    let finalParagraph = paragraph

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
          lastChapterContentEnd,
          targetWords: retryRange,
          configOverride
        })

        validation = await validateParagraph({
          paragraph,
          chapterSoFar,
          graphContext,
          extraPrompt,
          configOverride
        })

        if (validation.isValid || (validation.fixedParagraph && validation.fixedParagraph.trim().length > 0)) {
          finalParagraph = validation.fixedParagraph || paragraph
          console.log(`[分块生成] 第 ${paragraphIndex} 段重试成功`)
          break
        }
      }
    }

    // 4. 先累加段落
    const previousChapterContent = paragraphs.join('\n\n') // 之前的内容
    paragraphs.push(finalParagraph)
    chapterSoFar = paragraphs.join('\n\n') // 当前完整内容

    // 5. 更新图谱（增量抽取）
    // 传递章节号、当前累计内容、上一次内容（用于增量更新）
    await updateGraph(novelId, chapterNumber, chapterSoFar, previousChapterContent)

    // 6. 更新图谱上下文供下一段使用 (加入新生成的内容作为上下文)
    graphContext = await getGraphContext(novelId, `${planningContext}\n${chapterSoFar}`)
    
    console.log(`[分块生成] 第 ${paragraphIndex} 段完成，当前总字数: ${countWords(chapterSoFar)}`)
  }

  // 将原有内容和新生成内容合并
  const existingContent = chapter.content || ''
  const newContent = existingContent 
    ? existingContent + '\n\n' + paragraphs.join('\n\n')
    : paragraphs.join('\n\n')

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
