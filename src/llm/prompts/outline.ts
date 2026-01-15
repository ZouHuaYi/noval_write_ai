export type OutlineGenerateInput = {
  novelTitle?: string
  outlineTitle?: string
  startChapter?: number | null
  endChapter?: number | null
  outlineContext?: string
  memoryContext?: string
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

const formatSection = (title: string, content: string) => `【${title}】\n${content || '无'}\n`

export const outlineSkills = {
  generate: {
    systemPrompt: '你是小说章节区间大纲生成助手。请结合既有大纲与记忆上下文，输出结构清晰的写作指导型大纲（Markdown）。不要输出正文。',
    buildUserPrompt: ({
      novelTitle,
      outlineTitle,
      startChapter,
      endChapter,
      outlineContext,
      memoryContext,
      extraPrompt
    }: OutlineGenerateInput) => {
      const rangeLabel = `第 ${startChapter ?? '?'} 章 - 第 ${endChapter ?? '?'} 章`
      return [
        formatSection('小说信息', `标题：${novelTitle || '未命名'}\n目标大纲：${outlineTitle || '未命名'}\n章节范围：${rangeLabel}`),
        formatSection('关联大纲', outlineContext || '无匹配大纲'),
        formatSection('记忆上下文', memoryContext || '无可用记忆'),
        formatSection('作者补充要求', extraPrompt || '无'),
        formatSection('输出要求', '使用 Markdown 分层输出，包含主要剧情走向、关键转折、角色推进与伏笔安排。')
      ].join('\n')
    }
  },
  polish: {
    systemPrompt: '你是小说大纲优化助手。在不改变主线的前提下优化结构、节奏与冲突表达，输出优化后的大纲（Markdown）。',
    buildUserPrompt: ({ outlineContent, extraPrompt }: OutlinePolishInput) => {
      return [
        formatSection('当前大纲内容', outlineContent || '（无）'),
        formatSection('优化要求', extraPrompt || '无'),
        formatSection('输出要求', '保持主线一致，优化节奏与冲突层次，输出完整大纲。')
      ].join('\n')
    }
  },
  logic: {
    systemPrompt: '你是小说大纲逻辑检查助手。请指出逻辑问题、冲突点和建议修复方案，使用列表输出。',
    buildUserPrompt: ({ novelTitle, outlineContent, extraPrompt }: OutlineLogicInput) => {
      return [
        formatSection('小说标题', novelTitle || '未命名'),
        formatSection('大纲内容', outlineContent || '（无）'),
        formatSection('检查重点', extraPrompt || '无'),
        formatSection('输出要求', '列表形式输出问题与对应修复建议。')
      ].join('\n')
    }
  }
}
