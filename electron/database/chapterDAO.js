const { getDatabase } = require('./index')
const { randomUUID } = require('crypto')

/**
 * 创建章节
 */
function createChapter(novelId, data = {}) {
  const db = getDatabase()
  const id = randomUUID()
  const now = Date.now()
  
  // 获取当前最大索引（用于小说内的章节顺序）
  const maxIdx = db.prepare(`
    SELECT COALESCE(MAX(idx), 0) as maxIdx FROM chapter WHERE novelId = ?
  `).get(novelId).maxIdx

  // 获取全局最大章节编号（用于全局唯一标识）
  const maxChapterNumber = db.prepare(`
    SELECT COALESCE(MAX(chapterNumber), 0) as maxChapterNumber FROM chapter
  `).get().maxChapterNumber

  const chapterNumber = maxChapterNumber + 1

  db.prepare(`
    INSERT INTO chapter (id, novelId, idx, chapterNumber, title, content, status, wordCount, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    novelId,
    maxIdx + 1,
    chapterNumber,
    data.title || `第${maxIdx + 1}章`,
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
  return db.prepare(`
    SELECT * FROM chapter WHERE novelId = ? ORDER BY idx ASC
  `).all(novelId)
}

/**
 * 更新章节内容
 */
function updateChapterContent(chapterId, content) {
  const db = getDatabase()
  const now = Date.now()
  // 简单的中文字数统计（去除空格和标点）
  const wordCount = content.replace(/[\s\p{P}]/gu, '').length
  
  db.prepare(`
    UPDATE chapter
    SET content = ?, wordCount = ?, updatedAt = ?
    WHERE id = ?
  `).run(content, wordCount, now, chapterId)
  
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

/**
 * 重新排序章节索引
 */
function reorderChapters(novelId) {
  const db = getDatabase()
  const chapters = db.prepare(`
    SELECT id FROM chapter WHERE novelId = ? ORDER BY idx ASC
  `).all(novelId)
  
  const updateStmt = db.prepare(`
    UPDATE chapter SET idx = ? WHERE id = ?
  `)
  
  const transaction = db.transaction((chapters) => {
    for (let i = 0; i < chapters.length; i++) {
      updateStmt.run(i + 1, chapters[i].id)
    }
  })
  
  transaction(chapters)
}

module.exports = {
  createChapter,
  getChapterById,
  getChaptersByNovel,
  updateChapterContent,
  updateChapter,
  deleteChapter,
  deleteAllChaptersByNovel,
  reorderChapters
}
