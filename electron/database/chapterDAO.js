const { getDatabase } = require('./index')
const { randomUUID } = require('crypto')

/**
 * 创建章节
 */
function createChapter(novelId, data = {}) {
  const db = getDatabase()
  const id = randomUUID()
  const now = Date.now()

  db.prepare(`
    INSERT INTO chapter (id, novelId, chapterNumber, title, content, status, wordCount, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    novelId,
    data.chapterNumber,
    data.title || `第${data.chapterNumber}章`,
    data.content || '',
    data.status || 'draft',
    0,
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
 * 更新章节内容
 */
function updateChapterContent(chapterId, content, chapterNumber) {
  const db = getDatabase()
  const now = Date.now()
  // 简单的中文字数统计（去除空格和标点）
  const wordCount = content.replace(/[\s\p{P}]/gu, '').length
  
  db.prepare(`
    UPDATE chapter
    SET content = ?, wordCount = ?, updatedAt = ?, chapterNumber = ?
    WHERE id = ?
  `).run(content, wordCount, now, chapterNumber, chapterId)
  
  return getChapterById(chapterId)
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
  updateChapterContent,
  updateChapter,
  deleteChapter,
  deleteAllChaptersByNovel
}
