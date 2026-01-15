export type OutlineGenerateInput = {
  novelTitle?: string
  outlineTitle?: string
  startChapter?: number | null
  endChapter?: number | null
  extraPrompt?: string
}

export type OutlinePolishInput = {
  outlineContent?: string
  extraPrompt?: string
}

export type OutlineLogicInput = {
  novelTitle?: string
  outlineContent?: string
  extraPrompt?: string
}

export const outlineSkills = {
  generate: {
    systemPrompt: '你是小说章节区间大纲生成助手。请根据已有信息生成结构清晰的写作指导型大纲，使用 Markdown 输出，不要输出正文。',
    buildUserPrompt: ({ novelTitle, outlineTitle, startChapter, endChapter, extraPrompt }: OutlineGenerateInput) => {
      return `小说标题：${novelTitle || '未命名'}\n大纲标题：${outlineTitle || '未命名'}\n章节范围：第 ${startChapter || '?'} 章 - 第 ${endChapter || '?'} 章\n\n作者要求：${extraPrompt || '无'}\n\n请生成该范围的阶段性大纲。`
    }
  },
  polish: {
    systemPrompt: '你是小说大纲优化助手。请在不改变主线的前提下优化结构、节奏与冲突表达，输出优化后的大纲（Markdown）。',
    buildUserPrompt: ({ outlineContent, extraPrompt }: OutlinePolishInput) => {
      return `当前大纲内容：\n${outlineContent || '（无）'}\n\n优化要求：${extraPrompt || '无'}\n\n请输出优化后的大纲。`
    }
  },
  logic: {
    systemPrompt: '你是小说大纲逻辑检查助手。请指出逻辑问题、冲突点和建议修复方案，使用列表输出。',
    buildUserPrompt: ({ novelTitle, outlineContent, extraPrompt }: OutlineLogicInput) => {
      return `小说标题：${novelTitle || '未命名'}\n\n大纲内容：\n${outlineContent || '（无）'}\n\n检查重点：${extraPrompt || '无'}\n\n请输出检查结果。`
    }
  }
}
