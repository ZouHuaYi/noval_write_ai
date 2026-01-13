const { getDatabase } = require('./index')
const { randomUUID } = require('crypto')

/**
 * 创建事件
 * @param {string} novelId - 小说ID
 * @param {object} data - 事件数据
 * @param {string} data.eventId - 事件ID
 * @param {number} data.chapterNumber - 章节编号
 * @param {string} data.type - 事件类型
 * @param {string} data.summary - 事件摘要
 * @param {string} data.detail - 事件详情
 * @param {array} data.actors - 参与者数组（JSON）
 * @param {array} data.effects - 影响数组（JSON）
 * @returns {string} 创建的事件ID
 */
function createEvent(novelId, data) {
  const db = getDatabase()
  const id = randomUUID()
  const now = Date.now()

  db.prepare(`
    INSERT INTO event (id, eventId, novelId, chapterNumber, type, summary, detail, actors, effects, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.eventId || '',
    novelId,
    data.chapterNumber || 0,
    data.type || null,
    data.summary || null,
    data.detail || null,
    data.actors ? JSON.stringify(data.actors) : null,
    data.effects ? JSON.stringify(data.effects) : null,
    now,
    now
  )

  return id
}

/**
 * 获取小说的所有事件
 * @param {string} novelId - 小说ID
 * @param {number} chapterNumber - 可选的章节编号过滤
 * @param {string} type - 可选的事件类型过滤
 * @returns {array} 事件列表
 */
function getEventsByNovel(novelId, chapterNumber = null, type = null) {
  const db = getDatabase()
  let query = 'SELECT * FROM event WHERE novelId = ?'
  const params = [novelId]

  if (chapterNumber !== null) {
    query += ' AND chapterNumber = ?'
    params.push(chapterNumber)
  }

  if (type !== null) {
    query += ' AND type = ?'
    params.push(type)
  }

  query += ' ORDER BY chapterNumber DESC, createdAt ASC'

  return db.prepare(query).all(...params).map(parseEvent)
}

/**
 * 根据 ID 获取事件
 * @param {string} id - 事件ID
 * @returns {object|null} 事件对象
 */
function getEventById(id) {
  const db = getDatabase()
  const event = db.prepare(`
    SELECT * FROM event WHERE id = ?
  `).get(id)
  return event ? parseEvent(event) : null
}

/**
 * 根据 eventId 获取事件列表
 * @param {string} eventId - 事件ID
 * @returns {array} 事件列表
 */
function getEventsByEventId(eventId) {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM event WHERE eventId = ? ORDER BY createdAt ASC
  `).all(eventId).map(parseEvent)
}

/**
 * 根据类型获取事件列表
 * @param {string} novelId - 小说ID
 * @param {string} type - 事件类型
 * @returns {array} 事件列表
 */
function getEventsByType(novelId, type) {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM event WHERE novelId = ? AND type = ? ORDER BY chapterNumber DESC, createdAt ASC
  `).all(novelId, type).map(parseEvent)
}

/**
 * 根据章节编号获取事件列表
 * @param {string} novelId - 小说ID
 * @param {number} chapterNumber - 章节编号
 * @returns {array} 事件列表
 */
function getEventsByChapter(novelId, chapterNumber) {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM event WHERE novelId = ? AND chapterNumber = ? ORDER BY createdAt ASC
  `).all(novelId, chapterNumber).map(parseEvent)
}

/**
 * 根据摘要或详情模糊查询事件
 * @param {string} novelId - 小说ID
 * @param {string} keyword - 关键词
 * @returns {array} 事件列表
 */
function searchEvents(novelId, keyword) {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM event 
    WHERE novelId = ? 
    AND (summary LIKE ? OR detail LIKE ?)
    ORDER BY chapterNumber DESC, createdAt ASC
  `).all(novelId, `%${keyword}%`, `%${keyword}%`).map(parseEvent)
}

/**
 * 更新事件
 * @param {string} id - 事件ID
 * @param {object} data - 要更新的字段
 * @returns {object|null} 更新后的事件对象
 */
function updateEvent(id, data) {
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
  if (data.type !== undefined) {
    updates.push('type = ?')
    values.push(data.type)
  }
  if (data.summary !== undefined) {
    updates.push('summary = ?')
    values.push(data.summary)
  }
  if (data.detail !== undefined) {
    updates.push('detail = ?')
    values.push(data.detail)
  }
  if (data.actors !== undefined) {
    updates.push('actors = ?')
    values.push(data.actors ? JSON.stringify(data.actors) : null)
  }
  if (data.effects !== undefined) {
    updates.push('effects = ?')
    values.push(data.effects ? JSON.stringify(data.effects) : null)
  }
  
  // 更新 updatedAt
  updates.push('updatedAt = ?')
  values.push(Date.now())
  
  values.push(id)
  
  if (updates.length > 0) {
    db.prepare(`
      UPDATE event SET ${updates.join(', ')} WHERE id = ?
    `).run(...values)
  }
  
  return getEventById(id)
}

/**
 * 删除事件
 * @param {string} id - 事件ID
 * @returns {object} 删除结果
 */
function deleteEvent(id) {
  const db = getDatabase()
  return db.prepare(`
    DELETE FROM event WHERE id = ?
  `).run(id)
}

/**
 * 批量删除事件（根据小说ID和章节编号）
 * @param {string} novelId - 小说ID
 * @param {number} chapterNumber - 章节编号
 * @returns {object} 删除结果
 */
function deleteEventsByChapter(novelId, chapterNumber) {
  const db = getDatabase()
  return db.prepare(`
    DELETE FROM event WHERE novelId = ? AND chapterNumber = ?
  `).run(novelId, chapterNumber)
}

/**
 * 批量删除事件（根据 eventId）
 * @param {string} eventId - 事件ID
 * @returns {object} 删除结果
 */
function deleteEventsByEventId(eventId) {
  const db = getDatabase()
  return db.prepare(`
    DELETE FROM event WHERE eventId = ?
  `).run(eventId)
}

/**
 * 解析事件对象，将 JSON 字符串转换为对象
 * @param {object} event - 原始事件对象
 * @returns {object} 解析后的事件对象
 */
function parseEvent(event) {
  if (!event) return null
  
  return {
    ...event,
    actors: event.actors ? JSON.parse(event.actors) : null,
    effects: event.effects ? JSON.parse(event.effects) : null
  }
}

module.exports = {
  createEvent,
  getEventsByNovel,
  getEventById,
  getEventsByEventId,
  getEventsByType,
  getEventsByChapter,
  searchEvents,
  updateEvent,
  deleteEvent,
  deleteEventsByChapter,
  deleteEventsByEventId
}
