const outlineService = require('../outlineService')

function registerOutlineHandlers(ipcMain) {
  ipcMain.handle('outline:list', (_, novelId) => {
    try {
      return outlineService.listOutlines(novelId)
    } catch (error) {
      console.error('获取大纲列表失败:', error)
      throw error
    }
  })

  ipcMain.handle('outline:get', (_, id) => {
    try {
      return outlineService.getOutline(id)
    } catch (error) {
      console.error('获取大纲失败:', error)
      throw error
    }
  })

  ipcMain.handle('outline:create', (_, novelId, data) => {
    try {
      return outlineService.createOutline(novelId, data)
    } catch (error) {
      console.error('创建大纲失败:', error)
      throw error
    }
  })

  ipcMain.handle('outline:update', (_, id, data) => {
    try {
      return outlineService.updateOutline(id, data)
    } catch (error) {
      console.error('更新大纲失败:', error)
      throw error
    }
  })

  ipcMain.handle('outline:delete', (_, id) => {
    try {
      return outlineService.deleteOutline(id)
    } catch (error) {
      console.error('删除大纲失败:', error)
      throw error
    }
  })

  ipcMain.handle('outline:generate', async (_, data) => {
    try {
      return await outlineService.generateOutline(data)
    } catch (error) {
      console.error('生成大纲失败:', error)
      throw error
    }
  })
}

module.exports = {
  registerOutlineHandlers
}
