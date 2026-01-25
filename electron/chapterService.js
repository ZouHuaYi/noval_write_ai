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

function getChapterByNovelAndNumber(novelId, chapterNumber) {
  return chapterDAO.getChapterByNovelAndNumber(novelId, chapterNumber)
}

function updateChapter(id, data) {
  return chapterDAO.updateChapter(id, data)
}

function deleteChapter(id) {
  const chapter = chapterDAO.getChapterById(id)
  if (chapter) {
    try {
      const { getGraphManager } = require('./graph/graphManager')
      const knowledgeEntryDAO = require('./database/knowledgeEntryDAO')
      const manager = getGraphManager()
      manager.cleanupChapter(chapter.novelId, chapter.chapterNumber)
      knowledgeEntryDAO.deleteEntriesByChapter(chapter.novelId, chapter.chapterNumber)
    } catch (error) {
      console.error('删除章节关联图谱失败:', error)
    }
  }
  chapterDAO.deleteChapter(id)
  return { success: true }
}

function deleteAllChapters(novelId) {
  try {
    const { getGraphManager } = require('./graph/graphManager')
    const knowledgeEntryDAO = require('./database/knowledgeEntryDAO')
    const manager = getGraphManager()
    manager.deleteGraph(novelId)
    knowledgeEntryDAO.deleteEntriesByNovel(novelId)
  } catch (error) {
    console.error('删除章节关联图谱失败:', error)
  }
  const deletedCount = chapterDAO.deleteAllChaptersByNovel(novelId)
  return { success: true, deletedCount }
}

module.exports = {
  listChapters,
  getChapter,
  createChapter,
  updateChapter,
  deleteChapter,
  deleteAllChapters,
  getChapterByNovelAndNumber
}
