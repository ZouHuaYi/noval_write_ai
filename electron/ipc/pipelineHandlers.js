const pipelineService = require('../pipeline/pipelineService')

// 流水线 IPC 处理器
function registerPipelineHandlers(ipcMain) {
  ipcMain.handle('pipeline:start', async (_, options) => {
    try {
      return await pipelineService.startPipeline(options || {})
    } catch (error) {
      console.error('启动流水线失败:', error)
      throw error
    }
  })

  ipcMain.handle('pipeline:pause', async (_, runId) => {
    try {
      return await pipelineService.pausePipeline(runId)
    } catch (error) {
      console.error('暂停流水线失败:', error)
      throw error
    }
  })

  ipcMain.handle('pipeline:resume', async (_, runId) => {
    try {
      return await pipelineService.resumePipeline(runId)
    } catch (error) {
      console.error('继续流水线失败:', error)
      throw error
    }
  })

  ipcMain.handle('pipeline:status', async (_, runId) => {
    try {
      return pipelineService.getPipelineStatus(runId)
    } catch (error) {
      console.error('获取流水线状态失败:', error)
      throw error
    }
  })

  ipcMain.handle('pipeline:retryStep', async (_, { runId, stage, batchIndex }) => {
    try {
      return await pipelineService.retryPipelineStep(runId, stage, batchIndex)
    } catch (error) {
      console.error('重试流水线步骤失败:', error)
      throw error
    }
  })

  ipcMain.handle('pipeline:updateSettings', async (_, { runId, settings }) => {
    try {
      return await pipelineService.updatePipelineRunSettings(runId, settings || {})
    } catch (error) {
      console.error('更新流水线配置失败:', error)
      throw error
    }
  })

  ipcMain.handle('pipeline:listByNovel', async (_, novelId) => {
    try {
      return pipelineService.listPipelinesByNovel(novelId)
    } catch (error) {
      console.error('获取流水线列表失败:', error)
      throw error
    }
  })

  ipcMain.handle('pipeline:clear', async (_, novelId) => {
    try {
      return pipelineService.clearPipelineData(novelId)
    } catch (error) {
      console.error('清空流水线数据失败:', error)
      throw error
    }
  })
}

module.exports = {
  registerPipelineHandlers
}
