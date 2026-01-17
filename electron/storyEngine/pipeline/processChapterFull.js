const { extractWithLLM } = require("../extractor/llmExtractor")
const { validateAndApply } = require("../governance/worldGate")
const { CharacterStore } = require("../storage/characterStore")
const { EventStore } = require("../storage/eventStore")
const { DependencyStore } = require("../storage/dependencyStore")
const { getDatabase } = require("../../database")


/**
 * 完整闭环处理一章
 * @param {string} novelId 小说ID
 * @param {number} chapter 章节号
 * @param {string} text 章节文本
 * @param {object} llm OpenAIClient 或兼容 LLM
 */
async function processChapterFull({ novelId, chapter, text, llm }) {
  if (!novelId) {
    throw new Error("processChapterFull 需要 novelId 参数")
  }

  const characterStore = new CharacterStore(novelId)
  const eventStore = new EventStore(novelId)
  const dependencyStore = new DependencyStore(novelId)
  const db = getDatabase()

  const extract = await extractWithLLM({
    llm,
    chapter,
    text,
  })

  let error = null
  try {
    db.transaction(() => {
      characterStore.clearByChapter(chapter)
      eventStore.clearByChapter(chapter)
      dependencyStore.clearByChapter(chapter)
      validateAndApply(extract, chapter, { characterStore, eventStore, dependencyStore })
    })()
  } catch (err) {
    error = err
  }
  return {
    error
  }
}


module.exports = { processChapterFull }
