const llmService = require('./llmService')
const chapterSnapshotDAO = require('../database/chapterSnapshotDAO')
const chapterGenerationDAO = require('../database/chapterGenerationDAO')
const chapterDAO = require('../database/chapterDAO')
const worldviewDAO = require('../database/worldviewDAO')
const { buildKnowledgeSummary } = require('./knowledgeContext')
const { buildPlanningSummary } = require('./planningContext')
const { getGraphManager } = require('../graph/graphManager')

const formatSection = (title, content) => `【${title}】\n${content || '无'}\n`

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

/**
 * 获取知识图谱上下文摘要
 * @param {string} novelId 
 * @returns {Promise<string>}
 */
async function getGraphContext(novelId) {
  try {
    const manager = getGraphManager()
    const stats = manager.getStats(novelId)
    if (!stats || (stats.nodeCount === 0 && stats.edgeCount === 0)) {
      return ''
    }
    
    // 导出图谱可视化数据作为摘要
    const graphData = manager.exportForVisualization(novelId)
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
      return ''
    }

    // 构建简洁的图谱摘要
    const characters = graphData.nodes
      .filter(n => n.data?.type === 'character')
      .slice(0, 10)
      .map(n => `- ${n.data.label}: ${n.data.description || '无描述'}`)
      .join('\n')
    
    const locations = graphData.nodes
      .filter(n => n.data?.type === 'location')
      .slice(0, 5)
      .map(n => `- ${n.data.label}: ${n.data.description || '无描述'}`)
      .join('\n')

    const relations = graphData.edges
      .slice(0, 10)
      .map(e => `- ${e.data?.label || '关系'}`)
      .join('\n')

    let summary = ''
    if (characters) summary += `【角色】\n${characters}\n`
    if (locations) summary += `【地点】\n${locations}\n`
    if (relations) summary += `【关系】\n${relations}\n`
    
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
1. 字数控制在 ${targetWords[0]}-${targetWords[1]} 字之间
2. 必须紧密承接上文，不要重复已写内容
3. 保持情节生动连贯，符合世界观设定
4. 段落结尾可留一个轻钩子，引发读者继续阅读的兴趣
5. 只输出正文内容，不要任何解释`)
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
  targetWords = [300, 500]
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
    temperature: 0.9, // 高温度，保持创意和灵性
    maxTokens: 1500
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
  extraPrompt
}) {
  const { safeParseJSON } = require('../utils/helpers')

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
      maxTokens: 2000
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
  // 这里应该取上一章节内容最后结束的 500 字符
  const lastChapter = chapterNumber > 1 ? await chapterDAO.getChapterByNovelAndNumber(novelId, chapterNumber - 1) : null
  const lastChapterContent = lastChapter?.content || ''
  const lastChapterContentEnd = lastChapterContent?.slice(-500) || ''

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
  targetWords = 3000, // 目标总字数
  minParagraphWords = 300,
  maxParagraphWords = 500,
  maxParagraphs = 12, // 最大段落数
  maxRetries = 2 // 每段最大重试次数
}) {
  if (!novelId || !chapterId) {
    throw new Error('生成章节需要 novelId 与 chapterId')
  }

  console.log(`[分块生成] 开始生成章节，目标字数: ${targetWords}`)

  const { chapter, chapterNumber, planningContext, worldRules, lastChapterContentEnd } = await buildGenerationContext({ novelId, chapterId })
  
  // 构建知识上下文
  const knowledgeContext = buildKnowledgeSummary({
    novelId,
    types: ['character', 'location', 'timeline', 'plot'],
    maxItems: 12,
    currentChapter: chapterNumber,
    maxChars: 1200
  })

  // 创建生成前快照
  createSnapshot(novelId, chapter, 'pre_generate')

  // 初始化
  const paragraphs = []
  let chapterSoFar = chapter.content || '' // 保留已有内容
  let graphContext = await getGraphContext(novelId)
  let paragraphIndex = 0

  // 循环生成段落
  while (countWords(chapterSoFar) < targetWords && paragraphIndex < maxParagraphs) {
    paragraphIndex++
    console.log(`[分块生成] 生成第 ${paragraphIndex} 段...`)

    // 1. 生成一段（300-500字）
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
      targetWords: [minParagraphWords, maxParagraphWords]
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
      extraPrompt
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
          targetWords: [minParagraphWords, maxParagraphWords]
        })

        validation = await validateParagraph({
          paragraph,
          chapterSoFar,
          graphContext,
          extraPrompt
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

    // 6. 更新图谱上下文供下一段使用
    graphContext = await getGraphContext(novelId)
    
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
  getGenerationStatus,
  resetGeneration,
  // 导出用于单独调用
  generateParagraph,
  validateParagraph,
  getGraphContext
}
