/**
 * ReIO IPC Handlers
 * 处理 ReIO 检查相关的 IPC 请求，实现写作流程闭环
 */
const reioChecker = require('../llm/reioChecker')

function registerReIOHandlers(ipcMain) {
  // 完整的 ReIO 检查
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

  // 快速一致性检查
  ipcMain.handle('reio:quickCheck', async (_, text, constraints) => {
    try {
      const result = await reioChecker.quickConsistencyCheck(text, constraints || [])
      return result
    } catch (error) {
      console.error('ReIO 快速检查失败:', error)
      throw error
    }
  })

  // 请求重写内容
  ipcMain.handle('reio:rewrite', async (_, options) => {
    try {
      const rewritten = await reioChecker.rewriteContent({
        originalText: options.originalText,
        issues: options.issues || [],
        suggestion: options.suggestion,
        eventGoal: options.eventGoal,
        memoryContext: options.memoryContext,
        systemPrompt: options.systemPrompt
      })
      return rewritten
    } catch (error) {
      console.error('ReIO 重写失败:', error)
      throw error
    }
  })

  // 获取 ReIO 统计信息
  ipcMain.handle('reio:stats', async () => {
    try {
      return reioChecker.getReIOStats()
    } catch (error) {
      console.error('获取 ReIO 统计失败:', error)
      return null
    }
  })

  // 重置 ReIO 统计
  ipcMain.handle('reio:resetStats', async () => {
    try {
      reioChecker.resetReIOStats()
      return true
    } catch (error) {
      console.error('重置 ReIO 统计失败:', error)
      return false
    }
  })

  // 完整的 ReIO 生成流程（生成 + 检查 + 重写）
  ipcMain.handle('reio:generateWithCheck', async (_, options) => {
    try {
      const llmService = require('../llm/llmService')

      // 定义生成函数
      const generate = async () => {
        const content = await llmService.callChatModel({
          messages: options.messages,
          temperature: options.temperature || 0.7
        })
        return content?.trim() || ''
      }

      // 执行 ReIO 流程
      const result = await reioChecker.generateWithReIO({
        generate,
        context: {
          eventGoal: options.eventGoal,
          memoryContext: options.memoryContext,
          activeCharacters: options.activeCharacters || [],
          worldRules: options.worldRules || [],
          systemPrompt: options.systemPrompt,
          novelId: options.novelId
        },
        maxRetries: options.maxRetries || 2
      })

      return result
    } catch (error) {
      console.error('ReIO 生成流程失败:', error)
      throw error
    }
  })

  // 从记忆上下文提取活跃角色
  ipcMain.handle('reio:extractCharacters', async (_, memoryContext) => {
    try {
      return reioChecker.extractActiveCharacters(memoryContext)
    } catch (error) {
      console.error('提取角色失败:', error)
      return []
    }
  })

  // 从世界观提取规则
  ipcMain.handle('reio:extractWorldRules', async (_, novelId) => {
    try {
      return await reioChecker.extractWorldRules(novelId)
    } catch (error) {
      console.error('提取世界规则失败:', error)
      return []
    }
  })
}

module.exports = {
  registerReIOHandlers
}
