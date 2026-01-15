export type ChapterContinueInput = {
  novelTitle?: string
  chapterTitle?: string
  content: string
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

export const chapterSkills = {
  continue: {
    systemPrompt: '你是小说续写助手。请基于提供的章节内容进行续写，保持文风一致。只输出续写内容，不要重复已有文本，也不要添加标题或说明。',
    buildUserPrompt: ({ novelTitle, chapterTitle, content, extraPrompt }: ChapterContinueInput) => {
      return `小说标题：${novelTitle || '未命名'}\n章节标题：${chapterTitle || '未命名'}\n\n已写内容：\n${content}\n\n作者要求：${extraPrompt || '无'}\n\n请续写 2-4 个自然段。`
    }
  },
  polish: {
    systemPrompt: '你是中文小说文本润色助手。请在不改变原意的前提下优化表达、流畅度和细节。只输出润色后的文本，不要添加说明。',
    buildUserPrompt: ({ text, extraPrompt }: ChapterPolishInput) => {
      return `待润色内容：\n${text}\n\n润色要求：${extraPrompt || '无'}\n\n请输出润色后的文本。`
    }
  },
  consistency: {
    systemPrompt: '你是小说一致性检查助手。请指出人物、时间线、设定、情节逻辑等可能的不一致，并给出修复建议。用列表输出。',
    buildUserPrompt: ({ novelTitle, content, extraPrompt }: ChapterConsistencyInput) => {
      return `小说标题：${novelTitle || '未命名'}\n\n章节内容：\n${content}\n\n检查重点：${extraPrompt || '无'}\n\n请输出检查结果。`
    }
  }
}
