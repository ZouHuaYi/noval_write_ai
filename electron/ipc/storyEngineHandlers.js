const storyEngineService = require('../storyEngineService')

function registerStoryEngineHandlers(ipcMain) {
  ipcMain.handle('storyEngine:run', async (_, novelId) => {
    try {
      return await storyEngineService.runStoryEngine(novelId)
    } catch (error) {
      console.error('运行 StoryEngine 失败:', error)
      throw error
    }
  })

  ipcMain.handle('storyEngine:compress', (_, chapter, novelId) => {
    try {
      return storyEngineService.compressStoryContext(chapter, novelId)
    } catch (error) {
      console.error('压缩 StoryEngine 上下文失败:', error)
      throw error
    }
  })
}

module.exports = {
  registerStoryEngineHandlers
}
