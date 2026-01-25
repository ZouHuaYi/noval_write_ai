/**
 * ReIO IPC Handlers
 * 处理 ReIO 检查相关的 IPC 请求
 */
const reioChecker = require('../llm/reioChecker')

function registerReIOHandlers(ipcMain) {

  ipcMain.handle('reio:check', async (_, options) => {
    try {
      const result = await reioChecker.checkContent({
        generatedText: options.generatedText,
        eventGoal: options.eventGoal,
        memoryContext: options.memoryContext,
        activeCharacters: options.activeCharacters || [],
        worldRules: options.worldRules || [],
        novelId: options.novelId
      })
      return result
    } catch (error) {
      console.error('ReIO 检查失败:', error)
      throw error
    }
  })

  ipcMain.handle('reio:stats', async () => {
    try {
      return reioChecker.getReIOStats()
    } catch (error) {
      console.error('获取 ReIO 统计失败:', error)
      return null
    }
  })
}

module.exports = {
  registerReIOHandlers
}
