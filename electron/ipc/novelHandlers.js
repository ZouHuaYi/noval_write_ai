const novelService = require('../novelService')

function registerNovelHandlers(ipcMain) {
  ipcMain.handle('novel:list', () => {
    try {
      return novelService.listNovels()
    } catch (error) {
      console.error('获取小说列表失败:', error)
      throw error
    }
  })

  ipcMain.handle('novel:get', (_, id) => {
    try {
      return novelService.getNovel(id)
    } catch (error) {
      console.error('获取小说失败:', error)
      throw error
    }
  })

  ipcMain.handle('novel:create', (_, data) => {
    try {
      return novelService.createNovel(data)
    } catch (error) {
      console.error('创建小说失败:', error)
      throw error
    }
  })

  ipcMain.handle('novel:update', (_, id, data) => {
    try {
      return novelService.updateNovel(id, data)
    } catch (error) {
      console.error('更新小说失败:', error)
      throw error
    }
  })

  ipcMain.handle('novel:delete', (_, id) => {
    try {
      return novelService.deleteNovel(id)
    } catch (error) {
      console.error('删除小说失败:', error)
      throw error
    }
  })
}

module.exports = {
  registerNovelHandlers
}
