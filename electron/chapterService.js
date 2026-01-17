const chapterDAO = require('./database/chapterDAO')

function listChapters(novelId) {
  return chapterDAO.getChaptersByNovel(novelId)
}

function getChapter(id) {
  return chapterDAO.getChapterById(id)
}

function createChapter(novelId, data) {
  const id = chapterDAO.createChapter(novelId, data)
  return { id, ...chapterDAO.getChapterById(id) }
}

function updateChapter(id, data) {
  return chapterDAO.updateChapter(id, data)
}

function updateChapterContent(id, content, chapterNumber) {
  return chapterDAO.updateChapterContent(id, content, chapterNumber)
}

function deleteChapter(id) {
  chapterDAO.deleteChapter(id)
  return { success: true }
}

function deleteAllChapters(novelId) {
  const deletedCount = chapterDAO.deleteAllChaptersByNovel(novelId)
  return { success: true, deletedCount }
}

module.exports = {
  listChapters,
  getChapter,
  createChapter,
  updateChapter,
  updateChapterContent,
  deleteChapter,
  deleteAllChapters
}
