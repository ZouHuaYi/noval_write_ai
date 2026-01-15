/**
 * 从 LLM 输出中“尽最大可能”抽取合法 JSON
 */
function safeParseJSON(text) {
  try {
    return JSON.parse(text)
  } catch (_) {
    // 尝试截取第一个 { ... }
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      throw new Error("LLM 返回内容中未找到 JSON")
    }
    try {
      return JSON.parse(match[0])
    } catch (e) {
      console.log(JSON.stringify(text))
      throw new Error("JSON 修复失败：" + e.message)
    }
  }
}

module.exports = { safeParseJSON }
