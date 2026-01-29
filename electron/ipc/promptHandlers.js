const { ipcMain } = require('electron')
const promptService = require('../prompt/promptService')

function registerPromptHandlers(ipcMain) {
  ipcMain.handle('prompt:list', async () => {
    try {
      return promptService.listPrompts()
    } catch (error) {
      console.error('获取 Prompt 配置失败:', error)
      throw error
    }
  })

  ipcMain.handle('prompt:saveAll', async (_, overrides) => {
    try {
      return promptService.savePromptOverrides(overrides)
    } catch (error) {
      console.error('保存 Prompt 配置失败:', error)
      throw error
    }
  })
}

module.exports = {
  registerPromptHandlers
}
