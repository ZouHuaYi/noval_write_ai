const { getDatabase } = require('./index')
const { randomUUID } = require('crypto')

/**
 * 创建大纲
 */
function createOutline(novelId, data = {}) {
  const db = getDatabase()
  const id = randomUUID()
  const now = Date.now()
  
  db.prepare(`
    INSERT INTO outline (id, novelId, title, content, startChapter, endChapter, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    novelId,
    data.title || '未命名大纲',
    data.content || '',
    data.startChapter || null,
    data.endChapter || null,
    now,
    now
  )
  
  return id
}

/**
 * 根据 ID 获取大纲
 */
function getOutlineById(id) {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM outline WHERE id = ?
  `).get(id)
}

/**
 * 获取小说的所有大纲
 */
function getOutlinesByNovel(novelId) {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM outline WHERE novelId = ? ORDER BY createdAt DESC
  `).all(novelId)
}

/**
 * 更新大纲
 */
function updateOutline(id, data) {
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
  }
  if (data.startChapter !== undefined) {
    updates.push('startChapter = ?')
    values.push(data.startChapter)
  }
  if (data.endChapter !== undefined) {
    updates.push('endChapter = ?')
    values.push(data.endChapter)
  }
  
  updates.push('updatedAt = ?')
  values.push(now)
  values.push(id)
  
  if (updates.length > 1) {
    db.prepare(`
      UPDATE outline SET ${updates.join(', ')} WHERE id = ?
    `).run(...values)
  }
  
  return getOutlineById(id)
}

/**
 * 删除大纲
 */
function deleteOutline(id) {
  const db = getDatabase()
  return db.prepare(`
    DELETE FROM outline WHERE id = ?
  `).run(id)
}

module.exports = {
  createOutline,
  getOutlineById,
  getOutlinesByNovel,
  updateOutline,
  deleteOutline
}
