const memoryService = require('../memoryService')

function registerMemoryHandlers(ipcMain) {
  ipcMain.handle('memory:get', (_, novelId) => {
    try {
      return memoryService.getMemory(novelId)
    } catch (error) {
      console.error('获取记忆数据失败:', error)
      throw error
    }
  })

}

module.exports = {
  registerMemoryHandlers
}
