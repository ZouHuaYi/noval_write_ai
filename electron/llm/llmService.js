const settingsDAO = require('../database/settingsDAO')


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


// 向量模型相关
async function getAllVectorConfigs() {
  const configs = settingsDAO.getSetting('vector_configs')
  if (Array.isArray(configs)) {
    return sortConfigs(configs)
  }
  return []
}

async function getDefaultVectorConfig() {
  const configs = await getAllVectorConfigs()
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

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`调用 LLM 失败: ${resp.status} ${resp.statusText} - ${text}`)
  }

  const data = await resp.json()
  const content =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    ''

  return content
}

async function callEmbeddingModel(options) {
  const baseConfig = await getDefaultVectorConfig()
  if (!baseConfig) {
    throw new Error('未找到向量模型配置，请在设置中添加并设为默认')
  }


  const config = {
    ...baseConfig,
    ...(options.configOverride || {})
  }

  const model = config.model

  if (!config.apiBase || !config.apiKey || !model) {
    throw new Error('向量模型配置不完整，请检查 API 地址、Key 和模型名称')
  }

  const url = config.apiBase.replace(/\/$/, '') + '/embeddings'

  const body = {
    model,
    input: options.input
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`调用向量模型失败: ${resp.status} ${resp.statusText} - ${text}`)
  }

  const data = await resp.json()
  const embeddings =
    Array.isArray(data?.data) ? data.data.map(item => item.embedding) : []

  return embeddings
}

module.exports = {
  getAllLLMConfigs,
  getAllVectorConfigs,
  getDefaultChatConfig,
  getDefaultVectorConfig,
  callChatModel,
  callEmbeddingModel
}
