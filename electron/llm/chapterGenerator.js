const llmService = require('./llmService')
const chapterSnapshotDAO = require('../database/chapterSnapshotDAO')
const chapterGenerationDAO = require('../database/chapterGenerationDAO')
const chapterDAO = require('../database/chapterDAO')
const outlineDAO = require('../database/outlineDAO')
// const storyEngine = require('../storyEngine') // Removed in Phase 7
const { buildKnowledgeSummary } = require('./knowledgeContext')
const reioChecker = require('./reioChecker')

function buildOutlineContext(outlines = []) {
  if (!outlines.length) return ''
  return outlines.map(outline => {
    const start = outline.startChapter
    const end = outline.endChapter
    let range = '未设置范围'
    if (start && end) range = `第 ${start} 章 - 第 ${end} 章`
    else if (start) range = `第 ${start} 章起`
    else if (end) range = `至第 ${end} 章`
    const content = outline.content?.trim() || '（该大纲暂无内容）'
    return `【${outline.title}】(${range})\n${content}`
  }).join('\n\n')
}

// ... unchanged code ...

async function buildGenerationContext({ novelId, chapterId }) {
  const chapter = await chapterDAO.getChapterById(chapterId)
  if (!chapter) {
    throw new Error('章节不存在')
  }
  const chapterNumber = chapter.chapterNumber ?? null
  const outlines = await outlineDAO.getOutlinesByNovel(novelId)
  const matched = outlines.filter(outline => {
    if (outline.startChapter == null || outline.endChapter == null) return false
    return chapterNumber && chapterNumber >= outline.startChapter && chapterNumber <= outline.endChapter
  })

  // 暂时移除基于 StoryEngine 的记忆上下文获取
  let memoryContext = ''
  /*
  if (chapterNumber) {
    try {
      memoryContext = await storyEngine.processCompressOutput(chapterNumber, novelId)
    } catch (error) {
      console.error('获取记忆上下文失败:', error)
    }
  }
  */

  return {
    chapter,
    chapterNumber,
    outlineContext: buildOutlineContext(matched),
    memoryContext
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
  outlineContext,
  memoryContext,
  knowledgeContext,
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
    outlineContext,
    memoryContext,
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
          eventGoal: `第 ${chapterNumber} 章续写，章节标题：${chapter.title}`,
          memoryContext,
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
  const { chapter, chapterNumber, outlineContext, memoryContext } = await buildGenerationContext({ novelId, chapterId })
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
      totalChunks: generation.maxChunks
    }
  }

  for (let i = generation.currentChunk; i < maxChunks; i += 1) {
    const newChunk = await generateChunk({
      novelTitle,
      chapter,
      chapterNumber,
      outlineContext,
      memoryContext,
      knowledgeContext,
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
        error: '未生成有效内容'
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
        totalChunks: maxChunks
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
    totalChunks: maxChunks
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
