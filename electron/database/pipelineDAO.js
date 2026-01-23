const { getDatabase } = require('./index')
const { randomUUID } = require('crypto')

function serialize(value) {
  if (value == null) return null
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function parseJson(value, fallback) {
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

// 创建流水线运行记录
function createPipelineRun({
  novelId,
  inputWorldview,
  inputRules,
  inputOutline,
  settings
}) {
  const db = getDatabase()
  const id = randomUUID()
  const now = Date.now()

  db.prepare(`
    INSERT INTO pipeline_run (
      id, novelId, status, currentStage, currentBatch,
      inputWorldview, inputRules, inputOutline, settings,
      createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    novelId,
    'running',
    'analyze',
    0,
    inputWorldview || null,
    inputRules || null,
    inputOutline || null,
    serialize(settings || {}),
    now,
    now
  )

  return getPipelineRun(id)
}

// 获取流水线运行记录
function getPipelineRun(id) {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM pipeline_run WHERE id = ?').get(id)
  if (!row) return null
  return {
    ...row,
    settings: parseJson(row.settings, {})
  }
}

// 获取小说的流水线运行列表
function listPipelineRuns(novelId) {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM pipeline_run WHERE novelId = ? ORDER BY createdAt DESC').all(novelId)
  return rows.map(row => ({
    ...row,
    settings: parseJson(row.settings, {})
  }))
}

// 更新流水线运行记录
function updatePipelineRun(id, patch = {}) {
  const db = getDatabase()
  const now = Date.now()
  const updates = []
  const values = []

  if (patch.status !== undefined) {
    updates.push('status = ?')
    values.push(patch.status)
  }
  if (patch.currentStage !== undefined) {
    updates.push('currentStage = ?')
    values.push(patch.currentStage)
  }
  if (patch.currentBatch !== undefined) {
    updates.push('currentBatch = ?')
    values.push(patch.currentBatch)
  }
  if (patch.inputWorldview !== undefined) {
    updates.push('inputWorldview = ?')
    values.push(patch.inputWorldview)
  }
  if (patch.inputRules !== undefined) {
    updates.push('inputRules = ?')
    values.push(patch.inputRules)
  }
  if (patch.inputOutline !== undefined) {
    updates.push('inputOutline = ?')
    values.push(patch.inputOutline)
  }
  if (patch.settings !== undefined) {
    updates.push('settings = ?')
    values.push(serialize(patch.settings))
  }

  updates.push('updatedAt = ?')
  values.push(now)
  values.push(id)

  if (updates.length > 1) {
    db.prepare(`UPDATE pipeline_run SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  }

  return getPipelineRun(id)
}

// 创建流水线步骤
function createPipelineStep(runId, stage, batchIndex, input) {
  const db = getDatabase()
  const id = randomUUID()
  const now = Date.now()

  db.prepare(`
    INSERT INTO pipeline_step (
      id, runId, stage, batchIndex, status,
      input, output, error, startedAt, finishedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    runId,
    stage,
    batchIndex != null ? batchIndex : null,
    'pending',
    serialize(input || null),
    null,
    null,
    null,
    null
  )

  return getPipelineStep(id)
}

// 获取流水线步骤
function getPipelineStep(id) {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM pipeline_step WHERE id = ?').get(id)
  if (!row) return null
  return {
    ...row,
    input: parseJson(row.input, null),
    output: parseJson(row.output, null)
  }
}

// 获取流水线步骤列表
function listPipelineSteps(runId) {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM pipeline_step WHERE runId = ? ORDER BY stage ASC, batchIndex ASC').all(runId)
  return rows.map(row => ({
    ...row,
    input: parseJson(row.input, null),
    output: parseJson(row.output, null)
  }))
}

// 获取某阶段某批次的步骤
function getPipelineStepByStage(runId, stage, batchIndex) {
  const db = getDatabase()
  const row = db.prepare(
    'SELECT * FROM pipeline_step WHERE runId = ? AND stage = ? AND batchIndex IS ?'
  ).get(runId, stage, batchIndex != null ? batchIndex : null)
  if (!row) return null
  return {
    ...row,
    input: parseJson(row.input, null),
    output: parseJson(row.output, null)
  }
}

// 更新流水线步骤
function updatePipelineStep(id, patch = {}) {
  const db = getDatabase()
  const updates = []
  const values = []

  if (patch.status !== undefined) {
    updates.push('status = ?')
    values.push(patch.status)
  }
  if (patch.input !== undefined) {
    updates.push('input = ?')
    values.push(serialize(patch.input))
  }
  if (patch.output !== undefined) {
    updates.push('output = ?')
    values.push(serialize(patch.output))
  }
  if (patch.error !== undefined) {
    updates.push('error = ?')
    values.push(patch.error)
  }
  if (patch.startedAt !== undefined) {
    updates.push('startedAt = ?')
    values.push(patch.startedAt)
  }
  if (patch.finishedAt !== undefined) {
    updates.push('finishedAt = ?')
    values.push(patch.finishedAt)
  }

  if (!updates.length) return getPipelineStep(id)

  values.push(id)
  db.prepare(`UPDATE pipeline_step SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  return getPipelineStep(id)
}

// 删除流水线运行记录及其步骤
function deletePipelineRun(runId) {
  const db = getDatabase()
  // 先删除相关步骤
  db.prepare('DELETE FROM pipeline_step WHERE runId = ?').run(runId)
  // 再删除运行记录
  db.prepare('DELETE FROM pipeline_run WHERE id = ?').run(runId)
  return { success: true }
}

module.exports = {
  createPipelineRun,
  getPipelineRun,
  listPipelineRuns,
  updatePipelineRun,
  deletePipelineRun,
  createPipelineStep,
  getPipelineStep,
  listPipelineSteps,
  getPipelineStepByStage,
  updatePipelineStep
}
