const { ipcMain } = require('electron')
const { registerNovelHandlers } = require('./ipc/novelHandlers')
const { registerChapterHandlers } = require('./ipc/chapterHandlers')
// const { registerOutlineHandlers } = require('./ipc/outlineHandlers')
const { registerWorldviewHandlers } = require('./ipc/worldviewHandlers')
const { registerChapterGenerationHandlers } = require('./ipc/chapterGenerationHandlers')
const { registerLlmHandlers } = require('./ipc/llmHandlers')
const { registerReIOHandlers } = require('./ipc/reioHandlers')
const { registerPlanningHandlers } = require('./ipc/planningHandlers')
const { registerGraphHandlers } = require('./ipc/graphHandlers')
const { registerSettingsHandlers } = require('./ipc/settingsHandlers')

/**
 * 注册所有 IPC 处理器
 */
function registerIpcHandlers() {
  registerNovelHandlers(ipcMain)
  registerChapterHandlers(ipcMain)
  // registerOutlineHandlers(ipcMain) - Removed in Phase 7
  registerWorldviewHandlers(ipcMain)
  registerChapterGenerationHandlers(ipcMain)
  registerLlmHandlers(ipcMain)
  registerReIOHandlers(ipcMain)
  registerPlanningHandlers(ipcMain)
  registerGraphHandlers(ipcMain)
  registerSettingsHandlers(ipcMain)

  console.log('IPC 处理器注册完成')
}

module.exports = {
  registerIpcHandlers
}
