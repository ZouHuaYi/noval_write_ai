const llmService = require('./llm/llmService')

async function chat(options) {
  return await llmService.callChatModel(options || {})
}

module.exports = {
  chat
}
