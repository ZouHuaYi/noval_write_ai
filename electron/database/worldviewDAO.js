const { getDatabase } = require('./index')
const { randomUUID } = require('crypto')

function getWorldviewByNovel(novelId) {
  const db = getDatabase()
  return db.prepare('SELECT * FROM worldview WHERE novelId = ?').get(novelId)
}

function saveWorldview(novelId, data) {
  const db = getDatabase()
  const now = Date.now()
  const existing = getWorldviewByNovel(novelId)

  const worldviewText = data?.worldview ?? null
  const rulesText = data?.rules ?? null

  if (existing?.id) {
    db.prepare(`
      UPDATE worldview
      SET worldview = ?, rules = ?, updatedAt = ?
      WHERE id = ?
    `).run(worldviewText, rulesText, now, existing.id)

    return getWorldviewByNovel(novelId)
  }

  const id = randomUUID()
  db.prepare(`
    INSERT INTO worldview (id, novelId, worldview, rules, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, novelId, worldviewText, rulesText, now, now)

  return getWorldviewByNovel(novelId)
}

module.exports = {
  getWorldviewByNovel,
  saveWorldview
}
