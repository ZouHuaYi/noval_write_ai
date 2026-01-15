const { ipcMain } = require('electron')
const novelDAO = require('./database/novelDAO')
const chapterDAO = require('./database/chapterDAO')
const settingsDAO = require('./database/settingsDAO')
const outlineDAO = require('./database/outlineDAO')
const entityDAO = require('./database/entityDAO')
const eventDAO = require('./database/eventDAO')
const dependencyDAO = require('./database/dependencyDAO')
const storyEngine = require('./storyEngine')
const llmService = require('./llm/llmService')



/**
 * 注册所有 IPC 处理器
 */
function registerIpcHandlers() {
  // ========== 小说相关 ==========
  ipcMain.handle('novel:list', () => {
    try {
      return novelDAO.getNovelList()
    } catch (error) {
      console.error('获取小说列表失败:', error)
      throw error
    }
  })

  ipcMain.handle('novel:get', (_, id) => {
    try {
      return novelDAO.getNovelById(id)
    } catch (error) {
      console.error('获取小说失败:', error)
      throw error
    }
  })

  ipcMain.handle('novel:create', (_, data) => {
    try {
      const id = novelDAO.createNovel(data)
      return { id, ...novelDAO.getNovelById(id) }
    } catch (error) {
      console.error('创建小说失败:', error)
      throw error
    }
  })

  ipcMain.handle('novel:update', (_, id, data) => {
    try {
      return novelDAO.updateNovel(id, data)
    } catch (error) {
      console.error('更新小说失败:', error)
      throw error
    }
  })

  ipcMain.handle('novel:delete', (_, id) => {
    try {
      novelDAO.deleteNovel(id)
      return { success: true }
    } catch (error) {
      console.error('删除小说失败:', error)
      throw error
    }
  })

  // ========== 章节相关 ==========
  ipcMain.handle('chapter:list', (_, novelId) => {
    try {
      return chapterDAO.getChaptersByNovel(novelId)
    } catch (error) {
      console.error('获取章节列表失败:', error)
      throw error
    }
  })

  ipcMain.handle('chapter:get', (_, id) => {
    try {
      return chapterDAO.getChapterById(id)
    } catch (error) {
      console.error('获取章节失败:', error)
      throw error
    }
  })

  ipcMain.handle('chapter:create', (_, novelId, data) => {
    try {
      const id = chapterDAO.createChapter(novelId, data)
      return { id, ...chapterDAO.getChapterById(id) }
    } catch (error) {
      console.error('创建章节失败:', error)
      throw error
    }
  })

  ipcMain.handle('chapter:update', (_, id, data) => {
    try {
      return chapterDAO.updateChapter(id, data)
    } catch (error) {
      console.error('更新章节失败:', error)
      throw error
    }
  })

  ipcMain.handle('chapter:updateContent', (_, id, content) => {
    try {
      return chapterDAO.updateChapterContent(id, content)
    } catch (error) {
      console.error('更新章节内容失败:', error)
      throw error
    }
  })

  ipcMain.handle('chapter:delete', (_, id) => {
    try {
      chapterDAO.deleteChapter(id)
      return { success: true }
    } catch (error) {
      console.error('删除章节失败:', error)
      throw error
    }
  })

  ipcMain.handle('chapter:deleteAll', (_, novelId) => {
    try {
      const deletedCount = chapterDAO.deleteAllChaptersByNovel(novelId)
      return { success: true, deletedCount }
    } catch (error) {
      console.error('清空所有章节失败:', error)
      throw error
    }
  })

  // ========== 设置相关 ==========
  ipcMain.handle('settings:get', (_, key) => {
    try {
      return settingsDAO.getSetting(key)
    } catch (error) {
      console.error('获取设置失败:', error)
      throw error
    }
  })

  ipcMain.handle('settings:set', (_, key, value, description) => {
    try {
      return settingsDAO.setSetting(key, value, description)
    } catch (error) {
      console.error('设置失败:', error)
      throw error
    }
  })

  ipcMain.handle('settings:getAll', () => {
    try {
      return settingsDAO.getAllSettings()
    } catch (error) {
      console.error('获取所有设置失败:', error)
      throw error
    }
  })

  ipcMain.handle('settings:delete', (_, key) => {
    try {
      settingsDAO.deleteSetting(key)
      return { success: true }
    } catch (error) {
      console.error('删除设置失败:', error)
      throw error
    }
  })

  // ========== 大纲相关 ==========
  ipcMain.handle('outline:list', (_, novelId) => {
    try {
      return outlineDAO.getOutlinesByNovel(novelId)
    } catch (error) {
      console.error('获取大纲列表失败:', error)
      throw error
    }
  })

  ipcMain.handle('outline:get', (_, id) => {
    try {
      return outlineDAO.getOutlineById(id)
    } catch (error) {
      console.error('获取大纲失败:', error)
      throw error
    }
  })

  ipcMain.handle('outline:create', (_, novelId, data) => {
    try {
      const id = outlineDAO.createOutline(novelId, data)
      return { id, ...outlineDAO.getOutlineById(id) }
    } catch (error) {
      console.error('创建大纲失败:', error)
      throw error
    }
  })

  ipcMain.handle('outline:update', (_, id, data) => {
    try {
      return outlineDAO.updateOutline(id, data)
    } catch (error) {
      console.error('更新大纲失败:', error)
      throw error
    }
  })

  ipcMain.handle('outline:delete', (_, id) => {
    try {
      outlineDAO.deleteOutline(id)
      return { success: true }
    } catch (error) {
      console.error('删除大纲失败:', error)
      throw error
    }
  })

  ipcMain.handle('outline:generate', async (_, data) => {
    try {
      return await llmService.callChatModel({
        messages: [
          { role: 'system', content: data?.systemPrompt || '' },
          { role: 'user', content: data?.userPrompt || '' }
        ]
      })
    } catch (error) {
      console.error('生成大纲失败:', error)
      throw error
    }
  })

  // ========== StoryEngine 记忆相关 ==========

  ipcMain.handle('memory:get', (_, novelId) => {
    try {
      return {
        entities: entityDAO.getEntitiesByNovel(novelId),
        events: eventDAO.getEventsByNovel(novelId),
        dependencies: dependencyDAO.getDependenciesByNovel(novelId)
      }
    } catch (error) {
      console.error('获取记忆数据失败:', error)
      throw error
    }
  })

  // ========== StoryEngine 处理相关 ==========
  ipcMain.handle('storyEngine:run', async (_, novelId) => {
    try {
      return await storyEngine.run(novelId)
    } catch (error) {
      console.error('运行 StoryEngine 失败:', error)
      throw error
    }
  })

  ipcMain.handle('storyEngine:compress', (_, chapter, novelId) => {
    try {
      return storyEngine.processCompressOutput(chapter, novelId)
    } catch (error) {
      console.error('压缩 StoryEngine 上下文失败:', error)
      throw error
    }
  })

  // ========== LLM 调用相关 ==========
  ipcMain.handle('llm:chat', async (_, options) => {

    try {
      return await llmService.callChatModel(options || {})
    } catch (error) {
      console.error('调用大模型失败:', error)
      throw error
    }
  })

  ipcMain.handle('llm:embed', async (_, options) => {
    try {
      return await llmService.callEmbeddingModel(options || {})
    } catch (error) {
      console.error('调用向量模型失败:', error)
      throw error
    }
  })

  console.log('IPC 处理器注册完成')
}

module.exports = {
  registerIpcHandlers
}
