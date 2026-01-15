const { scanChapters, scanWritingChapters } = require("./extractor/chapterScanner")
const { processChapterFull } = require("./pipeline/processChapterFull")
const { CharacterStore } = require("./storage/characterStore")
const { EventStore } = require("./storage/eventStore")
const { DependencyStore } = require("./storage/dependencyStore")
const { ContextCompressor } = require("./compressor/contextCompressor")
const { OpenAIClient } = require("../llm/storyEngine/openaiClient")
const llmService = require("../llm/llmService")
const { updateChapter } = require("../database/chapterDAO")

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
const DEFAULT_NOVEL_ID = "default-novel-id" // 这应该从实际的小说ID获取

// 1. 初始化 stores（需要 novelId）
const characterStore = new CharacterStore(DEFAULT_NOVEL_ID)
const eventStore = new EventStore(DEFAULT_NOVEL_ID)
const dependencyStore = new DependencyStore(DEFAULT_NOVEL_ID)

const compressor = new ContextCompressor(DEFAULT_NOVEL_ID)

async function run(novelId = DEFAULT_NOVEL_ID) {
  const chapters = scanWritingChapters(novelId)
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
      continue
    }

    if (!result?.error) {
      updateChapter(ch.id, { status: "completed" })
    }

    console.log(`✅ 第${ch.chapter}章处理完成`, {
      error: result?.error
    })
  }
}


// 处理压缩输出
function processCompressOutput(chapter, novelId = DEFAULT_NOVEL_ID) {
  const compressor = new ContextCompressor(novelId)
  const context = compressor.compress(chapter)
  console.log(context)
}

processCompressOutput(3)
// run()