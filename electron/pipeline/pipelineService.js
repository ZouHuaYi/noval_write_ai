const pipelineDAO = require('../database/pipelineDAO')
const planningDAO = require('../database/planningDAO')
const {
  analyzeInput,
  generateEventBatch,
  generatePlan,
  generateChapterBatch,
  syncGraph,
  persistWorldview,
  DEFAULT_CHAPTER_SYSTEM_PROMPT
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

function buildEventBatches(targetChapters, eventBatchSize) {
  const batches = []
  const size = Math.max(1, Number(eventBatchSize) || 5)
  const total = Math.max(1, Number(targetChapters) || 10)
  let index = 0
  for (let start = 1; start <= total; start += size) {
    const end = Math.min(start + size - 1, total)
    batches.push({ batchIndex: index, startChapter: start, endChapter: end })
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

async function executeStep({ runId, stage, batchIndex, input, executor }) {
  console.log(`[流水线步骤] 开始执行: stage=${stage}, batchIndex=${batchIndex}`)
  
  let step = pipelineDAO.getPipelineStepByStage(runId, stage, batchIndex)
  if (!step) {
    step = pipelineDAO.createPipelineStep(runId, stage, batchIndex, input)
    console.log(`[流水线步骤] 创建新步骤记录, ID: ${step?.id}`)
  }

  if (step.status === STEP_STATUS.COMPLETED) {
    console.log(`[流水线步骤] 步骤已完成，跳过`)
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
            settings: run.settings
          })
        })

        run = pipelineDAO.updatePipelineRun(runId, {
          settings: analysisStep.output,
          currentStage: stage,
          currentBatch: 0
        })
      }

      if (stage === 'events_batch') {
        const settings = run.settings || {}
        const batches = buildEventBatches(settings.targetChapters, settings.eventBatchSize)
        for (const batch of batches) {
          if (state.paused) break
          pipelineDAO.updatePipelineRun(runId, { currentStage: stage, currentBatch: batch.batchIndex })
          await executeStep({
            runId,
            stage,
            batchIndex: batch.batchIndex,
            input: batch,
            executor: async () => generateEventBatch({
              novelId: run.novelId,
              startChapter: batch.startChapter,
              endChapter: batch.endChapter,
              targetChapters: settings.targetChapters,
              inputOutline: run.inputOutline
            })
          })
        }
      }

      if (stage === 'plan') {
        pipelineDAO.updatePipelineRun(runId, { currentStage: stage, currentBatch: 0 })
        await executeStep({
          runId,
          stage,
          batchIndex: null,
          input: null,
          executor: async () => generatePlan({
            novelId: run.novelId,
            settings: run.settings
          })
        })
      }

      if (stage === 'chapter_batch') {
        const chapters = planningDAO.listPlanningChapters(run.novelId) || []
        console.log(`[流水线调试] 获取到的章节计划数量: ${chapters.length}`)
        console.log(`[流水线调试] 章节计划详情:`, chapters.map(ch => ({ num: ch.chapterNumber, title: ch.title, status: ch.status })))
        
        const chapterNumbers = chapters.map(ch => ch.chapterNumber).filter(num => Number.isFinite(num))
        console.log(`[流水线调试] 有效章节号: [${chapterNumbers.join(', ')}]`)
        
        const batches = buildChapterBatches(chapterNumbers, run.settings?.chapterBatchSize)
        console.log(`[流水线调试] 章节批次数: ${batches.length}, 批次大小: ${run.settings?.chapterBatchSize || 2}`)
        console.log(`[流水线调试] 批次详情:`, batches.map(b => ({ index: b.batchIndex, chapters: b.chapterNumbers })))
        
        for (const batch of batches) {
          if (state.paused) break
          console.log(`[流水线调试] 开始处理批次 ${batch.batchIndex + 1}/${batches.length}, 章节: [${batch.chapterNumbers.join(', ')}]`)
          pipelineDAO.updatePipelineRun(runId, { currentStage: stage, currentBatch: batch.batchIndex })
          await executeStep({
            runId,
            stage,
            batchIndex: batch.batchIndex,
            input: batch,
            executor: async () => generateChapterBatch({
              novelId: run.novelId,
              chapterNumbers: batch.chapterNumbers,
              systemPrompt: DEFAULT_CHAPTER_SYSTEM_PROMPT
            })
          })
          console.log(`[流水线调试] 批次 ${batch.batchIndex + 1} 完成`)
        }
      }

      if (stage === 'graph_sync') {
        pipelineDAO.updatePipelineRun(runId, { currentStage: stage, currentBatch: 0 })
        await executeStep({
          runId,
          stage,
          batchIndex: null,
          input: null,
          executor: async () => syncGraph({ novelId: run.novelId })
        })
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
  const run = pipelineDAO.createPipelineRun({
    novelId: options.novelId,
    inputWorldview: options.inputWorldview,
    inputRules: options.inputRules,
    inputOutline: options.inputOutline,
    settings: options.settings || {}
  })

  // 异步执行流水线，捕获错误避免未处理的拒绝
  runPipeline(run.id).catch((error) => {
    console.error('流水线执行失败:', error)
  })
  return run
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

// 清空小说的流水线相关数据
function clearPipelineData(novelId) {
  if (!novelId) {
    throw new Error('清空流水线数据需要 novelId')
  }
  
  console.log(`[流水线] 开始清空小说数据: ${novelId}`)
  
  // 1. 删除流水线运行记录和步骤
  const runs = pipelineDAO.listPipelineRuns(novelId)
  console.log(`[流水线] 找到 ${runs.length} 条流水线运行记录`)
  for (const run of runs) {
    pipelineDAO.deletePipelineRun(run.id)
  }
  
  // 2. 删除规划事件
  planningDAO.deletePlanningEventsByNovel(novelId)
  console.log(`[流水线] 已清空规划事件`)
  
  // 3. 删除规划章节
  planningDAO.deletePlanningChaptersByNovel(novelId)
  console.log(`[流水线] 已清空规划章节`)
  
  // 4. 清空规划元数据
  planningDAO.clearPlanningMeta(novelId)
  console.log(`[流水线] 已清空规划元数据`)
  
  console.log(`[流水线] 数据清空完成`)
  
  return { success: true }
}

module.exports = {
  startPipeline,
  pausePipeline,
  resumePipeline,
  retryPipelineStep,
  getPipelineStatus,
  listPipelinesByNovel,
  clearPipelineData
}
