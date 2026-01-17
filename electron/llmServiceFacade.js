const llmService = require('./llm/llmService')

async function chat(options) {
  return await llmService.callChatModel(options || {})
}

async function embed(options) {
  return await llmService.callEmbeddingModel(options || {})
}

module.exports = {
  chat,
  embed
}
