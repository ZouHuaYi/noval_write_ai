const chapterGenerator = require('../llm/chapterGenerator')
const promptService = require('../prompt/promptService')

function registerChapterGenerationHandlers(ipcMain) {

  ipcMain.handle('chapter:generateChunks', async (_, payload) => {
    try {
      const result = await chapterGenerator.generateChapterChunks({
        ...payload,
        modelSource: payload?.modelSource || 'workbench'
      })
      if (result?.chapter?.chapterNumber != null) {
        try {
          const planningDAO = require('../database/planningDAO')
          const chapters = planningDAO.listPlanningChapters(payload.novelId)
          const matched = chapters.find(ch => ch.chapterNumber === result.chapter.chapterNumber)
          if (matched) {
            const updated = {
              ...matched,
              status: result.status === 'completed' ? matched.status : 'in_progress'
            }
            planningDAO.upsertPlanningChapters(payload.novelId, [updated])
            if (result.status === 'completed') {
              result.planCompletionSuggested = true
            }
          }
        } catch (syncError) {
          console.error('同步规划状态失败:', syncError)
        }
      }
      return result
    } catch (error) {
      console.error('生成章节失败:', error)
      throw error
    }
  })

  ipcMain.handle('chapter:checkConsistencyDiff', async (_, novelId, chapterId, content, extraPrompt) => {
    try {
      const llmService = require('../llm/llmService')
      const { safeParseJSON } = require('../utils/helpers')

      // 构建提示词
      const novelDAO = require('../database/novelDAO')
      const novel = novelDAO.getNovelById(novelId)
      const novelTitle = novel?.title || '未命名'

      const { systemPrompt } = promptService.resolvePrompt('chapter.consistencyDiff.system')
      const userPrompt = promptService.renderPrompt('chapter.consistencyDiff.user', '', {
        novelTitle,
        content: content || '无',
        extraPrompt: extraPrompt || '全面检查'
      })

      const response = await llmService.callChatModel({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        maxTokens: 3000
      })

      // 解析 JSON 响应
      const parsed = safeParseJSON(response)

      if (!parsed || !parsed.suggestions) {
        throw new Error('一致性检查结果格式不正确')
      }

      // 确保每个建议都有 id
      parsed.suggestions = parsed.suggestions.map((s, index) => ({
        id: s.id || `suggestion-${index + 1}`,
        category: s.category || '其他',
        issue: s.issue || '',
        originalText: s.originalText || '',
        suggestedText: s.suggestedText || '',
        reason: s.reason || ''
      }))

      return parsed
    } catch (error) {
      console.error('一致性检查失败:', error)
      throw error
    }
  })
}

module.exports = {
  registerChapterGenerationHandlers
}
