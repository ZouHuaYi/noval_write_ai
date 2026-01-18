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
      const result = await chapterGenerator.generateChapterChunks(payload)
      if (result?.chapter?.chapterNumber != null) {
        try {
          const planningDAO = require('../database/planningDAO')
          const chapters = planningDAO.listPlanningChapters(payload.novelId)
          const matched = chapters.find(ch => ch.chapterNumber === result.chapter.chapterNumber)
          if (matched) {
            const updated = {
              ...matched,
              status: result.status === 'completed' ? matched.status : 'in_progress'
            }
            planningDAO.upsertPlanningChapters(payload.novelId, [updated])

            if (result.status === 'completed') {
              result.planCompletionSuggested = true
            }
          }
        } catch (syncError) {
          console.error('同步规划状态失败:', syncError)
        }
      }
      return result
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
