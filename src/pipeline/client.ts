import type { PipelineStatus, PipelineRun } from './types'

// 启动流水线
export async function startPipeline(options: {
  novelId: string
  inputWorldview?: string
  inputRules?: string
  inputOutline?: string
  settings?: Record<string, any>
}): Promise<PipelineRun> {
  return await window.electronAPI.pipeline.start(options)
}

// 暂停流水线
export async function pausePipeline(runId: string): Promise<PipelineRun> {
  return await window.electronAPI.pipeline.pause(runId)
}

// 继续流水线
export async function resumePipeline(runId: string): Promise<PipelineRun> {
  return await window.electronAPI.pipeline.resume(runId)
}

// 获取流水线状态
export async function getPipelineStatus(runId: string): Promise<PipelineStatus | null> {
  return await window.electronAPI.pipeline.status(runId)
}

// 重试指定步骤
export async function retryPipelineStep(options: {
  runId: string
  stage: string
  batchIndex?: number | null
}): Promise<PipelineRun> {
  return await window.electronAPI.pipeline.retryStep(options)
}

// 获取小说的流水线运行历史
export async function listPipelinesByNovel(novelId: string): Promise<PipelineRun[]> {
  return await window.electronAPI.pipeline.listByNovel(novelId)
}

// 清空小说的流水线相关数据
export async function clearPipelineData(novelId: string): Promise<{ success: boolean }> {
  return await window.electronAPI.pipeline.clear(novelId)
}
