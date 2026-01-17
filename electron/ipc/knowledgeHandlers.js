const knowledgeService = require('../knowledgeService')

function registerKnowledgeHandlers(ipcMain) {
  ipcMain.handle('knowledge:list', (_, novelId, type, reviewStatus) => {
    try {
      return knowledgeService.listEntries(novelId, type, reviewStatus)
    } catch (error) {
      console.error('获取知识库失败:', error)
      throw error
    }
  })

  ipcMain.handle('knowledge:search', (_, novelId, keyword, reviewStatus) => {
    try {
      return knowledgeService.searchEntries(novelId, keyword, reviewStatus)
    } catch (error) {
      console.error('搜索知识库失败:', error)
      throw error
    }
  })

  ipcMain.handle('knowledge:review:list', (_, novelId, reviewStatus) => {
    try {
      return knowledgeService.listReviewEntries(novelId, reviewStatus)
    } catch (error) {
      console.error('获取知识库审核队列失败:', error)
      throw error
    }
  })

  ipcMain.handle('knowledge:review:update', (_, id, reviewStatus) => {
    try {
      return knowledgeService.updateReviewStatus(id, reviewStatus)
    } catch (error) {
      console.error('更新知识库审核状态失败:', error)
      throw error
    }
  })

  ipcMain.handle('knowledge:create', (_, novelId, data) => {
    try {
      return knowledgeService.createEntry(novelId, data)
    } catch (error) {
      console.error('创建知识库条目失败:', error)
      throw error
    }
  })

  ipcMain.handle('knowledge:update', (_, id, data) => {
    try {
      return knowledgeService.updateEntry(id, data)
    } catch (error) {
      console.error('更新知识库条目失败:', error)
      throw error
    }
  })

  ipcMain.handle('knowledge:delete', (_, id) => {
    try {
      return knowledgeService.deleteEntry(id)
    } catch (error) {
      console.error('删除知识库条目失败:', error)
      throw error
    }
  })

  ipcMain.handle('knowledge:upsert', (_, novelId, data) => {
    try {
      return knowledgeService.upsertEntry(novelId, data)
    } catch (error) {
      console.error('写入知识库条目失败:', error)
      throw error
    }
  })

  ipcMain.handle('knowledge:syncFromMemory', (_, novelId) => {
    try {
      return knowledgeService.syncFromMemory(novelId)
    } catch (error) {
      console.error('同步知识库失败:', error)
      throw error
    }
  })
}

module.exports = {
  registerKnowledgeHandlers
}
