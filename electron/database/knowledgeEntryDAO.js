const { getDatabase } = require('./index')
const { randomUUID } = require('crypto')

function parseEntry(entry) {
  if (!entry) return null
  return {
    ...entry,
    aliases: entry.aliases ? JSON.parse(entry.aliases) : [],
    tags: entry.tags ? JSON.parse(entry.tags) : [],
    reviewStatus: entry.reviewStatus || 'pending',
    reviewedAt: entry.reviewedAt || null
  }
}

function normalizeReviewStatus(status) {
  return status || 'pending'
}

function shouldPreserveReview(existing) {
  return existing && existing.reviewStatus && existing.reviewStatus !== 'pending'
}

function getReviewStatusFilter(value) {
  if (!value) return null
  return value
}

function createEntry(novelId, data) {
  const db = getDatabase()
  const id = data.id || randomUUID()
  const now = Date.now()

  const reviewStatus = normalizeReviewStatus(data.reviewStatus)
  const reviewedAt = reviewStatus === 'pending' ? null : (data.reviewedAt ?? now)

  db.prepare(`
    INSERT INTO knowledge_entry (
      id, novelId, type, name, summary, detail,
      aliases, tags, reviewStatus, reviewedAt, sourceChapter, sourceEventId, sourceEntityId, sourceType,
      createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    novelId,
    data.type,
    data.name,
    data.summary || null,
    data.detail || null,
    data.aliases ? JSON.stringify(data.aliases) : null,
    data.tags ? JSON.stringify(data.tags) : null,
    reviewStatus,
    reviewedAt,
    data.sourceChapter ?? null,
    data.sourceEventId || null,
    data.sourceEntityId || null,
    data.sourceType || null,
    now,
    now
  )

  return getEntryById(id)
}

function getEntryById(id) {
  const db = getDatabase()
  const entry = db.prepare(`
    SELECT * FROM knowledge_entry WHERE id = ?
  `).get(id)
  return parseEntry(entry)
}

function listEntries(novelId, type = null, reviewStatus = null) {
  const db = getDatabase()
  const statusFilter = getReviewStatusFilter(reviewStatus)
  if (type && statusFilter) {
    return db.prepare(`
      SELECT * FROM knowledge_entry
      WHERE novelId = ? AND type = ? AND reviewStatus = ?
      ORDER BY updatedAt DESC
    `).all(novelId, type, statusFilter).map(parseEntry)
  }
  if (type) {
    return db.prepare(`
      SELECT * FROM knowledge_entry WHERE novelId = ? AND type = ? ORDER BY updatedAt DESC
    `).all(novelId, type).map(parseEntry)
  }
  if (statusFilter) {
    return db.prepare(`
      SELECT * FROM knowledge_entry WHERE novelId = ? AND reviewStatus = ? ORDER BY updatedAt DESC
    `).all(novelId, statusFilter).map(parseEntry)
  }
  return db.prepare(`
    SELECT * FROM knowledge_entry WHERE novelId = ? ORDER BY updatedAt DESC
  `).all(novelId).map(parseEntry)
}

function listReviewEntries(novelId, reviewStatus = 'pending') {
  const statusFilter = getReviewStatusFilter(reviewStatus) || 'pending'
  return listEntries(novelId, null, statusFilter)
}

function searchEntries(novelId, keyword, reviewStatus = null) {
  const db = getDatabase()
  const statusFilter = getReviewStatusFilter(reviewStatus)
  if (statusFilter) {
    return db.prepare(`
      SELECT * FROM knowledge_entry
      WHERE novelId = ? AND reviewStatus = ? AND (name LIKE ? OR summary LIKE ? OR detail LIKE ?)
      ORDER BY updatedAt DESC
    `).all(novelId, statusFilter, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`).map(parseEntry)
  }
  return db.prepare(`
    SELECT * FROM knowledge_entry
    WHERE novelId = ? AND (name LIKE ? OR summary LIKE ? OR detail LIKE ?)
    ORDER BY updatedAt DESC
  `).all(novelId, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`).map(parseEntry)
}

function updateEntry(id, data) {
  const db = getDatabase()
  const updates = []
  const values = []

  const existing = getEntryById(id)
  const preserveReview = shouldPreserveReview(existing)

  if (data.type !== undefined) {
    updates.push('type = ?')
    values.push(data.type)
  }
  if (data.name !== undefined) {
    updates.push('name = ?')
    values.push(data.name)
  }
  if (data.summary !== undefined) {
    updates.push('summary = ?')
    values.push(data.summary)
  }
  if (data.detail !== undefined) {
    updates.push('detail = ?')
    values.push(data.detail)
  }
  if (data.aliases !== undefined) {
    updates.push('aliases = ?')
    values.push(data.aliases ? JSON.stringify(data.aliases) : null)
  }
  if (data.tags !== undefined) {
    updates.push('tags = ?')
    values.push(data.tags ? JSON.stringify(data.tags) : null)
  }
  if (data.reviewStatus !== undefined) {
    if (preserveReview && data.reviewStatus === 'pending') {
      updates.push('reviewStatus = ?')
      values.push(existing.reviewStatus)
      updates.push('reviewedAt = ?')
      values.push(existing.reviewedAt)
    } else {
      updates.push('reviewStatus = ?')
      values.push(normalizeReviewStatus(data.reviewStatus))
      updates.push('reviewedAt = ?')
      values.push(data.reviewStatus === 'pending' ? null : (data.reviewedAt ?? Date.now()))
    }
  } else if (data.reviewedAt !== undefined) {
    updates.push('reviewedAt = ?')
    values.push(data.reviewedAt)
  }
  if (data.sourceChapter !== undefined) {
    updates.push('sourceChapter = ?')
    values.push(data.sourceChapter)
  }
  if (data.sourceEventId !== undefined) {
    updates.push('sourceEventId = ?')
    values.push(data.sourceEventId)
  }
  if (data.sourceEntityId !== undefined) {
    updates.push('sourceEntityId = ?')
    values.push(data.sourceEntityId)
  }
  if (data.sourceType !== undefined) {
    updates.push('sourceType = ?')
    values.push(data.sourceType)
  }

  updates.push('updatedAt = ?')
  values.push(Date.now())
  values.push(id)

  if (updates.length > 0) {
    db.prepare(`
      UPDATE knowledge_entry SET ${updates.join(', ')} WHERE id = ?
    `).run(...values)
  }

  return getEntryById(id)
}

function deleteEntry(id) {
  const db = getDatabase()
  return db.prepare(`
    DELETE FROM knowledge_entry WHERE id = ?
  `).run(id)
}

function deleteEntriesByChapter(novelId, chapterNumber) {
  const db = getDatabase()
  return db.prepare(`
    DELETE FROM knowledge_entry WHERE novelId = ? AND sourceChapter = ?
  `).run(novelId, chapterNumber)
}

function deleteEntriesByNovel(novelId) {
  const db = getDatabase()
  return db.prepare(`
    DELETE FROM knowledge_entry WHERE novelId = ?
  `).run(novelId)
}

function upsertEntry(novelId, data) {
  const db = getDatabase()
  const existing = db.prepare(`
    SELECT * FROM knowledge_entry WHERE novelId = ? AND type = ? AND name = ?
  `).get(novelId, data.type, data.name)

  if (existing) {
    const preserveReview = shouldPreserveReview(existing)
    let nextReviewStatus = data.reviewStatus ?? existing.reviewStatus
    let nextReviewedAt = data.reviewedAt ?? existing.reviewedAt

    if (preserveReview && data.reviewStatus === undefined) {
      nextReviewStatus = existing.reviewStatus
      nextReviewedAt = existing.reviewedAt
    } else if (data.reviewStatus && data.reviewStatus !== existing.reviewStatus) {
      if (data.reviewStatus === 'pending' && existing.reviewStatus) {
        nextReviewStatus = existing.reviewStatus
        nextReviewedAt = existing.reviewedAt
      } else {
        nextReviewStatus = normalizeReviewStatus(data.reviewStatus)
        nextReviewedAt = data.reviewedAt ?? Date.now()
      }
    }

    return updateEntry(existing.id, {
      ...data,
      reviewStatus: nextReviewStatus,
      reviewedAt: nextReviewedAt
    })
  }
  return createEntry(novelId, data)
}

module.exports = {
  createEntry,
  getEntryById,
  listEntries,
  listReviewEntries,
  searchEntries,
  updateEntry,
  deleteEntry,
  deleteEntriesByChapter,
  deleteEntriesByNovel,
  upsertEntry
}
