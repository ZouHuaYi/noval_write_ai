const worldviewService = require('../worldviewService')

function registerWorldviewHandlers(ipcMain) {
  ipcMain.handle('worldview:get', (_, novelId) => {
    try {
      return worldviewService.getWorldview(novelId)
    } catch (error) {
      console.error('获取世界观失败:', error)
      throw error
    }
  })

  ipcMain.handle('worldview:save', (_, novelId, data) => {
    try {
      return worldviewService.saveWorldview(novelId, data)
    } catch (error) {
      console.error('保存世界观失败:', error)
      throw error
    }
  })
}

module.exports = {
  registerWorldviewHandlers
}
