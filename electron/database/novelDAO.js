const { getDatabase } = require('./index')
const { randomUUID } = require('crypto')

/**
 * 创建小说
 */
function createNovel(data) {
  const db = getDatabase()
  const now = Date.now()
  const id = randomUUID()

  db.prepare(`
    INSERT INTO novel (id, title, genre, description, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.title || '',
    data.genre || null,
    data.description || null,
    now,
    now
  )

  return id
}

/**
 * 获取小说列表
 */
function getNovelList() {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM novel ORDER BY updatedAt DESC
  `).all()
}

/**
 * 根据 ID 获取小说
 */
function getNovelById(id) {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM novel WHERE id = ?
  `).get(id)
}

/**
 * 更新小说
 */
function updateNovel(id, data) {
  const db = getDatabase()
  const now = Date.now()
  
  const updates = []
  const values = []
  
  if (data.title !== undefined) {
    updates.push('title = ?')
    values.push(data.title)
  }
  if (data.genre !== undefined) {
    updates.push('genre = ?')
    values.push(data.genre)
  }
  if (data.description !== undefined) {
    updates.push('description = ?')
    values.push(data.description)
  }
  
  updates.push('updatedAt = ?')
  values.push(now)
  values.push(id)
  
  if (updates.length > 1) {
    db.prepare(`
      UPDATE novel SET ${updates.join(', ')} WHERE id = ?
    `).run(...values)
  }
  
  return getNovelById(id)
}

/**
 * 删除小说
 */
function deleteNovel(id) {
  const db = getDatabase()
  return db.prepare(`
    DELETE FROM novel WHERE id = ?
  `).run(id)
}

module.exports = {
  createNovel,
  getNovelList,
  getNovelById,
  updateNovel,
  deleteNovel
}
