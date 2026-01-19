const chapterService = require('../chapterService')

function registerChapterHandlers(ipcMain) {
  ipcMain.handle('chapter:list', (_, novelId) => {
    try {
      return chapterService.listChapters(novelId)
    } catch (error) {
      console.error('获取章节列表失败:', error)
      throw error
    }
  })

  ipcMain.handle('chapter:getByNumber', (_, novelId, chapterNumber) => {
    try {
      return chapterService.getChapterByNovelAndNumber(novelId, chapterNumber)
    } catch (error) {
      console.error('获取章节失败:', error)
      throw error
    }
  })

  ipcMain.handle('chapter:get', (_, id) => {
    try {
      return chapterService.getChapter(id)
    } catch (error) {
      console.error('获取章节失败:', error)
      throw error
    }
  })

  ipcMain.handle('chapter:create', (_, novelId, data) => {
    try {
      return chapterService.createChapter(novelId, data)
    } catch (error) {
      console.error('创建章节失败:', error)
      throw error
    }
  })

  ipcMain.handle('chapter:update', (_, id, data) => {
    try {
      return chapterService.updateChapter(id, data)
    } catch (error) {
      console.error('更新章节失败:', error)
      throw error
    }
  })

  ipcMain.handle('chapter:updateContent', (_, id, content, chapterNumber) => {
    try {
      return chapterService.updateChapterContent(id, content, chapterNumber)
    } catch (error) {
      console.error('更新章节内容失败:', error)
      throw error
    }
  })

  ipcMain.handle('chapter:delete', (_, id) => {
    try {
      return chapterService.deleteChapter(id)
    } catch (error) {
      console.error('删除章节失败:', error)
      throw error
    }
  })

  ipcMain.handle('chapter:deleteAll', (_, novelId) => {
    try {
      return chapterService.deleteAllChapters(novelId)
    } catch (error) {
      console.error('清空所有章节失败:', error)
      throw error
    }
  })
}

module.exports = {
  registerChapterHandlers
}
