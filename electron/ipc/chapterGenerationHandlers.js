const chapterGenerator = require('../llm/chapterGenerator')
const chapterSnapshotDAO = require('../database/chapterSnapshotDAO')

function registerChapterGenerationHandlers(ipcMain) {
  ipcMain.handle('chapter:snapshot:list', (_, chapterId) => {
    try {
      return chapterSnapshotDAO.listSnapshotsByChapter(chapterId)
    } catch (error) {
      console.error('获取章节快照失败:', error)
      throw error
    }
  })

  ipcMain.handle('chapter:snapshot:restore', (_, snapshotId) => {
    try {
      return chapterSnapshotDAO.restoreSnapshot(snapshotId)
    } catch (error) {
      console.error('恢复章节快照失败:', error)
      throw error
    }
  })

  ipcMain.handle('chapter:generateChunks', async (_, payload) => {
    try {
      return await chapterGenerator.generateChapterChunks(payload)
    } catch (error) {
      console.error('生成章节失败:', error)
      throw error
    }
  })

  ipcMain.handle('chapter:generateStatus', (_, chapterId) => {
    try {
      return chapterGenerator.getGenerationStatus(chapterId)
    } catch (error) {
      console.error('获取生成状态失败:', error)
      throw error
    }
  })

  ipcMain.handle('chapter:generateReset', (_, chapterId) => {
    try {
      return chapterGenerator.resetGeneration(chapterId)
    } catch (error) {
      console.error('重置生成状态失败:', error)
      throw error
    }
  })
}

module.exports = {
  registerChapterGenerationHandlers
}
