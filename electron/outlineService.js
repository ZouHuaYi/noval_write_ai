const outlineDAO = require('./database/outlineDAO')
const llmService = require('./llm/llmService')

function listOutlines(novelId) {
  return outlineDAO.getOutlinesByNovel(novelId)
}

function getOutline(id) {
  return outlineDAO.getOutlineById(id)
}

function createOutline(novelId, data) {
  const id = outlineDAO.createOutline(novelId, data)
  return { id, ...outlineDAO.getOutlineById(id) }
}

function updateOutline(id, data) {
  return outlineDAO.updateOutline(id, data)
}

function deleteOutline(id) {
  outlineDAO.deleteOutline(id)
  return { success: true }
}

async function generateOutline({ systemPrompt, userPrompt } = {}) {
  return await llmService.callChatModel({
    messages: [
      { role: 'system', content: systemPrompt || '' },
      { role: 'user', content: userPrompt || '' }
    ]
  })
}

module.exports = {
  listOutlines,
  getOutline,
  createOutline,
  updateOutline,
  deleteOutline,
  generateOutline
}
