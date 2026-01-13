const { getDatabase } = require('./index')
const { randomUUID } = require('crypto')

/**
 * 获取设置值
 */
function getSetting(key) {
  const db = getDatabase()
  const result = db.prepare(`
    SELECT * FROM settings WHERE key = ?
  `).get(key)
  
  if (result && result.value) {
    try {
      return JSON.parse(result.value)
    } catch {
      return result.value
    }
  }
  return null
}

/**
 * 设置值
 */
function setSetting(key, value, description = null) {
  const db = getDatabase()
  const now = Date.now()
  
  // 将值转换为 JSON 字符串
  const valueStr = typeof value === 'string' ? value : JSON.stringify(value)
  
  // 检查是否已存在
  const existing = db.prepare(`
    SELECT id FROM settings WHERE key = ?
  `).get(key)
  
  if (existing) {
    // 更新
    db.prepare(`
      UPDATE settings 
      SET value = ?, description = ?, updatedAt = ?
      WHERE key = ?
    `).run(valueStr, description, now, key)
    return existing.id
  } else {
    // 插入
    const id = randomUUID()
    db.prepare(`
      INSERT INTO settings (id, key, value, description, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, key, valueStr, description, now, now)
    return id
  }
}

/**
 * 获取所有设置
 */
function getAllSettings() {
  const db = getDatabase()
  const results = db.prepare(`
    SELECT * FROM settings ORDER BY key ASC
  `).all()
  
  return results.map(row => {
    let value = row.value
    try {
      value = JSON.parse(value)
    } catch {
      // 保持原值
    }
    return {
      ...row,
      value
    }
  })
}

/**
 * 删除设置
 */
function deleteSetting(key) {
  const db = getDatabase()
  return db.prepare(`
    DELETE FROM settings WHERE key = ?
  `).run(key)
}

module.exports = {
  getSetting,
  setSetting,
  getAllSettings,
  deleteSetting
}
