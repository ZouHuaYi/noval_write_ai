const { processChapterFull } = require('./pipeline/processChapterFull')
const { ContextCompressor } = require('./compressor/contextCompressor')
const { OpenAIClient } = require('../llm/storyEngine/openaiClient')
const llmService = require('../llm/llmService')
const { updateChapter } = require('../database/chapterDAO')
const { scanWritingChapters } = require('./extractor/chapterScanner')

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


async function run(novelId) {
  if (!novelId) {
    throw new Error('StoryEngine 运行需要 novelId')
  }
  const chapters = scanWritingChapters(novelId)
  let successCount = 0
  let failureCount = 0

  for (const ch of chapters) {
    let result

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
      try {
        updateChapter(ch.id, { status: 'completed' })
        successCount += 1
      } catch (error) {
        console.error(`更新第${ch.chapter}章状态失败:`, error)
        failureCount += 1
      }
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
function processCompressOutput(chapter, novelId) {
  if (!novelId) {
    throw new Error('ContextCompressor 需要 novelId 参数')
  }
  const compressor = new ContextCompressor(novelId)
  return compressor.compress(chapter)
}

module.exports = {
  run,
  processCompressOutput
}
