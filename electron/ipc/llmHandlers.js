const llmService = require('../llmServiceFacade')

function registerLlmHandlers(ipcMain) {
  ipcMain.handle('llm:chat', async (_, options) => {
    try {
      return await llmService.chat(options)
    } catch (error) {
      console.error('调用大模型失败:', error)
      throw error
    }
  })

  ipcMain.handle('llm:embed', async (_, options) => {
    try {
      return await llmService.embed(options)
    } catch (error) {
      console.error('调用向量模型失败:', error)
      throw error
    }
  })
}

module.exports = {
  registerLlmHandlers
}
