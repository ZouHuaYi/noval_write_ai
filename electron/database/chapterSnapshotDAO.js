const { getDatabase } = require('./index')
const { randomUUID } = require('crypto')
const { getChapterById } = require('./chapterDAO')

function getWordCount(content = '') {
  return content.replace(/[\s\p{P}]/gu, '').length
}

function createSnapshot({ novelId, chapterId, chapterNumber, title, content, reason }) {
  const db = getDatabase()
  const id = randomUUID()
  const now = Date.now()
  const wordCount = getWordCount(content || '')

  db.prepare(`
    INSERT INTO chapter_snapshot (id, novelId, chapterId, chapterNumber, title, content, wordCount, reason, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    novelId,
    chapterId,
    chapterNumber ?? null,
    title || '',
    content || '',
    wordCount,
    reason || 'manual',
    now
  )

  return getSnapshotById(id)
}

function getSnapshotById(id) {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM chapter_snapshot WHERE id = ?
  `).get(id)
}

function listSnapshotsByChapter(chapterId) {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM chapter_snapshot WHERE chapterId = ? ORDER BY createdAt DESC
  `).all(chapterId)
}

function restoreSnapshot(snapshotId) {
  const snapshot = getSnapshotById(snapshotId)
  if (!snapshot) return null

  const db = getDatabase()
  const now = Date.now()
  const wordCount = getWordCount(snapshot.content || '')

  db.prepare(`
    UPDATE chapter
    SET title = ?, content = ?, wordCount = ?, updatedAt = ?, chapterNumber = ?
    WHERE id = ?
  `).run(
    snapshot.title || '',
    snapshot.content || '',
    wordCount,
    now,
    snapshot.chapterNumber ?? null,
    snapshot.chapterId
  )

  return getChapterById(snapshot.chapterId)
}

module.exports = {
  createSnapshot,
  getSnapshotById,
  listSnapshotsByChapter,
  restoreSnapshot
}
