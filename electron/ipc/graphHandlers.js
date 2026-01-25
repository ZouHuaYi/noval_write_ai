/**
 * 知识图谱 IPC Handlers
 */
const { getGraphManager } = require('../graph/graphManager')

function registerGraphHandlers(ipcMain) {
  const manager = getGraphManager()

  ipcMain.handle('graph:getStats', async (_, novelId) => {
    try {
      return manager.getStats(novelId)
    } catch (error) {
      console.error('获取图谱统计失败:', error)
      throw error
    }
  })

  ipcMain.handle('graph:exportForVisualization', async (_, novelId) => {
    try {
      return manager.exportForVisualization(novelId)
    } catch (error) {
      console.error('导出可视化数据失败:', error)
      throw error
    }
  })

  ipcMain.handle('graph:save', async (_, novelId) => {
    try {
      return manager.saveGraph(novelId)
    } catch (error) {
      console.error('保存图谱失败:', error)
      throw error
    }
  })

  ipcMain.handle('graph:delete', async (_, novelId) => {
    try {
      return manager.deleteGraph(novelId)
    } catch (error) {
      console.error('删除图谱失败:', error)
      throw error
    }
  })

  ipcMain.handle('graph:clear', async (_, novelId) => {
    try {
      return manager.clearGraph(novelId)
    } catch (error) {
      console.error('清空图谱失败:', error)
      throw error
    }
  })

  ipcMain.handle('graph:addNode', async (_, novelId, id, attributes) => {
    try {
      const graph = manager.getGraph(novelId)
      const result = graph.addNode(id, attributes)
      manager.saveGraph(novelId)
      return result
    } catch (error) {
      console.error('添加节点失败:', error)
      throw error
    }
  })

  ipcMain.handle('graph:getNodeEdges', async (_, novelId, nodeId, direction) => {
    try {
      const graph = manager.getGraph(novelId)
      return graph.getNodeEdges(nodeId, direction)
    } catch (error) {
      console.error('获取边失败:', error)
      throw error
    }
  })

  ipcMain.handle('graph:searchEntities', async (_, novelId, query, type) => {
    try {
      return manager.searchEntities(novelId, query, type)
    } catch (error) {
      console.error('搜索实体失败:', error)
      throw error
    }
  })

  ipcMain.handle('graph:checkConsistency', async (_, novelId) => {
    try {
      return manager.checkConsistency(novelId)
    } catch (error) {
      console.error('一致性检查失败:', error)
      throw error
    }
  })

  ipcMain.handle('graph:analyzeChapter', async (_, novelId, chapter, content, previousContent, contentHash, options) => {
    try {
      return manager.onChapterUpdate(novelId, chapter, content, previousContent, options)
    } catch (error) {
      console.error('章节分析失败:', error)
      throw error
    }
  })

}

module.exports = {
  registerGraphHandlers
}
