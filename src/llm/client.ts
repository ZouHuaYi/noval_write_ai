export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function callChatModel(systemPrompt: string, userPrompt: string) {
  if (!window.electronAPI?.llm) {
    throw new Error('LLM API 未加载')
  }

  return await window.electronAPI.llm.chat({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  })
}
