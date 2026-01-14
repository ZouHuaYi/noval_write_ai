const { getDatabase } = require('./index')
const { randomUUID } = require('crypto')

/**
 * 创建依赖
 * @param {string} novelId - 小说ID
 * @param {object} data - 依赖数据
 * @param {string} data.eventId - 事件ID
 * @param {number} data.chapterNumber - 章节编号
 * @param {string} data.description - 依赖描述
 * @param {string} data.type - 依赖类型
 * @param {array} data.relatedCharacters - 相关角色数组（JSON）
 * @param {array} data.resolveWhen - 解决条件数组（JSON）
 * @param {array} data.violateWhen - 违反条件数组（JSON）
 * @param {string} data.status - 状态
 * @returns {string} 创建的依赖ID
 */
function createDependency(novelId, data) {
  const db = getDatabase()
  const id = data.id || randomUUID() // 支持自定义 id
  const now = Date.now()

  db.prepare(`
    INSERT INTO dependency (id, eventId, novelId, chapterNumber, description, type, relatedCharacters, resolveWhen, violateWhen, status, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.eventId || '',
    novelId,
    data.chapterNumber || 0,
    data.description || null,
    data.type || null,
    data.relatedCharacters ? JSON.stringify(data.relatedCharacters) : null,
    data.resolveWhen ? JSON.stringify(data.resolveWhen) : null,
    data.violateWhen ? JSON.stringify(data.violateWhen) : null,
    data.status || null,
    now,
    now
  )

  return id
}

/**
 * 获取小说的所有依赖
 * @param {string} novelId - 小说ID
 * @param {number} chapterNumber - 可选的章节编号过滤
 * @param {string} status - 可选的状态过滤
 * @returns {array} 依赖列表
 */
function getDependenciesByNovel(novelId, chapterNumber = null, status = null) {
  const db = getDatabase()
  let query = 'SELECT * FROM dependency WHERE novelId = ?'
  const params = [novelId]

  if (chapterNumber !== null) {
    query += ' AND chapterNumber = ?'
    params.push(chapterNumber)
  }

  if (status !== null) {
    query += ' AND status = ?'
    params.push(status)
  }

  query += ' ORDER BY chapterNumber DESC, createdAt ASC'

  return db.prepare(query).all(...params).map(parseDependency)
}

/**
 * 根据 ID 获取依赖
 * @param {string} id - 依赖ID
 * @returns {object|null} 依赖对象
 */
function getDependencyById(id) {
  const db = getDatabase()
  const dependency = db.prepare(`
    SELECT * FROM dependency WHERE id = ?
  `).get(id)
  return dependency ? parseDependency(dependency) : null
}

/**
 * 根据事件ID获取依赖列表
 * @param {string} eventId - 事件ID
 * @returns {array} 依赖列表
 */
function getDependenciesByEventId(eventId) {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM dependency WHERE eventId = ? ORDER BY createdAt ASC
  `).all(eventId).map(parseDependency)
}

/**
 * 根据类型获取依赖列表
 * @param {string} novelId - 小说ID
 * @param {string} type - 依赖类型
 * @returns {array} 依赖列表
 */
function getDependenciesByType(novelId, type) {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM dependency WHERE novelId = ? AND type = ? ORDER BY chapterNumber DESC, createdAt ASC
  `).all(novelId, type).map(parseDependency)
}

/**
 * 根据状态获取依赖列表
 * @param {string} novelId - 小说ID
 * @param {string} status - 状态
 * @returns {array} 依赖列表
 */
function getDependenciesByStatus(novelId, status) {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM dependency WHERE novelId = ? AND status = ? ORDER BY chapterNumber DESC, createdAt ASC
  `).all(novelId, status).map(parseDependency)
}

/**
 * 根据描述模糊查询依赖
 * @param {string} novelId - 小说ID
 * @param {string} keyword - 关键词
 * @returns {array} 依赖列表
 */
function searchDependenciesByDescription(novelId, keyword) {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM dependency WHERE novelId = ? AND description LIKE ? ORDER BY chapterNumber DESC, createdAt ASC
  `).all(novelId, `%${keyword}%`).map(parseDependency)
}

/**
 * 更新依赖
 * @param {string} id - 依赖ID
 * @param {object} data - 要更新的字段
 * @returns {object|null} 更新后的依赖对象
 */
function updateDependency(id, data) {
  const db = getDatabase()
  const updates = []
  const values = []
  
  if (data.eventId !== undefined) {
    updates.push('eventId = ?')
    values.push(data.eventId)
  }
  if (data.chapterNumber !== undefined) {
    updates.push('chapterNumber = ?')
    values.push(data.chapterNumber)
  }
  if (data.description !== undefined) {
    updates.push('description = ?')
    values.push(data.description)
  }
  if (data.type !== undefined) {
    updates.push('type = ?')
    values.push(data.type)
  }
  if (data.relatedCharacters !== undefined) {
    updates.push('relatedCharacters = ?')
    values.push(data.relatedCharacters ? JSON.stringify(data.relatedCharacters) : null)
  }
  if (data.resolveWhen !== undefined) {
    updates.push('resolveWhen = ?')
    values.push(data.resolveWhen ? JSON.stringify(data.resolveWhen) : null)
  }
  if (data.violateWhen !== undefined) {
    updates.push('violateWhen = ?')
    values.push(data.violateWhen ? JSON.stringify(data.violateWhen) : null)
  }
  if (data.status !== undefined) {
    updates.push('status = ?')
    values.push(data.status)
  }
  
  // 更新 updatedAt
  updates.push('updatedAt = ?')
  values.push(Date.now())
  
  values.push(id)
  
  if (updates.length > 0) {
    db.prepare(`
      UPDATE dependency SET ${updates.join(', ')} WHERE id = ?
    `).run(...values)
  }
  
  return getDependencyById(id)
}

/**
 * 删除依赖
 * @param {string} id - 依赖ID
 * @returns {object} 删除结果
 */
function deleteDependency(id) {
  const db = getDatabase()
  return db.prepare(`
    DELETE FROM dependency WHERE id = ?
  `).run(id)
}

/**
 * 批量删除依赖（根据小说ID和章节编号）
 * @param {string} novelId - 小说ID
 * @param {number} chapterNumber - 章节编号
 * @returns {object} 删除结果
 */
function deleteDependenciesByChapter(novelId, chapterNumber) {
  const db = getDatabase()
  return db.prepare(`
    DELETE FROM dependency WHERE novelId = ? AND chapterNumber = ?
  `).run(novelId, chapterNumber)
}

/**
 * 批量删除依赖（根据事件ID）
 * @param {string} eventId - 事件ID
 * @returns {object} 删除结果
 */
function deleteDependenciesByEventId(eventId) {
  const db = getDatabase()
  return db.prepare(`
    DELETE FROM dependency WHERE eventId = ?
  `).run(eventId)
}

/**
 * 解析依赖对象，将 JSON 字符串转换为对象
 * @param {object} dependency - 原始依赖对象
 * @returns {object} 解析后的依赖对象
 */
function parseDependency(dependency) {
  if (!dependency) return null
  
  return {
    ...dependency,
    relatedCharacters: dependency.relatedCharacters ? JSON.parse(dependency.relatedCharacters) : null,
    resolveWhen: dependency.resolveWhen ? JSON.parse(dependency.resolveWhen) : null,
    violateWhen: dependency.violateWhen ? JSON.parse(dependency.violateWhen) : null
  }
}

module.exports = {
  createDependency,
  getDependenciesByNovel,
  getDependencyById,
  getDependenciesByEventId,
  getDependenciesByType,
  getDependenciesByStatus,
  searchDependenciesByDescription,
  updateDependency,
  deleteDependency,
  deleteDependenciesByChapter,
  deleteDependenciesByEventId
}
