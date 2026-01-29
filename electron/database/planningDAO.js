const { getDatabase } = require('./index')
const { randomUUID } = require('crypto')

function serialize(value) {
  if (value == null) return null
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function parseJson(value, fallback) {
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function normalizeEvent(event) {
  return {
    id: event.id,
    novelId: event.novelId,
    label: event.label,
    description: event.description || '',
    eventType: event.eventType || '',
    chapter: event.chapter || null,
    characters: Array.isArray(event.characters) ? event.characters : [],
    preconditions: Array.isArray(event.preconditions) ? event.preconditions : [],
    postconditions: Array.isArray(event.postconditions) ? event.postconditions : [],
    dependencies: Array.isArray(event.dependencies) ? event.dependencies : []
  }
}

function normalizeChapter(chapter) {
  return {
    id: chapter.id,
    novelId: chapter.novelId,
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    summary: chapter.summary || chapter.description || '',
    targetWords: chapter.targetWords || chapter.wordCountTarget || null,
    status: chapter.status || 'pending',
    priority: chapter.priority || 'medium',
    focus: Array.isArray(chapter.focus) ? chapter.focus : (chapter.focusCharacters || []),
    writingHints: Array.isArray(chapter.writingHints) ? chapter.writingHints : [],
    events: Array.isArray(chapter.events) ? chapter.events : (chapter.includedEvents || []),
    lockWritingTarget: Boolean(chapter.lockWritingTarget),
    progress: chapter.progress || 0
  }
}

function upsertPlanningEvents(novelId, events = []) {
  const db = getDatabase()
  const now = Date.now()

  const insert = db.prepare(`
    INSERT INTO planning_event (
      id, novelId, label, description, eventType, chapter,
      characters, preconditions, postconditions, dependencies,
      createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const update = db.prepare(`
    UPDATE planning_event SET
      label = ?,
      description = ?,
      eventType = ?,
      chapter = ?,
      characters = ?,
      preconditions = ?,
      postconditions = ?,
      dependencies = ?,
      updatedAt = ?
    WHERE id = ? AND novelId = ?
  `)

  const getExisting = db.prepare(`SELECT id FROM planning_event WHERE id = ? AND novelId = ?`)

  const transaction = db.transaction(() => {
    events.forEach(raw => {
      const event = normalizeEvent({ ...raw, novelId })
      const exists = getExisting.get(event.id, novelId)
      const characters = serialize(event.characters)
      const preconditions = serialize(event.preconditions)
      const postconditions = serialize(event.postconditions)
      const dependencies = serialize(event.dependencies)

      if (exists) {
        update.run(
          event.label,
          event.description,
          event.eventType,
          event.chapter,
          characters,
          preconditions,
          postconditions,
          dependencies,
          now,
          event.id,
          novelId
        )
      } else {
        const id = event.id || randomUUID()
        insert.run(
          id,
          novelId,
          event.label,
          event.description,
          event.eventType,
          event.chapter,
          characters,
          preconditions,
          postconditions,
          dependencies,
          now,
          now
        )
      }
    })
  })

  transaction()
}

function deletePlanningEventsByNovel(novelId) {
  const db = getDatabase()
  return db.prepare('DELETE FROM planning_event WHERE novelId = ?').run(novelId)
}

function listPlanningEvents(novelId) {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM planning_event WHERE novelId = ? ORDER BY chapter ASC, createdAt ASC').all(novelId)
  return rows.map(row => ({
    ...row,
    characters: parseJson(row.characters, []),
    preconditions: parseJson(row.preconditions, []),
    postconditions: parseJson(row.postconditions, []),
    dependencies: parseJson(row.dependencies, [])
  }))
}

function upsertPlanningChapters(novelId, chapters = []) {
  const db = getDatabase()
  const now = Date.now()

  const insert = db.prepare(`
    INSERT INTO planning_chapter (
      id, novelId, chapterNumber, title, summary, targetWords,
      status, priority, focus, writingHints, events, lockWritingTarget, progress,
      createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const update = db.prepare(`
    UPDATE planning_chapter SET
      chapterNumber = ?,
      title = ?,
      summary = ?,
      targetWords = ?,
      status = ?,
      priority = ?,
      focus = ?,
      writingHints = ?,
      events = ?,
      lockWritingTarget = ?,
      progress = ?,
      updatedAt = ?
    WHERE id = ? AND novelId = ?
  `)

  const getExisting = db.prepare('SELECT id FROM planning_chapter WHERE id = ? AND novelId = ?')
  const getExistingByNumber = db.prepare('SELECT id FROM planning_chapter WHERE novelId = ? AND chapterNumber = ?')

  const transaction = db.transaction(() => {
    chapters.forEach(raw => {
      const chapter = normalizeChapter({ ...raw, novelId })
      const existsById = chapter.id ? getExisting.get(chapter.id, novelId) : null
      const existsByNumber = getExistingByNumber.get(novelId, chapter.chapterNumber)

      const focus = serialize(chapter.focus)
      const writingHints = serialize(chapter.writingHints)
      const events = serialize(chapter.events)
      const lockWritingTarget = chapter.lockWritingTarget ? 1 : 0

      const targetId = existsById?.id || existsByNumber?.id

      if (targetId) {
        update.run(
          chapter.chapterNumber,
          chapter.title,
          chapter.summary,
          chapter.targetWords,
          chapter.status,
          chapter.priority,
          focus,
          writingHints,
          events,
          lockWritingTarget,
          chapter.progress,
          now,
          targetId,
          novelId
        )
      } else {
        const id = chapter.id || randomUUID()
        insert.run(
          id,
          novelId,
          chapter.chapterNumber,
          chapter.title,
          chapter.summary,
          chapter.targetWords,
          chapter.status,
          chapter.priority,
          focus,
          writingHints,
          events,
          lockWritingTarget,
          chapter.progress,
          now,
          now
        )
      }
    })
  })

  transaction()
}

function deletePlanningChaptersByNovel(novelId) {
  const db = getDatabase()
  return db.prepare('DELETE FROM planning_chapter WHERE novelId = ?').run(novelId)
}

function listPlanningChapters(novelId) {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM planning_chapter WHERE novelId = ? ORDER BY chapterNumber ASC').all(novelId)
  return rows.map(row => ({
    ...row,
    focus: parseJson(row.focus, []),
    writingHints: parseJson(row.writingHints, []),
    events: parseJson(row.events, []),
    lockWritingTarget: Boolean(row.lockWritingTarget)
  }))
}

function upsertPlanningMeta(novelId, meta = {}) {
  const db = getDatabase()
  const now = Date.now()
  const existing = db.prepare('SELECT novelId FROM planning_meta WHERE novelId = ?').get(novelId)
  const lockWritingTarget = meta.lockWritingTarget ? 1 : 0
  const chapterBeats = serialize(meta.chapterBeats)
  const emotionArc = serialize(meta.emotionArc)

  if (existing) {
    db.prepare(`
      UPDATE planning_meta
      SET synopsis = ?, targetChapters = ?, wordsPerChapter = ?, chapterBeats = ?, emotionArc = ?, lockWritingTarget = ?, updatedAt = ?
      WHERE novelId = ?
    `).run(
      meta.synopsis || null,
      meta.targetChapters || null,
      meta.wordsPerChapter || null,
      chapterBeats,
      emotionArc,
      lockWritingTarget,
      now,
      novelId
    )
    return novelId
  }

  db.prepare(`
    INSERT INTO planning_meta (novelId, synopsis, targetChapters, wordsPerChapter, chapterBeats, emotionArc, lockWritingTarget, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    novelId,
    meta.synopsis || null,
    meta.targetChapters || null,
    meta.wordsPerChapter || null,
    chapterBeats,
    emotionArc,
    lockWritingTarget,
    now
  )

  return novelId
}

function normalizeMeta(row) {
  if (!row) return null
  return {
    ...row,
    chapterBeats: parseJson(row.chapterBeats, []),
    emotionArc: parseJson(row.emotionArc, null),
    lockWritingTarget: Boolean(row.lockWritingTarget)
  }
}

function getPlanningMeta(novelId) {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM planning_meta WHERE novelId = ?').get(novelId)
  return normalizeMeta(row)
}

function clearPlanningMeta(novelId) {
  const db = getDatabase()
  return db.prepare('DELETE FROM planning_meta WHERE novelId = ?').run(novelId)
}

/**
 * 按章节范围删除规划章节
 * @param {string} novelId - 小说ID
 * @param {number} startChapter - 起始章节号
 * @param {number} endChapter - 结束章节号
 */
function deletePlanningChaptersByRange(novelId, startChapter, endChapter) {
  const db = getDatabase()
  return db.prepare(
    'DELETE FROM planning_chapter WHERE novelId = ? AND chapterNumber >= ? AND chapterNumber <= ?'
  ).run(novelId, startChapter, endChapter)
}

/**
 * 获取单个规划章节
 * @param {string} novelId - 小说ID
 * @param {number} chapterNumber - 章节号
 */
function getPlanningChapter(novelId, chapterNumber) {
  const db = getDatabase()
  const row = db.prepare(
    'SELECT * FROM planning_chapter WHERE novelId = ? AND chapterNumber = ?'
  ).get(novelId, chapterNumber)

  if (!row) return null

  return {
    ...row,
    focus: parseJson(row.focus, []),
    writingHints: parseJson(row.writingHints, []),
    events: parseJson(row.events, []),
    lockWritingTarget: Boolean(row.lockWritingTarget)
  }
}

/**
 * 按章节范围删除规划事件
 * @param {string} novelId - 小说ID
 * @param {number} startChapter - 起始章节号
 * @param {number} endChapter - 结束章节号
 */
function deletePlanningEventsByRange(novelId, startChapter, endChapter) {
  const db = getDatabase()
  return db.prepare(
    'DELETE FROM planning_event WHERE novelId = ? AND chapter >= ? AND chapter <= ?'
  ).run(novelId, startChapter, endChapter)
}

module.exports = {
  upsertPlanningEvents,
  deletePlanningEventsByNovel,
  deletePlanningEventsByRange,
  listPlanningEvents,
  upsertPlanningChapters,
  deletePlanningChaptersByNovel,
  deletePlanningChaptersByRange,
  getPlanningChapter,
  listPlanningChapters,
  upsertPlanningMeta,
  getPlanningMeta,
  clearPlanningMeta
}
