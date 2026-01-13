const { getDatabase } = require('./index')
const { randomUUID } = require('crypto')

/**
 * 创建实体（人物/地点/概念）
 * @param {string} novelId - 小说ID
 * @param {object} data - 实体数据
 * @param {string} data.eventId - 事件ID
 * @param {number} data.chapterNumber - 章节编号
 * @param {string} data.name - 实体名称
 * @param {object} data.states - 状态对象（JSON）
 * @param {array} data.history - 历史记录数组（JSON）
 * @returns {string} 创建的实体ID
 */
function createEntity(novelId, data) {
  const db = getDatabase()
  const id = randomUUID()
  const now = Date.now()

  db.prepare(`
    INSERT INTO entity (id, eventId, novelId, chapterNumber, name, states, history, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.eventId || '',
    novelId,
    data.chapterNumber || 0,
    data.name || '',
    data.states ? JSON.stringify(data.states) : null,
    data.history ? JSON.stringify(data.history) : null,
    now,
    now
  )

  return id
}

/**
 * 获取小说的所有实体
 * @param {string} novelId - 小说ID
 * @param {number} chapterNumber - 可选的章节编号过滤
 * @returns {array} 实体列表
 */
function getEntitiesByNovel(novelId, chapterNumber = null) {
  const db = getDatabase()
  if (chapterNumber !== null) {
    return db.prepare(`
      SELECT * FROM entity WHERE novelId = ? AND chapterNumber = ? ORDER BY name ASC
    `).all(novelId, chapterNumber).map(parseEntity)
  }
  return db.prepare(`
    SELECT * FROM entity WHERE novelId = ? ORDER BY chapterNumber DESC, name ASC
  `).all(novelId).map(parseEntity)
}

/**
 * 根据 ID 获取实体
 * @param {string} id - 实体ID
 * @returns {object|null} 实体对象
 */
function getEntityById(id) {
  const db = getDatabase()
  const entity = db.prepare(`
    SELECT * FROM entity WHERE id = ?
  `).get(id)
  return entity ? parseEntity(entity) : null
}

/**
 * 根据事件ID获取实体列表
 * @param {string} eventId - 事件ID
 * @returns {array} 实体列表
 */
function getEntitiesByEventId(eventId) {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM entity WHERE eventId = ? ORDER BY name ASC
  `).all(eventId).map(parseEntity)
}

/**
 * 根据名称获取实体（支持模糊查询）
 * @param {string} novelId - 小说ID
 * @param {string} name - 实体名称（支持模糊匹配）
 * @returns {array} 实体列表
 */
function getEntitiesByName(novelId, name) {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM entity WHERE novelId = ? AND name LIKE ? ORDER BY name ASC
  `).all(novelId, `%${name}%`).map(parseEntity)
}

/**
 * 更新实体
 * @param {string} id - 实体ID
 * @param {object} data - 要更新的字段
 * @returns {object|null} 更新后的实体对象
 */
function updateEntity(id, data) {
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
  if (data.name !== undefined) {
    updates.push('name = ?')
    values.push(data.name)
  }
  if (data.states !== undefined) {
    updates.push('states = ?')
    values.push(data.states ? JSON.stringify(data.states) : null)
  }
  if (data.history !== undefined) {
    updates.push('history = ?')
    values.push(data.history ? JSON.stringify(data.history) : null)
  }
  
  // 更新 updatedAt
  updates.push('updatedAt = ?')
  values.push(Date.now())
  
  values.push(id)
  
  if (updates.length > 0) {
    db.prepare(`
      UPDATE entity SET ${updates.join(', ')} WHERE id = ?
    `).run(...values)
  }
  
  return getEntityById(id)
}

/**
 * 删除实体
 * @param {string} id - 实体ID
 * @returns {object} 删除结果
 */
function deleteEntity(id) {
  const db = getDatabase()
  return db.prepare(`
    DELETE FROM entity WHERE id = ?
  `).run(id)
}

/**
 * 批量删除实体（根据小说ID和章节编号）
 * @param {string} novelId - 小说ID
 * @param {number} chapterNumber - 章节编号
 * @returns {object} 删除结果
 */
function deleteEntitiesByChapter(novelId, chapterNumber) {
  const db = getDatabase()
  return db.prepare(`
    DELETE FROM entity WHERE novelId = ? AND chapterNumber = ?
  `).run(novelId, chapterNumber)
}

/**
 * 解析实体对象，将 JSON 字符串转换为对象
 * @param {object} entity - 原始实体对象
 * @returns {object} 解析后的实体对象
 */
function parseEntity(entity) {
  if (!entity) return null
  
  return {
    ...entity,
    states: entity.states ? JSON.parse(entity.states) : null,
    history: entity.history ? JSON.parse(entity.history) : null
  }
}

module.exports = {
  createEntity,
  getEntitiesByNovel,
  getEntityById,
  getEntitiesByEventId,
  getEntitiesByName,
  updateEntity,
  deleteEntity,
  deleteEntitiesByChapter
}
