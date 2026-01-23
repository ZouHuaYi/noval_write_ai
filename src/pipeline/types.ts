export type PipelineRun = {
  id: string
  novelId: string
  status: string
  currentStage: string | null
  currentBatch: number | null
  inputWorldview?: string | null
  inputRules?: string | null
  inputOutline?: string | null
  settings?: Record<string, any>
  createdAt?: number
  updatedAt?: number
}

export type PipelineStep = {
  id: string
  runId: string
  stage: string
  batchIndex: number | null
  status: string
  input?: any
  output?: any
  error?: string | null
  startedAt?: number | null
  finishedAt?: number | null
}

export type PipelineStatus = {
  run: PipelineRun
  steps: PipelineStep[]
}
