const { getDatabase } = require('./index')
const { randomUUID } = require('crypto')

function getReioStats() {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM reio_stats LIMIT 1').get()
  if (!row) return null
  let lastCheckResult = null
  if (row.lastCheckResult) {
    try {
      lastCheckResult = JSON.parse(row.lastCheckResult)
    } catch {
      lastCheckResult = null
    }
  }
  return {
    ...row,
    lastCheckResult
  }
}

function upsertReioStats(stats) {
  const db = getDatabase()
  const now = Date.now()
  const existing = db.prepare('SELECT id FROM reio_stats LIMIT 1').get()
  const payload = {
    totalChecks: stats.totalChecks || 0,
    passedChecks: stats.passedChecks || 0,
    failedChecks: stats.failedChecks || 0,
    totalRewrites: stats.totalRewrites || 0,
    lastCheckTime: stats.lastCheckTime || null,
    lastCheckResult: stats.lastCheckResult ? JSON.stringify(stats.lastCheckResult) : null
  }

  if (existing) {
    db.prepare(`
      UPDATE reio_stats
      SET totalChecks = ?, passedChecks = ?, failedChecks = ?, totalRewrites = ?,
          lastCheckTime = ?, lastCheckResult = ?, updatedAt = ?
      WHERE id = ?
    `).run(
      payload.totalChecks,
      payload.passedChecks,
      payload.failedChecks,
      payload.totalRewrites,
      payload.lastCheckTime,
      payload.lastCheckResult,
      now,
      existing.id
    )
    return existing.id
  }

  const id = randomUUID()
  db.prepare(`
    INSERT INTO reio_stats (
      id, totalChecks, passedChecks, failedChecks, totalRewrites,
      lastCheckTime, lastCheckResult, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    payload.totalChecks,
    payload.passedChecks,
    payload.failedChecks,
    payload.totalRewrites,
    payload.lastCheckTime,
    payload.lastCheckResult,
    now
  )

  return id
}

function resetReioStats() {
  const db = getDatabase()
  return db.prepare('DELETE FROM reio_stats').run()
}

module.exports = {
  getReioStats,
  upsertReioStats,
  resetReioStats
}
