export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type ChatCallOptions = {
  temperature?: number
  maxTokens?: number
}

export async function callChatModel(systemPrompt: string, userPrompt: string, options: ChatCallOptions = {}) {
  if (!window.electronAPI?.llm) {
    throw new Error('LLM API 未加载')
  }

  return await window.electronAPI.llm.chat({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    // 允许调用方覆盖 maxTokens/temperature
    ...options
  })
}
