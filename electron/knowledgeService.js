const knowledgeEntryDAO = require('./database/knowledgeEntryDAO')
const knowledgeSync = require('./storyEngine/knowledgeSync')

function listEntries(novelId, type, reviewStatus) {
  return knowledgeEntryDAO.listEntries(novelId, type, reviewStatus)
}

function searchEntries(novelId, keyword, reviewStatus) {
  return knowledgeEntryDAO.searchEntries(novelId, keyword, reviewStatus)
}

function listReviewEntries(novelId, reviewStatus) {
  return knowledgeEntryDAO.listReviewEntries(novelId, reviewStatus)
}

function updateReviewStatus(id, reviewStatus) {
  return knowledgeEntryDAO.updateEntry(id, { reviewStatus })
}

function createEntry(novelId, data) {
  return knowledgeEntryDAO.createEntry(novelId, data)
}

function updateEntry(id, data) {
  return knowledgeEntryDAO.updateEntry(id, data)
}

function deleteEntry(id) {
  knowledgeEntryDAO.deleteEntry(id)
  return { success: true }
}

function upsertEntry(novelId, data) {
  return knowledgeEntryDAO.upsertEntry(novelId, data)
}

function syncFromMemory(novelId) {
  return knowledgeSync.syncKnowledgeFromMemory(novelId)
}

module.exports = {
  listEntries,
  searchEntries,
  listReviewEntries,
  updateReviewStatus,
  createEntry,
  updateEntry,
  deleteEntry,
  upsertEntry,
  syncFromMemory
}
