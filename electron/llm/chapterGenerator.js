const llmService = require('./llmService')
const chapterSnapshotDAO = require('../database/chapterSnapshotDAO')
const chapterGenerationDAO = require('../database/chapterGenerationDAO')
const chapterDAO = require('../database/chapterDAO')
const worldviewDAO = require('../database/worldviewDAO')
const { buildKnowledgeSummary } = require('./knowledgeContext')
const { buildPlanningSummary } = require('./planningContext')
const reioChecker = require('./reioChecker')

const formatSection = (title, content) => `【${title}】\n${content || '无'}\n`

function buildContinuePrompt({
  novelTitle,
  chapterTitle,
  chapterNumber,
  content,
  knowledgeContext,
  extraPrompt,
  chunkSize
}) {
  const targetHint = chunkSize ? `续写约 ${Math.max(300, Math.round(chunkSize * 0.6))}-${chunkSize} 字` : '续写约 500-1000 字'
  return [
    formatSection('小说信息', `标题：${novelTitle || '未命名'}\n章节：第 ${chapterNumber ?? '?'} 章 · ${chapterTitle || '未命名'}`),
    formatSection('章节已写内容', content || '无'),
    formatSection('知识与设定', knowledgeContext || '无设定数据'),
    formatSection('作者补充要求', extraPrompt || '无'),
    formatSection('输出要求', `请基于以上上下文（特别是章节计划中的目标与事件），生成本章后续内容。${targetHint}，保证情节生动、连贯，符合世界观设定。只输出正文内容。`)
  ].join('\n')
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
  const worldRules = `
    世界观：${worldview?.worldview || '无世界观数据'}
    规则：${worldview?.rules || '无规则数据'}
  `
  // 这里应该取上一章节内容最后结束的 500 字符
  const lastChapter = chapterNumber > 1 ? await chapterDAO.getChapterByNovelAndNumber(novelId, chapterNumber - 1) : null
  const lastChapterContent = lastChapter?.content || ''
  const lastChapterContentEnd = lastChapterContent?.slice(-500) || ''

  return {
    chapter,
    chapterNumber,
    planningContext,
    worldRules,
    lastChapterContentEnd: `上一章节内容最后结束的 500 字：${lastChapterContentEnd}`
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

async function generateChunk({
  novelTitle,
  chapter,
  chapterNumber,
  knowledgeContext,
  planningContext,
  extraPrompt,
  systemPrompt,
  chunkIndex,
  chunkSize,
  enableReIO = true // 是否启用 ReIO 检查
}) {
  const userPrompt = buildContinuePrompt({
    novelTitle,
    chapterTitle: chapter.title,
    chapterNumber,
    content: chapter.content,
    knowledgeContext,
    extraPrompt,
    chunkSize
  })

  // 生成函数
  const generate = async () => {
    const content = await llmService.callChatModel({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
    return content?.trim() || ''
  }

  // 如果启用 ReIO 检查
  if (enableReIO) {
    try {
      const result = await reioChecker.generateWithReIO({
        generate,
        context: {
          eventGoal: `${planningContext ? planningContext + '\n' : ''}第 ${chapterNumber} 章续写，章节标题：${chapter.title}`,
          activeCharacters: [], // 可从 memoryContext 中提取
          worldRules: [],
          systemPrompt
        },
        maxRetries: 1 // 最多重写 1 次，避免过度消耗 token
      })

      if (result.rewriteCount > 0) {
        console.log(`ReIO: 第 ${chapterNumber} 章 chunk ${chunkIndex} 经过 ${result.rewriteCount} 次重写`)
      }

      return result.content
    } catch (error) {
      console.error('ReIO 检查过程出错，使用原始生成:', error)
      // 降级到普通生成
      return await generate()
    }
  }
  // 不启用 ReIO 时直接生成
  return await generate()
}

async function generateChapterChunks({
  novelId,
  chapterId,
  novelTitle,
  chunkSize = 1200,
  maxChunks = 6,
  extraPrompt,
  systemPrompt
}) {
  if (!novelId || !chapterId) {
    throw new Error('生成章节需要 novelId 与 chapterId')
  }

  const generation = ensureGeneration(novelId, chapterId, { chunkSize, maxChunks })
  const { chapter, chapterNumber, planningContext, worldRules, lastChapterContentEnd } = await buildGenerationContext({ novelId, chapterId })
  const knowledgeContext = buildKnowledgeSummary({
    novelId,
    types: ['character', 'location', 'timeline', 'plot'],
    maxItems: 12,
    currentChapter: chapterNumber,
    maxChars: 1200
  })

  createSnapshot(novelId, chapter, 'pre_generate')

  const currentContent = chapter.content || ''
  const currentLength = currentContent.replace(/[\s\p{P}]/gu, '').length

  if (generation.status === 'completed') {
    return {
      chapter,
      status: 'completed',
      currentChunk: generation.currentChunk,
      totalChunks: generation.maxChunks,
      contextSummary: {
        knowledgeContext,
        planningContext,
        worldRules,
        lastChapterContentEnd
      }
    }
  }

  for (let i = generation.currentChunk; i < maxChunks; i += 1) {
    const newChunk = await generateChunk({
      novelTitle,
      chapter,
      chapterNumber,
      knowledgeContext,
      planningContext,
      extraPrompt,
      systemPrompt,
      chunkIndex: i + 1,
      chunkSize
    })

    if (!newChunk) {
      chapterGenerationDAO.updateGeneration(chapterId, {
        status: 'failed',
        lastError: '未生成有效内容'
      })
      return {
        chapter,
        status: 'failed',
        error: '未生成有效内容',
        contextSummary: {
          outlineContext,
          memoryContext,
          knowledgeContext,
          planningContext
        }
      }
    }

    const separator = chapter.content?.endsWith('\n') ? '\n' : '\n\n'
    const merged = (chapter.content || '') + separator + newChunk
    const updatedChapter = chapterDAO.updateChapter(chapter.id, {
      content: merged,
      status: 'writing'
    })
    chapter.content = updatedChapter.content

    const nextLength = chapter.content.replace(/[\s\p{P}]/gu, '').length
    const generatedLength = nextLength - currentLength
    const reachedSize = generatedLength >= chunkSize

    chapterGenerationDAO.updateGeneration(chapterId, {
      currentChunk: i + 1,
      lastContentLength: nextLength
    })

    createSnapshot(novelId, chapter, `chunk_${i + 1}`)

    if (reachedSize) {
      chapterGenerationDAO.updateGeneration(chapterId, {
        status: i + 1 >= maxChunks ? 'completed' : 'paused'
      })
      return {
        chapter,
        status: i + 1 >= maxChunks ? 'completed' : 'paused',
        currentChunk: i + 1,
        totalChunks: maxChunks,
        contextSummary: {
          outlineContext,
          memoryContext,
          knowledgeContext,
          planningContext
        }
      }
    }
  }

  chapterGenerationDAO.updateGeneration(chapterId, {
    status: 'completed',
    currentChunk: maxChunks
  })

  return {
    chapter,
    status: 'completed',
    currentChunk: maxChunks,
    totalChunks: maxChunks,
    contextSummary: {
      outlineContext,
      memoryContext,
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
  resetGeneration
}
