export type ChapterContinueInput = {
  novelTitle?: string
  chapterTitle?: string
  chapterNumber?: number | null
  content: string
  outlineContext?: string
  memoryContext?: string
  worldviewContext?: string
  extraPrompt?: string
}

export type ChapterPolishInput = {
  text: string
  extraPrompt?: string
}

export type ChapterConsistencyInput = {
  novelTitle?: string
  content: string
  extraPrompt?: string
}

const formatSection = (title: string, content: string) => `【${title}】\n${content || '无'}\n`

export const chapterSkills = {
  continue: {
    systemPrompt: '你是小说写作助手。根据给定上下文续写章节，保持原文叙事视角与文风，语言精炼克制，避免赘述与空泛描写，不重复已有内容，不输出标题或说明，只输出章节正文。',
    buildUserPrompt: ({
      novelTitle,
      chapterTitle,
      chapterNumber,
      content,
      outlineContext,
      memoryContext,
      worldviewContext,
      extraPrompt
    }: ChapterContinueInput) => {
      return [
        formatSection('小说信息', `标题：${novelTitle || '未命名'}\n章节：第 ${chapterNumber ?? '?'} 章 · ${chapterTitle || '未命名'}`),
        formatSection('章节已写内容', content || '无'),
        formatSection('关联大纲', outlineContext || '无匹配大纲'),
        formatSection('记忆上下文', memoryContext || '无可用记忆'),
        formatSection('世界观与核心规则', worldviewContext || '无设定数据'),
        formatSection('作者补充要求', extraPrompt || '无'),
        formatSection('输出要求', '请基于以上上下文（特别是章节计划中的目标与事件），生成本章后续内容。总字数控制在 1200-1500 左右，每段 200-400 字，信息密度高、情节推进明确，保持画面感与节奏感，避免水字。这一段必须承接上一段最后一句的情绪/动作，不要重新起头。每 2-3 段安排一次“缓冲段”（走路、观察、对话、内心）。只输出正文内容。')
      ].join('\n')
    }
  },
  polish: {
    systemPrompt: '你是中文小说文本润色助手。保持原意与叙事视角不变，优化流畅度、节奏和细节描写。只输出润色后的文本，不要添加说明。',
    buildUserPrompt: ({ text, extraPrompt }: ChapterPolishInput) => {
      return [
        formatSection('待润色文本', text),
        formatSection('润色要求', extraPrompt || '无'),
        formatSection('输出要求', '保持原意与人称，提升可读性，输出润色后的完整文本。')
      ].join('\n')
    }
  },
  consistency: {
    systemPrompt: `你是小说一致性检查助手。请检查章节内容的人物、时间线、设定与逻辑漏洞。

对于每个发现的问题,你需要:
1. 找出原文中存在问题的具体片段(50-200字)
2. 提供修改后的文本建议
3. 说明修改理由

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
      "reason": "修改理由"
    }
  ]
}

注意:
- originalText 必须是原文的精确片段,方便后续替换
- suggestedText 应该是完整的替换文本,保持上下文连贯
- 每个建议应该独立,不要相互依赖`,
    buildUserPrompt: ({ novelTitle, content, extraPrompt }: ChapterConsistencyInput) => {
      return [
        formatSection('小说标题', novelTitle || '未命名'),
        formatSection('章节内容', content || '无'),
        formatSection('检查重点', extraPrompt || '全面检查'),
        formatSection('输出要求', '严格按照 JSON 格式返回检查结果。')
      ].join('\n')
    }
  }
}
