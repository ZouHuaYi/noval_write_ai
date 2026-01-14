const { scanChapters } = require("./extractor/chapterScanner")
const { processChapterFull } = require("./pipeline/processChapterFull")
const { CharacterStore } = require("./storage/characterStore")
const { EventStore } = require("./storage/eventStore")
const { DependencyStore } = require("./storage/dependencyStore")
const { ContextCompressor } = require("./compressor/contextCompressor")
const { OpenAIClient } = require("./llm/openaiClient")

const llm = new OpenAIClient({
  apiKey: "sk-036edfa9893a46e39ef8ae8a67af76d2",
  baseUrl: 'https://api.deepseek.com/v1', 
  model: "deepseek-chat"
})

// 注意：这里需要一个 novelId，暂时使用占位符
// 在实际使用时，应该从调用方传入 novelId
const DEFAULT_NOVEL_ID = "default-novel-id" // 这应该从实际的小说ID获取

// 1. 初始化 stores（需要 novelId）
const characterStore = new CharacterStore(DEFAULT_NOVEL_ID)
const eventStore = new EventStore(DEFAULT_NOVEL_ID)
const dependencyStore = new DependencyStore(DEFAULT_NOVEL_ID)

const compressor = new ContextCompressor(DEFAULT_NOVEL_ID)

async function run(novelId = DEFAULT_NOVEL_ID) {
  const chapters = scanChapters()
  for (const ch of chapters) {
    const result = await processChapterFull({
      novelId,
      chapter: ch.chapter,
      text: ch.text,
      llm
    })

    console.log(`✅ 第${ch.chapter}章处理完成`, {
      error: result.error
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