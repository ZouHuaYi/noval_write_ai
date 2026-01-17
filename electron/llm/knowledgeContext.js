const { getGraphManager } = require('../graph/graphManager')

function normalizeText(value) {
  return (value || '').toString().trim()
}

function buildEntityLine(node) {
  const name = normalizeText(node.label || node.id)
  const desc = normalizeText(node.description)
  const type = node.type ? `(${node.type})` : ''
  const props = []
  if (node.properties) {
    if (node.properties.status) props.push(`状态: ${node.properties.status}`)
    if (node.properties.title) props.push(`称号: ${node.properties.title}`)
  }
  const propStr = props.length > 0 ? ` [${props.join(', ')}]` : ''
  return `${name}${type}：${desc}${propStr}`
}

function clampText(text, maxLength) {
  if (!text) return ''
  if (!maxLength) return text
  return text.length > maxLength ? text.slice(0, maxLength) + '…' : text
}

function buildKnowledgeSummary({ novelId, types = ['character', 'location'], maxItems = 10, maxChars = 1500 }) {
  if (!novelId) return ''

  try {
    const manager = getGraphManager()
    const graph = manager.getGraph(novelId)
    if (!graph) return ''

    const allNodes = []
    types.forEach(type => {
      const nodes = graph.getAllNodes(type)
      allNodes.push(...nodes)
    })

    // 简单排序：有描述的优先
    const sorted = allNodes.sort((a, b) => {
      const aScore = (a.description ? 10 : 0) + (a.properties ? 5 : 0)
      const bScore = (b.description ? 10 : 0) + (b.properties ? 5 : 0)
      return bScore - aScore
    })

    const picked = sorted.slice(0, maxItems)
    const lines = picked.map(buildEntityLine).filter(Boolean)

    if (!lines.length) return ''

    const content = `【知识图谱要点】\n${lines.join('\n')}`
    return clampText(content, maxChars)
  } catch (error) {
    console.error('构建知识摘要失败:', error)
    return ''
  }
}

module.exports = {
  buildKnowledgeSummary
}
