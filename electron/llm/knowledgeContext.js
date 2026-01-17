const knowledgeEntryDAO = require('../database/knowledgeEntryDAO')

function normalizeText(value) {
  return (value || '').toString().trim()
}

function buildEntryLine(entry) {
  const name = normalizeText(entry.name)
  const summary = normalizeText(entry.summary)
  const tags = Array.isArray(entry.tags) && entry.tags.length > 0 ? `（${entry.tags.join('/') }）` : ''
  const chapter = entry.sourceChapter ? `第${entry.sourceChapter}章` : ''
  const base = [name, summary].filter(Boolean).join('：')
  return [base, chapter, tags].filter(Boolean).join(' · ')
}

function clampText(text, maxLength) {
  if (!text) return ''
  if (!maxLength) return text
  return text.length > maxLength ? text.slice(0, maxLength) + '…' : text
}

function scoreEntry(entry, currentChapter) {
  if (!currentChapter || !entry.sourceChapter) return 0
  const distance = Math.abs(currentChapter - entry.sourceChapter)
  return -distance
}

function buildKnowledgeContext(entries, maxChars) {
  if (!entries.length) return ''
  const lines = entries.map(buildEntryLine).filter(Boolean)
  if (!lines.length) return ''
  const content = `【知识库要点】\n${lines.join('\n')}`
  return clampText(content, maxChars)
}

function pickEntries(entries, options) {
  const maxItems = options.maxItems ?? 12
  const currentChapter = options.currentChapter ?? null
  const sorted = [...entries].sort((a, b) => scoreEntry(b, currentChapter) - scoreEntry(a, currentChapter))
  return sorted.slice(0, maxItems)
}

function loadKnowledgeEntries(novelId, type) {
  return knowledgeEntryDAO.listEntries(novelId, type, 'approved')
}

function buildKnowledgeSummary({ novelId, types, maxItems, currentChapter, maxChars }) {
  if (!novelId) return ''
  const allEntries = []
  types.forEach(type => {
    const entries = loadKnowledgeEntries(novelId, type)
    allEntries.push(...entries)
  })

  const picked = pickEntries(allEntries, { maxItems, currentChapter })
  return buildKnowledgeContext(picked, maxChars)
}

module.exports = {
  buildKnowledgeSummary
}
