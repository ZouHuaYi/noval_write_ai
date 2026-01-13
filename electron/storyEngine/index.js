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

// 1. 初始化 stores
const characterStore = new CharacterStore()
const eventStore = new EventStore()
const dependencyStore = new DependencyStore()

const compressor = new ContextCompressor(
  characterStore,
  eventStore,
  dependencyStore
)

async function run() {
  const chapters = scanChapters()
  for (const ch of chapters) {
    const result = await processChapterFull({
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
function processCompressOutput(chapter) {
  const context = compressor.compress(chapter)
  console.log(context)
}

processCompressOutput(3)
// run()