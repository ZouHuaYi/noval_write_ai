const chapterGenerator = require('../llm/chapterGenerator')
const chapterSnapshotDAO = require('../database/chapterSnapshotDAO')

function registerChapterGenerationHandlers(ipcMain) {
  ipcMain.handle('chapter:snapshot:list', (_, chapterId) => {
    try {
      return chapterSnapshotDAO.listSnapshotsByChapter(chapterId)
    } catch (error) {
      console.error('获取章节快照失败:', error)
      throw error
    }
  })

  ipcMain.handle('chapter:snapshot:restore', (_, snapshotId) => {
    try {
      return chapterSnapshotDAO.restoreSnapshot(snapshotId)
    } catch (error) {
      console.error('恢复章节快照失败:', error)
      throw error
    }
  })

  ipcMain.handle('chapter:generateChunks', async (_, payload) => {
    try {
      const result = await chapterGenerator.generateChapterChunks(payload)
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

  ipcMain.handle('chapter:generateStatus', (_, chapterId) => {
    try {
      return chapterGenerator.getGenerationStatus(chapterId)
    } catch (error) {
      console.error('获取生成状态失败:', error)
      throw error
    }
  })

  ipcMain.handle('chapter:generateReset', (_, chapterId) => {
    try {
      return chapterGenerator.resetGeneration(chapterId)
    } catch (error) {
      console.error('重置生成状态失败:', error)
      throw error
    }
  })

  // 一致性检查 Diff 格式
  ipcMain.handle('chapter:checkConsistencyDiff', async (_, novelId, chapterId, content, extraPrompt) => {
    try {
      const llmService = require('../llm/llmService')
      const { safeParseJSON } = require('../utils/helpers')

      // 构建提示词
      const novelDAO = require('../database/novelDAO')
      const novel = novelDAO.getNovelById(novelId)
      const novelTitle = novel?.title || '未命名'

      const systemPrompt = `你是小说一致性检查助手。请检查章节内容的人物、时间线、设定与逻辑漏洞。

对于每个发现的问题,你需要:
1. 找出原文中存在问题的具体片段(50-200字)
2. **计算该片段在章节中的起始和结束位置(字符索引,从0开始)**
3. 提供修改后的文本建议
4. 说明修改理由

返回 JSON 格式:
{
  "summary": "总体检查摘要",
  "suggestions": [
    {
      "id": "唯一标识(如 suggestion-1)",
      "category": "问题分类(如'人物年龄与行为表现')",
      "issue": "不一致点描述",
      "originalText": "原文片段(精确摘录,不要修改)",
      "suggestedText": "建议修改后的文本",
      "reason": "修改理由",
      "startIndex": 起始位置(数字),
      "endIndex": 结束位置(数字)
    }
  ]
}

**重要说明**:
- originalText 必须是原文的精确片段,方便后续替换
- startIndex 和 endIndex 必须精确对应 originalText 在章节中的位置
- 位置索引从 0 开始计数,endIndex 是结束位置的下一个字符(不包含)
- 可以通过在章节内容中搜索 originalText 来确定位置
- 如果无法确定精确位置,可以省略 startIndex 和 endIndex
- suggestedText 应该是完整的替换文本,保持上下文连贯
- 每个建议应该独立,不要相互依赖`

      const userPrompt = `【小说标题】
${novelTitle}

【章节内容】
${content || '无'}

【检查重点】
${extraPrompt || '全面检查'}

【输出要求】
严格按照 JSON 格式返回检查结果。`

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
