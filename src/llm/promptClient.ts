export type PromptConfigItem = {
  id: string
  name: string
  domain: string
  description: string
  enabled: boolean
  systemPrompt: string
  userPrompt: string
  defaultSystemPrompt: string
  defaultUserPrompt: string
  overrideSystemPrompt: string
  overrideUserPrompt: string
  updatedAt: number | null
  source: 'default' | 'override' | 'custom'
}

// 简单模板渲染（{{key}}）
export function renderTemplate(template: string, variables: Record<string, any> = {}) {
  if (!template) return ''
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, rawKey) => {
    const keys = String(rawKey).split('.')
    let value: any = variables
    for (const key of keys) {
      if (value && Object.prototype.hasOwnProperty.call(value, key)) {
        value = value[key]
      } else {
        value = ''
        break
      }
    }
    return value == null ? '' : String(value)
  })
}

export async function listPrompts(): Promise<PromptConfigItem[]> {
  if (!window.electronAPI?.prompt) {
    throw new Error('Prompt API 未加载')
  }
  return await window.electronAPI.prompt.list()
}

export async function savePromptOverrides(overrides: Array<any>) {
  if (!window.electronAPI?.prompt) {
    throw new Error('Prompt API 未加载')
  }
  return await window.electronAPI.prompt.saveAll(overrides)
}
