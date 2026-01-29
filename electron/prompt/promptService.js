const settingsDAO = require('../database/settingsDAO')
const { promptDefaults } = require('./promptDefaults')

/**
 * 构建默认 prompt 映射
 */
function buildDefaultMap() {
  const map = new Map()
  promptDefaults.forEach(item => {
    if (item?.id) {
      map.set(item.id, item)
    }
  })
  return map
}

/**
 * 获取自定义 prompt 配置
 */
function getPromptOverrides() {
  const overrides = settingsDAO.getSetting('prompt_configs')
  return Array.isArray(overrides) ? overrides : []
}

/**
 * 获取单个 Prompt 覆盖配置（仅在启用时返回）
 */
function getPromptOverride(id) {
  const override = getPromptOverrides().find(item => item?.id === id)
  if (!override || override.enabled === false) return null
  return override
}

/**
 * 保存自定义 prompt 配置
 */
function savePromptOverrides(overrides) {
  const safeOverrides = Array.isArray(overrides) ? overrides : []
  return settingsDAO.setSetting('prompt_configs', safeOverrides, 'Prompt 配置')
}

/**
 * 简单模板渲染（{{key}}）
 */
function renderTemplate(template, variables = {}) {
  if (!template) return ''
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, rawKey) => {
    const keys = rawKey.split('.')
    let value = variables
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

/**
 * 合并默认与自定义配置（用于管理界面）
 */
function listPrompts() {
  const defaultsMap = buildDefaultMap()
  const overrides = getPromptOverrides()
  const overrideMap = new Map()
  overrides.forEach(item => {
    if (item?.id) {
      overrideMap.set(item.id, item)
    }
  })

  const merged = []

  defaultsMap.forEach((def) => {
    const override = overrideMap.get(def.id)
    const enabled = override?.enabled !== false
    merged.push({
      id: def.id,
      name: def.name || def.id,
      domain: def.domain || 'general',
      description: def.description || '',
      enabled,
      systemPrompt: enabled ? (override?.systemPrompt ?? def.systemPrompt ?? '') : (def.systemPrompt ?? ''),
      userPrompt: enabled ? (override?.userPrompt ?? def.userPrompt ?? '') : (def.userPrompt ?? ''),
      defaultSystemPrompt: def.systemPrompt ?? '',
      defaultUserPrompt: def.userPrompt ?? '',
      overrideSystemPrompt: override?.systemPrompt ?? '',
      overrideUserPrompt: override?.userPrompt ?? '',
      updatedAt: override?.updatedAt || def.updatedAt || null,
      source: override ? 'override' : 'default'
    })
  })

  // 追加仅存在于自定义配置的条目
  overrideMap.forEach((override, id) => {
    if (!defaultsMap.has(id)) {
      merged.push({
        id,
        name: override.name || id,
        domain: override.domain || 'custom',
        description: override.description || '',
        enabled: override.enabled !== false,
        systemPrompt: override.systemPrompt || '',
        userPrompt: override.userPrompt || '',
        defaultSystemPrompt: '',
        defaultUserPrompt: '',
        overrideSystemPrompt: override.systemPrompt || '',
        overrideUserPrompt: override.userPrompt || '',
        updatedAt: override.updatedAt || null,
        source: 'custom'
      })
    }
  })

  return merged
}

/**
 * 解析 prompt 文本（自动合并默认与覆盖）
 */
function resolvePrompt(id, fallback = {}) {
  const defaultsMap = buildDefaultMap()
  const override = getPromptOverrides().find(item => item?.id === id)
  const def = defaultsMap.get(id)
  const enabled = override?.enabled !== false

  const systemPrompt = enabled
    ? (override?.systemPrompt ?? def?.systemPrompt ?? fallback.systemPrompt ?? '')
    : (def?.systemPrompt ?? fallback.systemPrompt ?? '')
  const userPrompt = enabled
    ? (override?.userPrompt ?? def?.userPrompt ?? fallback.userPrompt ?? '')
    : (def?.userPrompt ?? fallback.userPrompt ?? '')

  return { systemPrompt, userPrompt }
}

/**
 * 渲染 prompt 模板（含覆盖模板）
 */
function renderPrompt(id, fallbackTemplate, variables, field = 'userPrompt') {
  const defaultsMap = buildDefaultMap()
  const override = getPromptOverrides().find(item => item?.id === id)
  const def = defaultsMap.get(id)
  const enabled = override?.enabled !== false

  const template = enabled
    ? (override?.[field] ?? def?.[field] ?? fallbackTemplate ?? '')
    : (def?.[field] ?? fallbackTemplate ?? '')

  return renderTemplate(template, variables)
}

module.exports = {
  listPrompts,
  savePromptOverrides,
  resolvePrompt,
  renderPrompt,
  renderTemplate,
  getPromptOverride
}
