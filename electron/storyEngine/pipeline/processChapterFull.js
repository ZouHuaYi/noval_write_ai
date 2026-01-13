const { extractWithLLM } = require("../extractor/llmExtractor")
const { validateAndApply } = require("../governance/worldGate")
const { CharacterStore } = require("../storage/characterStore")
const { EventStore } = require("../storage/eventStore")
const { DependencyStore } = require("../storage/dependencyStore")

const characterStore = new CharacterStore()
const eventStore = new EventStore()
const dependencyStore = new DependencyStore()

/**
 * 完整闭环处理一章
 * @param {number} chapter 章节号
 * @param {string} text 章节文本
 * @param {object} stores { character, event, dependency, compressor }
 * @param {object} llm OpenAIClient 或兼容 LLM
 */
async function processChapterFull({ chapter, text, llm }) {
  // -------------------------
  // 1️⃣ 提取 LLM 输出
  // -------------------------
  const extract = await extractWithLLM({
    llm,
    chapter,
    text,
  })
  // 清空章节中所有事件、角色、依赖
  characterStore.clear()
  eventStore.clear()
  dependencyStore.clear()

  let error = null
  try {
    validateAndApply(extract, chapter)
  } catch (err) {
    error = err 
  }
  return {
    error
  }
}

module.exports = { processChapterFull }
