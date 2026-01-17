const { getDatabase } = require('./index')
const { randomUUID } = require('crypto')

function createGeneration({ novelId, chapterId, chunkSize, maxChunks }) {
  const db = getDatabase()
  const id = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO chapter_generation (id, novelId, chapterId, status, chunkSize, maxChunks, currentChunk, lastContentLength, lastError, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    novelId,
    chapterId,
    'running',
    chunkSize,
    maxChunks ?? null,
    0,
    0,
    null,
    now,
    now
  )
  return getGenerationByChapter(chapterId)
}

function getGenerationByChapter(chapterId) {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM chapter_generation WHERE chapterId = ?
  `).get(chapterId)
}

function updateGeneration(chapterId, data = {}) {
  const db = getDatabase()
  const now = Date.now()
  const updates = []
  const values = []

  if (data.status !== undefined) {
    updates.push('status = ?')
    values.push(data.status)
  }
  if (data.chunkSize !== undefined) {
    updates.push('chunkSize = ?')
    values.push(data.chunkSize)
  }
  if (data.maxChunks !== undefined) {
    updates.push('maxChunks = ?')
    values.push(data.maxChunks)
  }
  if (data.currentChunk !== undefined) {
    updates.push('currentChunk = ?')
    values.push(data.currentChunk)
  }
  if (data.lastContentLength !== undefined) {
    updates.push('lastContentLength = ?')
    values.push(data.lastContentLength)
  }
  if (data.lastError !== undefined) {
    updates.push('lastError = ?')
    values.push(data.lastError)
  }

  updates.push('updatedAt = ?')
  values.push(now)
  values.push(chapterId)

  if (updates.length > 1) {
    db.prepare(`
      UPDATE chapter_generation SET ${updates.join(', ')} WHERE chapterId = ?
    `).run(...values)
  }

  return getGenerationByChapter(chapterId)
}

function deleteGeneration(chapterId) {
  const db = getDatabase()
  return db.prepare(`
    DELETE FROM chapter_generation WHERE chapterId = ?
  `).run(chapterId)
}

module.exports = {
  createGeneration,
  getGenerationByChapter,
  updateGeneration,
  deleteGeneration
}
