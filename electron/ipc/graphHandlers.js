/**
 * 知识图谱 IPC Handlers
 */
const { getGraphManager } = require('../graph/graphManager')

function registerGraphHandlers(ipcMain) {
  const manager = getGraphManager()

  // ===== 图谱管理 =====

  // 获取图谱统计
  ipcMain.handle('graph:getStats', async (_, novelId) => {
    try {
      return manager.getStats(novelId)
    } catch (error) {
      console.error('获取图谱统计失败:', error)
      throw error
    }
  })

  // 导出可视化数据
  ipcMain.handle('graph:exportForVisualization', async (_, novelId) => {
    try {
      return manager.exportForVisualization(novelId)
    } catch (error) {
      console.error('导出可视化数据失败:', error)
      throw error
    }
  })

  // 获取角色关系网络
  ipcMain.handle('graph:getCharacterNetwork', async (_, novelId) => {
    try {
      return manager.getCharacterNetwork(novelId)
    } catch (error) {
      console.error('获取角色网络失败:', error)
      throw error
    }
  })

  // 保存图谱
  ipcMain.handle('graph:save', async (_, novelId) => {
    try {
      return manager.saveGraph(novelId)
    } catch (error) {
      console.error('保存图谱失败:', error)
      throw error
    }
  })

  // 加载图谱
  ipcMain.handle('graph:load', async (_, novelId) => {
    try {
      manager.getGraph(novelId)
      return { success: true }
    } catch (error) {
      console.error('加载图谱失败:', error)
      throw error
    }
  })

  // 删除图谱
  ipcMain.handle('graph:delete', async (_, novelId) => {
    try {
      return manager.deleteGraph(novelId)
    } catch (error) {
      console.error('删除图谱失败:', error)
      throw error
    }
  })

  // 清空图谱(保留图谱实例,只清空所有节点和边)
  ipcMain.handle('graph:clear', async (_, novelId) => {
    try {
      return manager.clearGraph(novelId)
    } catch (error) {
      console.error('清空图谱失败:', error)
      throw error
    }
  })

  // 删除章节相关图谱数据
  ipcMain.handle('graph:cleanupChapter', async (_, novelId, chapterNumber) => {
    try {
      return manager.cleanupChapter(novelId, chapterNumber)
    } catch (error) {
      console.error('清理章节图谱失败:', error)
      throw error
    }
  })


  // ===== 节点操作 =====

  // 获取所有节点
  ipcMain.handle('graph:getAllNodes', async (_, novelId, type) => {
    try {
      const graph = manager.getGraph(novelId)
      return graph.getAllNodes(type)
    } catch (error) {
      console.error('获取节点失败:', error)
      throw error
    }
  })

  // 获取单个节点
  ipcMain.handle('graph:getNode', async (_, novelId, nodeId) => {
    try {
      const graph = manager.getGraph(novelId)
      return graph.getNode(nodeId)
    } catch (error) {
      console.error('获取节点失败:', error)
      throw error
    }
  })

  // 添加节点
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

  // 更新节点
  ipcMain.handle('graph:updateNode', async (_, novelId, id, attributes) => {
    try {
      const graph = manager.getGraph(novelId)
      const result = graph.updateNode(id, attributes)
      manager.saveGraph(novelId)
      return result
    } catch (error) {
      console.error('更新节点失败:', error)
      throw error
    }
  })

  // 删除节点
  ipcMain.handle('graph:removeNode', async (_, novelId, id) => {
    try {
      const graph = manager.getGraph(novelId)
      const result = graph.removeNode(id)
      manager.saveGraph(novelId)
      return result
    } catch (error) {
      console.error('删除节点失败:', error)
      throw error
    }
  })

  // ===== 边操作 =====

  // 添加边
  ipcMain.handle('graph:addEdge', async (_, novelId, source, target, attributes) => {
    try {
      const graph = manager.getGraph(novelId)
      const result = graph.addEdge(source, target, attributes)
      manager.saveGraph(novelId)
      return result
    } catch (error) {
      console.error('添加边失败:', error)
      throw error
    }
  })

  // 获取节点的边
  ipcMain.handle('graph:getNodeEdges', async (_, novelId, nodeId, direction) => {
    try {
      const graph = manager.getGraph(novelId)
      return graph.getNodeEdges(nodeId, direction)
    } catch (error) {
      console.error('获取边失败:', error)
      throw error
    }
  })

  // 删除边
  ipcMain.handle('graph:removeEdge', async (_, novelId, edgeId) => {
    try {
      const graph = manager.getGraph(novelId)
      const result = graph.removeEdge(edgeId)
      manager.saveGraph(novelId)
      return result
    } catch (error) {
      console.error('删除边失败:', error)
      throw error
    }
  })

  // ===== 查询操作 =====

  // 查找邻居
  ipcMain.handle('graph:findNeighbors', async (_, novelId, nodeId, depth) => {
    try {
      const graph = manager.getGraph(novelId)
      return graph.findNeighbors(nodeId, depth)
    } catch (error) {
      console.error('查找邻居失败:', error)
      throw error
    }
  })

  // 查找路径
  ipcMain.handle('graph:findPath', async (_, novelId, source, target) => {
    try {
      return manager.findPath(novelId, source, target)
    } catch (error) {
      console.error('查找路径失败:', error)
      throw error
    }
  })

  // 搜索实体
  ipcMain.handle('graph:searchEntities', async (_, novelId, query, type) => {
    try {
      return manager.searchEntities(novelId, query, type)
    } catch (error) {
      console.error('搜索实体失败:', error)
      throw error
    }
  })

  // ===== 一致性检查 =====

  // 执行完整检查
  ipcMain.handle('graph:checkConsistency', async (_, novelId) => {
    try {
      return manager.checkConsistency(novelId)
    } catch (error) {
      console.error('一致性检查失败:', error)
      throw error
    }
  })

  // 验证新内容
  ipcMain.handle('graph:validateContent', async (_, novelId, content, chapter) => {
    try {
      return manager.validateContent(novelId, content, chapter)
    } catch (error) {
      console.error('内容验证失败:', error)
      throw error
    }
  })

  // ===== 自动提取 =====

  // 分析章节，自动更新图谱
  ipcMain.handle('graph:analyzeChapter', async (_, novelId, chapter, content, previousContent, contentHash) => {
    try {
      return manager.onChapterUpdate(novelId, chapter, content, previousContent, contentHash)
    } catch (error) {
      console.error('章节分析失败:', error)
      throw error
    }
  })

  // ===== 批量操作 =====

  // 批量导入实体
  ipcMain.handle('graph:importEntities', async (_, novelId, entities) => {
    try {
      return manager.importEntities(novelId, entities)
    } catch (error) {
      console.error('导入实体失败:', error)
      throw error
    }
  })

  // 批量添加关系
  ipcMain.handle('graph:addRelations', async (_, novelId, relations) => {
    try {
      return manager.addRelations(novelId, relations)
    } catch (error) {
      console.error('添加关系失败:', error)
      throw error
    }
  })

  // 导出图谱 JSON
  ipcMain.handle('graph:exportJSON', async (_, novelId) => {
    try {
      const graph = manager.getGraph(novelId)
      return graph.toJSON()
    } catch (error) {
      console.error('导出 JSON 失败:', error)
      throw error
    }
  })
}

module.exports = {
  registerGraphHandlers
}
