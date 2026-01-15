const { scanWritingChapters } = require('./extractor/chapterScanner')
const { processChapterFull } = require('./pipeline/processChapterFull')
const { ContextCompressor } = require('./compressor/contextCompressor')
const { OpenAIClient } = require('../llm/storyEngine/openaiClient')
const llmService = require('../llm/llmService')
const { deleteEntitiesByChapter } = require('../database/entityDAO')
const { deleteEventsByChapter } = require('../database/eventDAO')
const { deleteDependenciesByChapter } = require('../database/dependencyDAO')
const { updateChapter } = require('../database/chapterDAO')

let llmInstance = null

async function getStoryEngineLLM() {
  if (llmInstance) return llmInstance
  const config = await llmService.getDefaultChatConfig()
  if (!config) {
    throw new Error("未找到默认 LLM 配置，请先在设置中添加并设为默认")
  }

  llmInstance = new OpenAIClient({
    apiKey: config.apiKey,
    baseUrl: config.apiBase,
    model: config.model
  })

  return llmInstance
}


// 注意：这里需要一个 novelId，暂时使用占位符
// 在实际使用时，应该从调用方传入 novelId
const DEFAULT_NOVEL_ID = 'default-novel-id' // 这应该从实际的小说ID获取

async function run(novelId = DEFAULT_NOVEL_ID) {
  const chapters = scanWritingChapters(novelId)
  let successCount = 0
  let failureCount = 0

  for (const ch of chapters) {
    let result

    try {
      deleteEntitiesByChapter(novelId, ch.chapter)
      deleteEventsByChapter(novelId, ch.chapter)
      deleteDependenciesByChapter(novelId, ch.chapter)
    } catch (error) {
      console.error(`清理第${ch.chapter}章记忆数据失败:`, error)
    }

    try {
      const llm = await getStoryEngineLLM()
      result = await processChapterFull({
        novelId,
        chapter: ch.chapter,
        text: ch.text,
        llm
      })
    } catch (error) {
      console.error(`❌ 第${ch.chapter}章处理失败`, error)
      failureCount += 1
      continue
    }

    if (!result?.error) {
      updateChapter(ch.id, { status: 'completed' })
      successCount += 1
    } else {
      failureCount += 1
    }

    console.log(`✅ 第${ch.chapter}章处理完成`, {
      error: result?.error
    })
  }

  return {
    total: chapters.length,
    successCount,
    failureCount
  }
}

// 处理压缩输出
function processCompressOutput(chapter, novelId = DEFAULT_NOVEL_ID) {
  const compressor = new ContextCompressor(novelId)
  return compressor.compress(chapter)
}

module.exports = {
  run,
  processCompressOutput
}
