const pipelineDAO = require('../database/pipelineDAO')
const planningDAO = require('../database/planningDAO')
const chapterDAO = require('../database/chapterDAO')
const { setTimeout } = require('timers/promises')
const {
  analyzeInput,
  generateEventBatch,
  generatePlan,
  generateChapterBatch,
  syncGraph,
  persistWorldview,
  DEFAULT_CHAPTER_SYSTEM_PROMPT,
  resolvePipelineConfig
} = require('./pipelineSteps')

const RUN_STATUS = {
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed'
}

const STEP_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed'
}

const STAGES = ['analyze', 'events_batch', 'plan', 'chapter_batch', 'graph_sync']

const runningPipelines = new Map()

function getPipelineState(runId) {
  if (!runningPipelines.has(runId)) {
    runningPipelines.set(runId, { running: false, paused: false })
  }
  return runningPipelines.get(runId)
}

// 停止正在运行的流水线（用于清空前保护）
async function stopRunningPipeline(runId, timeoutMs = 5000) {
  const state = getPipelineState(runId)
  state.paused = true
  pipelineDAO.updatePipelineRun(runId, { status: RUN_STATUS.PAUSED })

  const start = Date.now()
  while (state.running && (Date.now() - start) < timeoutMs) {
    await setTimeout(200)
  }

  // 若仍在运行，强制标记为暂停（避免继续写 steps）
  state.running = false
  return pipelineDAO.getPipelineRun(runId)
}

// 启动时回收异常中断的运行状态
function recoverPipelineRunsOnStartup() {
  const runningRuns = pipelineDAO.listPipelineRunsByStatus(RUN_STATUS.RUNNING)
  if (!runningRuns.length) return
  for (const run of runningRuns) {
    pipelineDAO.updatePipelineRun(run.id, { status: RUN_STATUS.PAUSED })
    pipelineDAO.resetRunningSteps(run.id)
  }
}

function buildEventBatches(targetChapters, eventBatchSize, startChapter = 1) {
  const batches = []
  const size = Math.max(1, Number(eventBatchSize) || 5)
  const total = Math.max(1, Number(targetChapters) || 10)
  // 从指定起始章节开始分批，避免重复生成已完成章节
  const start = Math.max(1, Number(startChapter) || 1)
  if (start > total) return batches
  let index = 0
  for (let chapter = start; chapter <= total; chapter += size) {
    const end = Math.min(chapter + size - 1, total)
    batches.push({ batchIndex: index, startChapter: chapter, endChapter: end })
    index += 1
  }
  return batches
}

function buildChapterBatches(chapterNumbers = [], chapterBatchSize) {
  const size = Math.max(1, Number(chapterBatchSize) || 2)
  const sorted = [...chapterNumbers].sort((a, b) => a - b)
  const batches = []
  let index = 0
  for (let i = 0; i < sorted.length; i += size) {
    batches.push({ batchIndex: index, chapterNumbers: sorted.slice(i, i + size) })
    index += 1
  }
  return batches
}

// 获取最新的流水线运行记录（用于热更新配置）
function getLatestRun(runId) {
  return pipelineDAO.getPipelineRun(runId)
}

// 获取最新设置，避免运行中模型切换不生效
function getLatestSettings(runId, fallback = {}) {
  const latestRun = getLatestRun(runId)
  return latestRun?.settings || fallback
}

async function executeStep({ runId, stage, batchIndex, input, executor }) {
  console.log(`[流水线步骤] 开始执行: stage=${stage}, batchIndex=${batchIndex}`)
  
  // 在执行前检查暂停状态
  const state = getPipelineState(runId)
  if (state.paused) {
    console.log(`[流水线步骤] 检测到暂停信号,跳过执行: stage=${stage}, batchIndex=${batchIndex}`)
    return null // 返回 null 表示被暂停
  }
  
  let step = pipelineDAO.getPipelineStepByStage(runId, stage, batchIndex)
  if (!step) {
    step = pipelineDAO.createPipelineStep(runId, stage, batchIndex, input)
    console.log(`[流水线步骤] 创建新步骤记录, ID: ${step?.id}`)
  }

  if (step.status === STEP_STATUS.COMPLETED) {
    console.log(`[流水线步骤] 步骤已完成,跳过`)
    return step
  }

  step = pipelineDAO.updatePipelineStep(step.id, {
    status: STEP_STATUS.RUNNING,
    input: input || step.input,
    startedAt: Date.now()
  })
  console.log(`[流水线步骤] 步骤状态更新为 RUNNING`)

  try {
    const startTime = Date.now()
    const output = await executor()
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[流水线步骤] ✅ 步骤执行成功, 耗时: ${duration}s`)
    
    step = pipelineDAO.updatePipelineStep(step.id, {
      status: STEP_STATUS.COMPLETED,
      output,
      finishedAt: Date.now(),
      error: null
    })
    return step
  } catch (error) {
    console.error(`[流水线步骤] ❌ 步骤执行失败: stage=${stage}, batchIndex=${batchIndex}`)
    console.error(`[流水线步骤] 错误消息:`, error?.message || String(error))
    console.error(`[流水线步骤] 错误堆栈:`, error?.stack)
    
    pipelineDAO.updatePipelineStep(step.id, {
      status: STEP_STATUS.FAILED,
      error: error?.message || String(error),
      finishedAt: Date.now()
    })
    throw error
  }
}

// 执行完整流水线（支持断点续接）
async function runPipeline(runId) {
  const state = getPipelineState(runId)
  if (state.running) return
  state.running = true

  try {
    let run = pipelineDAO.getPipelineRun(runId)
    if (!run) return
    if (run.status === RUN_STATUS.COMPLETED) return

    run = pipelineDAO.updatePipelineRun(runId, { status: RUN_STATUS.RUNNING })

    // 保存世界观与规则，供后续生成使用
    persistWorldview({
      novelId: run.novelId,
      inputWorldview: run.inputWorldview,
      inputRules: run.inputRules
    })

    const startStageIndex = Math.max(0, STAGES.indexOf(run.currentStage || 'analyze'))

    for (let stageIndex = startStageIndex; stageIndex < STAGES.length; stageIndex += 1) {
      if (state.paused) break
      const stage = STAGES[stageIndex]

      if (stage === 'analyze') {
        pipelineDAO.updatePipelineRun(runId, { currentStage: stage, currentBatch: 0 })
        const latestRun = getLatestRun(runId) || run
        const analysisSettings = getLatestSettings(runId, latestRun.settings || {})
        const analysisConfig = await resolvePipelineConfig(analysisSettings || {}, 'analyze')
        const analysisStep = await executeStep({
          runId,
          stage,
          batchIndex: null,
          input: {
            inputWorldview: run.inputWorldview,
            inputRules: run.inputRules,
            inputOutline: run.inputOutline
          },
          executor: async () => analyzeInput({
            novelId: run.novelId,
            inputWorldview: run.inputWorldview,
            inputRules: run.inputRules,
            inputOutline: run.inputOutline,
            settings: analysisSettings,
            configOverride: analysisConfig
          })
        })

        // 检查是否被暂停
        if (analysisStep === null) {
          console.log('[流水线] 分析阶段被暂停')
          break
        }

        const currentRun = getLatestRun(runId) || run
        run = pipelineDAO.updatePipelineRun(runId, {
          settings: { ...(currentRun.settings || {}), ...analysisStep.output },
          currentStage: stage,
          currentBatch: 0
        })
      }

      if (stage !== 'analyze') {
        const latestRun = getLatestRun(runId) || run
        const settings = latestRun.settings || {}
        const configuredBatchSize = Number(settings.cycleBatchSize || settings.batchSize)
        const loopBatchSize = Number.isFinite(configuredBatchSize) && configuredBatchSize > 0
          ? configuredBatchSize
          : 5
        const batches = buildEventBatches(settings.targetChapters, loopBatchSize, settings.startChapter)
        const loopStages = ['events_batch', 'plan', 'chapter_batch', 'graph_sync']
        const resumeStageIndex = loopStages.indexOf(run.currentStage)
        const resumeBatchIndex = Number.isFinite(run.currentBatch) ? run.currentBatch : 0

        for (const batch of batches) {
          if (state.paused) break
          if (batch.batchIndex < resumeBatchIndex) continue

          for (let loopStageIndex = 0; loopStageIndex < loopStages.length; loopStageIndex += 1) {
            const loopStage = loopStages[loopStageIndex]
            if (batch.batchIndex === resumeBatchIndex && resumeStageIndex > -1 && loopStageIndex < resumeStageIndex) {
              continue
            }

            if (state.paused) break
            // 按 5 章循环：事件 -> 计划 -> 写作 -> 图谱同步
            pipelineDAO.updatePipelineRun(runId, { currentStage: loopStage, currentBatch: batch.batchIndex })

            if (loopStage === 'events_batch') {
              const refreshedSettings = getLatestSettings(runId, settings)
              const refreshedEventConfig = await resolvePipelineConfig(refreshedSettings, 'events_batch')
              const eventStep = await executeStep({
                runId,
                stage: loopStage,
                batchIndex: batch.batchIndex,
                input: batch,
                executor: async () => generateEventBatch({
                  novelId: run.novelId,
                  startChapter: batch.startChapter,
                  endChapter: batch.endChapter,
                  targetChapters: refreshedSettings.targetChapters,
                  inputOutline: run.inputOutline,
                  configOverride: refreshedEventConfig
                })
              })
              if (eventStep === null) break
            }

            if (loopStage === 'plan') {
              const refreshedSettings = getLatestSettings(runId, settings)
              const refreshedPlanConfig = await resolvePipelineConfig(refreshedSettings, 'plan')
              const planStep = await executeStep({
                runId,
                stage: loopStage,
                batchIndex: batch.batchIndex,
                input: batch,
                executor: async () => generatePlan({
                  novelId: run.novelId,
                  settings: refreshedSettings,
                  startChapter: batch.startChapter,
                  endChapter: batch.endChapter,
                  configOverride: refreshedPlanConfig
                })
              })
              if (planStep === null) break
            }

            if (loopStage === 'chapter_batch') {
              const chapters = planningDAO.listPlanningChapters(run.novelId) || []
              const chapterNumbers = chapters
                .map(ch => ch.chapterNumber)
                .filter(num => Number.isFinite(num) && num >= batch.startChapter && num <= batch.endChapter)

              const chapterBatches = buildChapterBatches(chapterNumbers, loopBatchSize)
              for (const chapterBatch of chapterBatches) {
                if (state.paused) break
                const refreshedSettings = getLatestSettings(runId, settings)
                const refreshedChapterConfig = await resolvePipelineConfig(refreshedSettings, 'chapter_batch')
                const refreshedReviewConfig = await resolvePipelineConfig(refreshedSettings, 'review')
                const chapterStep = await executeStep({
                  runId,
                  stage: loopStage,
                  batchIndex: batch.batchIndex,
                  input: chapterBatch,
                  executor: async () => generateChapterBatch({
                    novelId: run.novelId,
                    chapterNumbers: chapterBatch.chapterNumbers,
                    systemPrompt: DEFAULT_CHAPTER_SYSTEM_PROMPT,
                    configOverride: refreshedChapterConfig,
                    reviewConfigOverride: refreshedReviewConfig
                  })
                })
                if (chapterStep === null) break
              }
            }

            if (loopStage === 'graph_sync') {
              const graphStep = await executeStep({
                runId,
                stage: loopStage,
                batchIndex: batch.batchIndex,
                input: batch,
                executor: async () => syncGraph({ novelId: run.novelId })
              })
              if (graphStep === null) break
            }
          }
        }
        break
      }
    }

    if (!state.paused) {
      pipelineDAO.updatePipelineRun(runId, {
        status: RUN_STATUS.COMPLETED,
        currentStage: 'completed',
        currentBatch: 0
      })
    }
  } catch (error) {
    pipelineDAO.updatePipelineRun(runId, {
      status: RUN_STATUS.FAILED
    })
    throw error
  } finally {
    if (state.paused) {
      state.running = false
    } else {
      runningPipelines.delete(runId)
    }
  }
}

// 启动新的流水线任务
async function startPipeline(options) {
  const targetChapters = Number(options?.settings?.targetChapters)
  const lastCompleted = chapterDAO.getLastCompletedChapterNumber(options.novelId)
  const resumeStartChapter = Math.max(1, lastCompleted + 1)
  // 若已有完成章节，则从下一章续写（避免删除流水线后重头生成）
  const normalizedSettings = {
    ...(options.settings || {}),
    startChapter: resumeStartChapter
  }
  if (Number.isFinite(targetChapters) && resumeStartChapter > targetChapters) {
    console.log(`[pipeline:start] 已完成章节数=${lastCompleted}，目标章节=${targetChapters}，无需续写`)
  } else if (lastCompleted > 0) {
    console.log(`[pipeline:start] 检测到已完成章节=${lastCompleted}，将从第${resumeStartChapter}章继续`)
  }

  const run = pipelineDAO.createPipelineRun({
    novelId: options.novelId,
    inputWorldview: options.inputWorldview,
    inputRules: options.inputRules,
    inputOutline: options.inputOutline,
    settings: normalizedSettings
  })

  // 异步执行流水线，捕获错误避免未处理的拒绝
  runPipeline(run.id).catch((error) => {
    console.error('流水线执行失败:', error)
  })
  return run
}

// 运行中更新流水线配置（模型切换等）
async function updatePipelineRunSettings(runId, patch = {}) {
  const run = pipelineDAO.getPipelineRun(runId)
  if (!run) return null
  const merged = { ...(run.settings || {}), ...(patch || {}) }
  return pipelineDAO.updatePipelineRun(runId, { settings: merged })
}

// 暂停流水线任务（当前执行完成后生效）
async function pausePipeline(runId) {
  const state = getPipelineState(runId)
  state.paused = true
  pipelineDAO.updatePipelineRun(runId, { status: RUN_STATUS.PAUSED })
  return pipelineDAO.getPipelineRun(runId)
}

// 继续执行流水线任务
async function resumePipeline(runId) {
  const state = getPipelineState(runId)
  state.paused = false
  state.running = false
  pipelineDAO.updatePipelineRun(runId, { status: RUN_STATUS.RUNNING })
  // 异步执行流水线，捕获错误避免未处理的拒绝
  runPipeline(runId).catch((error) => {
    console.error('流水线继续失败:', error)
  })
  return pipelineDAO.getPipelineRun(runId)
}

// 重试指定步骤
async function retryPipelineStep(runId, stage, batchIndex) {
  const step = pipelineDAO.getPipelineStepByStage(runId, stage, batchIndex)
  if (!step) return null
  pipelineDAO.updatePipelineStep(step.id, {
    status: STEP_STATUS.PENDING,
    error: null,
    startedAt: null,
    finishedAt: null
  })
  pipelineDAO.updatePipelineRun(runId, { status: RUN_STATUS.RUNNING, currentStage: stage, currentBatch: batchIndex || 0 })
  // 异步执行流水线，捕获错误避免未处理的拒绝
  runPipeline(runId).catch((error) => {
    console.error('流水线重试失败:', error)
  })
  return pipelineDAO.getPipelineRun(runId)
}

// 获取流水线状态与步骤列表
function getPipelineStatus(runId) {
  const run = pipelineDAO.getPipelineRun(runId)
  if (!run) return null
  const steps = pipelineDAO.listPipelineSteps(runId)
  return {
    run,
    steps
  }
}

// 获取某本小说的流水线历史
function listPipelinesByNovel(novelId) {
  return pipelineDAO.listPipelineRuns(novelId)
}

// ??????????
function listPipelinesByStatus(status) {
  return pipelineDAO.listPipelineRunsByStatus(status)
}

// 清空小说的流水线相关数据
async function clearPipelineData(novelId) {
  if (!novelId) {
    throw new Error('清空流水线数据需要 novelId')
  }
  
  console.log(`[流水线] 开始清空小说数据: ${novelId}`)
  
  // 1. 删除流水线运行记录和步骤
  const runs = pipelineDAO.listPipelineRuns(novelId)
  console.log(`[流水线] 找到 ${runs.length} 条流水线运行记录`)
  for (const run of runs) {
    if (run.status === RUN_STATUS.RUNNING) {
      console.warn(`[流水线] 检测到运行中任务，先暂停: runId=${run.id}`)
      await stopRunningPipeline(run.id)
    }
    pipelineDAO.deletePipelineRun(run.id)
  }
  // 说明：不再清空规划数据（事件/章节/元数据），避免历史生成内容丢失
  
  console.log(`[流水线] 数据清空完成`)
  
  return { success: true }
}

module.exports = {
  startPipeline,
  updatePipelineRunSettings,
  pausePipeline,
  resumePipeline,
  recoverPipelineRunsOnStartup,
  retryPipelineStep,
  getPipelineStatus,
  listPipelinesByNovel,
  listPipelinesByStatus,
  clearPipelineData
}
