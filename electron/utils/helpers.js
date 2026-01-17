/**
 * 共享工具函数 - Electron 主进程使用
 */

/**
 * 安全解析 JSON
 * @param {string} text - 要解析的文本
 * @returns {any} 解析结果，失败返回 null
 */
function safeParseJSON(text) {
  if (!text || typeof text !== 'string') {
    return null
  }

  // 尝试直接解析
  try {
    return JSON.parse(text)
  } catch (e) {
    // 继续尝试其他方法
  }

  // 尝试提取 JSON 块
  const jsonPatterns = [
    /```json\s*([\s\S]*?)\s*```/,  // Markdown JSON 代码块
    /```\s*([\s\S]*?)\s*```/,       // 普通代码块
    /(\{[\s\S]*\})/,                // 对象
    /(\[[\s\S]*\])/                 // 数组
  ]

  for (const pattern of jsonPatterns) {
    const match = text.match(pattern)
    if (match) {
      try {
        return JSON.parse(match[1])
      } catch (e) {
        // 继续尝试下一个模式
      }
    }
  }

  // 尝试修复常见的 JSON 问题
  try {
    // 移除尾随逗号
    let cleaned = text.replace(/,\s*([}\]])/g, '$1')
    // 移除注释
    cleaned = cleaned.replace(/\/\/.*$/gm, '')
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '')

    return JSON.parse(cleaned)
  } catch (e) {
    // 放弃
  }

  return null
}

/**
 * 深度合并对象
 */
function deepMerge(target, source) {
  if (!source) return target
  if (!target) return source

  const result = { ...target }

  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key], source[key])
    } else {
      result[key] = source[key]
    }
  }

  return result
}

/**
 * 生成唯一 ID
 */
function generateId(prefix = '') {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`
}

/**
 * 截断文本
 */
function truncate(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

module.exports = {
  safeParseJSON,
  deepMerge,
  generateId,
  truncate
}
