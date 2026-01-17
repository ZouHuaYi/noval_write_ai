const { ipcMain } = require('electron')
const { registerNovelHandlers } = require('./ipc/novelHandlers')
const { registerChapterHandlers } = require('./ipc/chapterHandlers')
const { registerOutlineHandlers } = require('./ipc/outlineHandlers')
const { registerWorldviewHandlers } = require('./ipc/worldviewHandlers')
const { registerMemoryHandlers } = require('./ipc/memoryHandlers')
const { registerKnowledgeHandlers } = require('./ipc/knowledgeHandlers')
const { registerStoryEngineHandlers } = require('./ipc/storyEngineHandlers')
const { registerChapterGenerationHandlers } = require('./ipc/chapterGenerationHandlers')
const { registerLlmHandlers } = require('./ipc/llmHandlers')
const { registerReIOHandlers } = require('./ipc/reioHandlers')

/**
 * 注册所有 IPC 处理器
 */
function registerIpcHandlers() {
  registerNovelHandlers(ipcMain)
  registerChapterHandlers(ipcMain)
  registerOutlineHandlers(ipcMain)
  registerWorldviewHandlers(ipcMain)
  registerMemoryHandlers(ipcMain)
  registerKnowledgeHandlers(ipcMain)
  registerStoryEngineHandlers(ipcMain)
  registerChapterGenerationHandlers(ipcMain)
  registerLlmHandlers(ipcMain)
  registerReIOHandlers(ipcMain)

  console.log('IPC 处理器注册完成')
}

module.exports = {
  registerIpcHandlers
}
