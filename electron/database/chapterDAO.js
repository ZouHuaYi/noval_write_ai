const { getDatabase } = require('./index')
const { randomUUID } = require('crypto')
const crypto = require('crypto')

/**
 * 计算内容哈希
 */
function calculateContentHash(content) {
  if (!content) return null
  return crypto.createHash('md5').update(content).digest('hex')
}


/**
 * 创建章节
 */
function createChapter(novelId, data = {}) {
  const db = getDatabase()
  const id = randomUUID()
  const now = Date.now()
  let chapterNumber = data.chapterNumber
  const content = data.content || ''

  if (chapterNumber == null) {
    const row = db.prepare('SELECT MAX(chapterNumber) AS maxNumber FROM chapter WHERE novelId = ?').get(novelId)
    chapterNumber = (row?.maxNumber || 0) + 1
  }

  const contentHash = calculateContentHash(content)

  db.prepare(`
    INSERT INTO chapter (id, novelId, chapterNumber, title, content, status, wordCount, contentHash, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    novelId,
    chapterNumber,
    data.title || `第${chapterNumber}章`,
    content,
    data.status || 'draft',
    0,
    contentHash,
    now,
    now
  )
  return id
}


/**
 * 根据 ID 获取章节
 */
function getChapterById(id) {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM chapter WHERE id = ?
  `).get(id)
}

/**
 * 获取小说的所有章节
 */
function getChaptersByNovel(novelId) {
  const db = getDatabase()
  // chapterNumber 倒序
  return db.prepare(`
    SELECT * FROM chapter WHERE novelId = ? ORDER BY chapterNumber DESC
  `).all(novelId)
}

/**
 * 获取小说的所有章节（按章节号升序）
 */
function getChaptersByNovelAsc(novelId) {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM chapter WHERE novelId = ? ORDER BY chapterNumber ASC
  `).all(novelId)
}

function getChapterByNovelAndNumber(novelId, chapterNumber) {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM chapter WHERE novelId = ? AND chapterNumber = ?
  `).get(novelId, chapterNumber)
}



/**
 * 更新章节信息
 */
function updateChapter(chapterId, data) {
  const db = getDatabase()
  const now = Date.now()

  const updates = []
  const values = []

  if (data.title !== undefined) {
    updates.push('title = ?')
    values.push(data.title)
  }
  if (data.content !== undefined) {
    updates.push('content = ?')
    values.push(data.content)
    // 更新字数
    const wordCount = data.content.replace(/[\s\p{P}]/gu, '').length
    updates.push('wordCount = ?')
    values.push(wordCount)
    // 更新内容哈希
    const contentHash = calculateContentHash(data.content)
    updates.push('contentHash = ?')
    values.push(contentHash)
  }
  if (data.status !== undefined) {
    updates.push('status = ?')
    values.push(data.status)
  }
  if (data.idx !== undefined) {
    updates.push('idx = ?')
    values.push(data.idx)
  }
  if (data.chapterNumber !== undefined) {
    updates.push('chapterNumber = ?')
    values.push(data.chapterNumber)
  }

  updates.push('updatedAt = ?')
  values.push(now)
  values.push(chapterId)

  if (updates.length > 1) {
    db.prepare(`
      UPDATE chapter SET ${updates.join(', ')} WHERE id = ?
    `).run(...values)
  }

  return getChapterById(chapterId)
}

/**
 * 删除章节
 */
function deleteChapter(id) {
  const db = getDatabase()
  return db.prepare(`
    DELETE FROM chapter WHERE id = ?
  `).run(id)
}

/**
 * 删除小说的所有章节
 */
function deleteAllChaptersByNovel(novelId) {
  const db = getDatabase()
  const result = db.prepare(`
    DELETE FROM chapter WHERE novelId = ?
  `).run(novelId)
  return result.changes // 返回删除的章节数量
}

module.exports = {
  createChapter,
  getChapterById,
  getChaptersByNovel,
  getChaptersByNovelAsc,
  updateChapter,
  deleteChapter,
  deleteAllChaptersByNovel,
  getChapterByNovelAndNumber
}
