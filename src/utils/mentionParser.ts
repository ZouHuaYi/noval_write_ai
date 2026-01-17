/**
 * @DSL 上下文注入工具
 * 将编辑器中的 @提及 解析并转换为 AI Prompt 上下文
 */

import type { KnowledgeEntry } from '@/shared/schemas'

/**
 * 从 HTML 内容中提取所有 @提及的 ID
 */
export function extractMentionIds(html: string): string[] {
  const mentions: string[] = []
  // 匹配 TipTap Mention 节点的 data-id 属性
  const regex = /data-id="([^"]+)"/g
  let match
  while ((match = regex.exec(html)) !== null) {
    if (!mentions.includes(match[1])) {
      mentions.push(match[1])
    }
  }
  return mentions
}

/**
 * 从 HTML 内容中提取所有 @提及的标签名
 */
export function extractMentionLabels(html: string): string[] {
  const labels: string[] = []
  // 匹配 <span data-type="mention" data-id="..." data-label="...">@xxx</span>
  const regex = /<span[^>]*class="mention"[^>]*>@([^<]+)<\/span>/g
  let match
  while ((match = regex.exec(html)) !== null) {
    if (!labels.includes(match[1])) {
      labels.push(match[1])
    }
  }
  return labels
}

/**
 * 将 @提及的知识条目转换为 Prompt 上下文
 */
export function buildMentionContext(
  mentionIds: string[],
  knowledgeMap: Map<string, KnowledgeEntry>
): string {
  const sections: string[] = []

  for (const id of mentionIds) {
    const entry = knowledgeMap.get(id)
    if (!entry) continue

    let context = `【${getTypeLabel(entry.type)}：${entry.name}】`

    if (entry.summary) {
      context += `\n摘要：${entry.summary}`
    }

    if (entry.detail) {
      // 截断过长的详情
      const detail = entry.detail.length > 500
        ? entry.detail.substring(0, 500) + '...'
        : entry.detail
      context += `\n详情：${detail}`
    }

    if (entry.aliases && entry.aliases.length > 0) {
      context += `\n别名：${entry.aliases.join('、')}`
    }

    sections.push(context)
  }

  if (sections.length === 0) {
    return ''
  }

  return `【引用的知识库内容】\n${sections.join('\n\n')}`
}

/**
 * 类型标签
 */
function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    character: '角色',
    location: '地点',
    event: '事件',
    item: '物品',
    rule: '规则',
    other: '其他',
  }
  return labels[type] || '其他'
}

/**
 * 将 HTML 内容转换为纯文本（用于字数统计）
 */
export function htmlToPlainText(html: string): string {
  // 移除 HTML 标签
  let text = html.replace(/<[^>]+>/g, '')
  // 解码 HTML 实体
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&quot;/g, '"')
  return text.trim()
}

/**
 * 将 @提及 替换为实际内容（用于发送给 AI）
 */
export function replaceMentionsWithContent(
  html: string,
  knowledgeMap: Map<string, KnowledgeEntry>,
  format: 'inline' | 'expanded' = 'inline'
): string {
  // 匹配 mention 标签
  const regex = /<span[^>]*class="mention"[^>]*data-id="([^"]+)"[^>]*>@([^<]+)<\/span>/g

  return html.replace(regex, (match, id, label) => {
    const entry = knowledgeMap.get(id)
    if (!entry) return `@${label}`

    if (format === 'inline') {
      // 内联格式：简短描述
      return `【${entry.name}${entry.summary ? `：${entry.summary}` : ''}】`
    } else {
      // 展开格式：完整信息
      return `\n【${getTypeLabel(entry.type)}：${entry.name}】\n${entry.summary || ''}\n${entry.detail || ''}\n`
    }
  })
}

/**
 * 构建完整的 AI 请求上下文
 * 包含编辑器内容 + @提及的知识库内容
 */
export interface BuildContextOptions {
  editorHtml: string
  knowledgeMap: Map<string, KnowledgeEntry>
  includeFullDetails?: boolean
}

export function buildFullContext(options: BuildContextOptions): {
  content: string
  mentionContext: string
  mentionIds: string[]
} {
  const { editorHtml, knowledgeMap, includeFullDetails = false } = options

  const mentionIds = extractMentionIds(editorHtml)
  const mentionContext = buildMentionContext(mentionIds, knowledgeMap)

  // 将 HTML 转换为纯文本，保留 @提及的语义
  let content = htmlToPlainText(editorHtml)

  // 如果需要完整详情，在内容后附加知识库信息
  if (includeFullDetails && mentionContext) {
    content = `${content}\n\n${mentionContext}`
  }

  return {
    content,
    mentionContext,
    mentionIds
  }
}
