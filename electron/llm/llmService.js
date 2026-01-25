const settingsDAO = require('../database/settingsDAO')
const { setTimeout } = require('timers/promises')

async function fetchWithRetry(url, options, retries = 3, timeout = 60000) {
  let lastError

  for (let i = 0; i < retries; i++) {
    const controller = new AbortController()
    const id = global.setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      })

      clearTimeout(id)

      if (response.ok) {
        return response
      }

      // If 429 (Too Many Requests) or 5xx (Server Error), retry
      if (response.status === 429 || response.status >= 500) {
        const errorText = await response.text()
        lastError = new Error(`Request failed: ${response.status} ${response.statusText} - ${errorText}`)
        console.warn(`Attempt ${i + 1} failed, retrying...`, lastError.message)
      } else {
        // Client error (4xx except 429), do not retry
        const text = await response.text()
        throw new Error(`Request failed: ${response.status} ${response.statusText} - ${text}`)
      }

    } catch (error) {
      clearTimeout(id)
      lastError = error
      console.warn(`Attempt ${i + 1} failed:`, error.message)

      // Don't retry if aborted by us (timeout)
      if (error.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeout}ms`)
      }
    }

    // Wait before retry (exponential backoff: 1s, 2s, 4s...)
    if (i < retries - 1) {
      await setTimeout(1000 * Math.pow(2, i))
    }
  }

  throw lastError
}


function sortConfigs(configs) {
  const list = [...configs]
  return list.sort((a, b) => {
    const aDefault = a.isDefault ? 1 : 0
    const bDefault = b.isDefault ? 1 : 0
    if (aDefault !== bDefault) {
      return bDefault - aDefault
    }
    return (a.createdAt || 0) - (b.createdAt || 0)
  })
}

// LLM 对话模型相关
async function getAllLLMConfigs() {
  const configs = settingsDAO.getSetting('llm_configs')
  if (Array.isArray(configs)) {
    return sortConfigs(configs)
  }
  return []
}

async function getDefaultChatConfig() {
  const configs = await getAllLLMConfigs()
  if (!configs.length) return null
  const def = configs.find(c => c.isDefault)
  return def || configs[0]
}


async function callChatModel(options) {
  const baseConfig = await getDefaultChatConfig()
  if (!baseConfig) {
    throw new Error('未找到默认 LLM 配置，请先在设置中添加并设为默认')
  }


  const config = {
    ...baseConfig,
    ...(options.configOverride || {})
  }

  const model = config.model

  if (!config.apiBase || !config.apiKey || !model) {
    throw new Error('LLM 配置不完整，请检查 API 地址、Key 和模型名称')
  }

  const url = config.apiBase.replace(/\/$/, '') + '/chat/completions'

  const body = {
    model,
    messages: options.messages || [],
    temperature: options.temperature != null ? options.temperature : (config.temperature != null ? config.temperature : 0.7)
  }

  if (options.maxTokens != null || config.maxTokens != null) {
    body.max_tokens = options.maxTokens != null ? options.maxTokens : config.maxTokens
  }

  // 120s timeout for chat completion
  const resp = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }, 3, 240000)

  const data = await resp.json()
  const content =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    ''

  return content
}

module.exports = {
  getAllLLMConfigs,
  getDefaultChatConfig,
  callChatModel
}
