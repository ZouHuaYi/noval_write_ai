const { dialog, BrowserWindow } = require('electron')
const fs = require('fs').promises
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

  ipcMain.handle('novel:export', async (_, novelId) => {
    try {
      const { title, content } = await novelService.exportNovel(novelId)
      const win = BrowserWindow.getFocusedWindow()
      
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        title: '导出小说',
        defaultPath: `${title}.txt`,
        filters: [{ name: 'Text File', extensions: ['txt'] }]
      })

      if (canceled || !filePath) {
        return { success: false, canceled: true }
      }

      await fs.writeFile(filePath, content, 'utf8')
      return { success: true, filePath }
    } catch (error) {
      console.error('导出小说失败:', error)
      throw error
    }
  })
}

module.exports = {
  registerNovelHandlers
}
