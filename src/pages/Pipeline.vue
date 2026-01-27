<template>
  <div class="h-full flex flex-col app-shell">
    <Breadcrumb :novel-title="getNovelTitle(selectedNovelId)" />

    <div class="p-5 app-header flex items-center justify-between">
      <div>
        <div class="text-xs app-muted">自动化生成</div>
        <h2 class="text-xl font-semibold bg-gradient-to-r from-[var(--app-primary)] to-[var(--app-accent)] bg-clip-text text-transparent">流水线生成</h2>
      </div>
      <el-tag size="small" effect="plain">支持后台执行</el-tag>
    </div>

    <div class="flex-1 overflow-auto p-6 flex flex-col gap-4 min-h-0">
      <!-- Top Control Bar -->
      <el-card shadow="hover" class="flex-none border-none rounded-lg !bg-white dark:!bg-gray-800">
        <div class="flex justify-between items-center mb-4">
          <div class="flex items-center gap-4">
            <div class="flex flex-col">
              <el-select
                v-model="selectedNovelId"
                placeholder="请选择小说"
                class="w-64"
                size="large"
                filterable
              >
                <el-option
                  v-for="novel in novelOptions"
                  :key="novel.id"
                  :label="novel.title"
                  :value="novel.id"
                />
              </el-select>
            </div>

            <el-divider direction="vertical" class="!h-8" />

            <div class="flex items-center gap-2">
              <el-button
                type="primary"
                size="large"
                :loading="loading"
                :disabled="!selectedNovelId || currentRun?.status === 'running'"
                @click="onStart"
              >
                <el-icon class="mr-1"><VideoPlay /></el-icon> 启动任务
              </el-button>

              <template v-if="currentRun">
                <el-button
                  v-if="currentRun.status === 'running'"
                  type="warning"
                  size="large"
                  @click="onPause"
                >
                  <el-icon class="mr-1"><VideoPause /></el-icon> 暂停
                </el-button>

                <el-button
                  v-if="currentRun.status === 'paused'"
                  type="success"
                  size="large"
                  @click="onResume"
                >
                  <el-icon class="mr-1"><VideoPlay /></el-icon> 继续
                </el-button>

                <el-button
                  v-if="currentRun.status === 'failed'"
                  type="danger"
                  size="large"
                  @click="onRetry"
                >
                  <el-icon class="mr-1"><RefreshRight /></el-icon> 重试
                </el-button>
              </template>

              <el-button size="large" @click="onRefresh">
                <el-icon><Refresh /></el-icon>
              </el-button>

              <el-popconfirm
                title="确定要清空流水线记录吗？"
                description="仅删除流水线运行记录，不会清空事件与章节计划"
                confirm-button-text="确定清空"
                cancel-button-text="取消"
                @confirm="onClear"
              >
                <template #reference>
                  <el-button size="large" type="danger" plain :disabled="!selectedNovelId">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </template>
              </el-popconfirm>
            </div>
          </div>

          <div class="flex items-center gap-6" v-if="currentRun">
            <div class="text-right">
              <div class="text-xs text-gray-500">当前阶段</div>
              <div class="font-bold text-primary">{{ currentRun.stage || '准备就绪' }}</div>
            </div>
            <div class="text-right">
              <div class="text-xs text-gray-500">状态</div>
              <el-tag :type="getStatusType(currentRun.status)">{{ getStatusLabel(currentRun.status) }}</el-tag>
            </div>
            <div class="text-right">
              <div class="text-xs text-gray-500">批次进度</div>
              <div class="font-mono font-bold">{{ currentRun.currentBatch }}/{{ currentRun.totalBatches }}</div>
            </div>
          </div>
        </div>
      </el-card>

    <!-- Main Content Area -->
    <div class="flex-1 flex gap-4 min-h-0">
      
      <!-- Left Column: Configuration -->
      <div class="w-1/3 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1">
        
        <!-- Parameter Settings -->
        <el-card shadow="never" class="flex-none">
          <template #header>
            <div class="flex items-center justify-between">
              <span class="font-bold">生成参数设置</span>
              <el-icon><Setting /></el-icon>
            </div>
          </template>
          <el-form label-position="top" size="default">
            <div class="grid grid-cols-2 gap-4">
              <el-form-item label="批次大小 (Batch Size)">
                <el-input-number v-model="settings.batchSize" :min="1" :max="10" class="w-full" />
              </el-form-item>
              <el-form-item label="目标章节数">
                <el-input-number v-model="settings.targetChapters" :min="1" class="w-full" />
              </el-form-item>
            </div>
              <el-form-item label="事件生成模型">
                <el-select v-model="settings.eventModelConfigId" placeholder="跟随系统默认" class="w-full">
                  <el-option label="跟随系统默认" value="" />
                  <el-option
                    v-for="config in llmConfigs"
                    :key="config.id"
                    :label="config.name ? `${config.name} (${config.model})` : config.model"
                    :value="config.id"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="计划生成模型">
                <el-select v-model="settings.planModelConfigId" placeholder="跟随系统默认" class="w-full">
                  <el-option label="跟随系统默认" value="" />
                  <el-option
                    v-for="config in llmConfigs"
                    :key="config.id"
                    :label="config.name ? `${config.name} (${config.model})` : config.model"
                    :value="config.id"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="章节写作模型">
                <el-select v-model="settings.chapterModelConfigId" placeholder="跟随系统默认" class="w-full">
                  <el-option label="跟随系统默认" value="" />
                  <el-option
                    v-for="config in llmConfigs"
                    :key="config.id"
                    :label="config.name ? `${config.name} (${config.model})` : config.model"
                    :value="config.id"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="风格审查模型">
                <el-select v-model="settings.reviewModelConfigId" placeholder="跟随系统默认" class="w-full">
                  <el-option label="跟随系统默认" value="" />
                  <el-option
                    v-for="config in llmConfigs"
                    :key="config.id"
                    :label="config.name ? `${config.name} (${config.model})` : config.model"
                    :value="config.id"
                  />
                </el-select>
              </el-form-item>
          </el-form>
        </el-card>

      </div>

      <!-- Right Column: Status & History -->
      <div class="w-2/3 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1">
        
        <!-- Execution Steps -->
        <el-card shadow="never" class="flex-none flex flex-col h-full" body-class="flex-1 flex flex-col overflow-hidden">
          <template #header>
            <div class="flex items-center justify-between">
              <span class="font-bold">执行详情</span>
              <el-tag v-if="steps.length" type="info" size="small">{{ steps.length }} steps</el-tag>
            </div>
          </template>
          
          <div class="flex-1 overflow-y-auto custom-scrollbar p-2">
            <el-timeline v-if="steps.length > 0">
              <el-timeline-item
                v-for="(step, index) in sortedSteps"
                :key="index"
                :type="getStepStatusType(step.status)"
                :timestamp="step.timestamp"
                :hollow="step.status === 'pending'"
                placement="top"
              >
                <el-card shadow="hover" class="!border-l-4" :class="getStepBorderClass(step.status)">
                  <div class="flex justify-between items-start">
                    <h4 class="font-bold text-sm mb-1">{{ step.title }}</h4>
                    <el-tag size="small" :type="getStepStatusType(step.status)">{{ step.status }}</el-tag>
                  </div>
                  <p class="text-xs text-gray-500 mb-2">Stage: {{ step.stage }} | Batch: {{ step.batch }}</p>
                </el-card>
              </el-timeline-item>
            </el-timeline>
            <div v-else class="h-full flex flex-col items-center justify-center text-gray-400">
              <el-icon class="text-4xl mb-2"><Monitor /></el-icon>
              <p>暂无执行记录</p>
            </div>
          </div>
        </el-card>
      </div>
    </div>
  </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import Breadcrumb from '@/components/Breadcrumb.vue'
import { VideoPlay, VideoPause, Refresh, RefreshRight, Setting, Monitor, Delete } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useRoute } from 'vue-router'
import {
  startPipeline,
  pausePipeline,
  resumePipeline,
  retryPipelineStep,
  getPipelineStatus,
  updatePipelineSettings,
  listPipelinesByNovel,
  clearPipelineData
} from '@/pipeline/client'

const loading = ref(false)
const selectedNovelId = ref('')
const novelOptions = ref([])
const route = useRoute()

const inputWorldview = ref('')
const inputRules = ref('')
const inputOutline = ref('')

const settings = reactive({
  batchSize: 5,
  targetChapters: 100,
  wordsPerChapter: 1200,
  temperature: 0.7,
  modelConfigId: '',
  eventModelConfigId: '',
  planModelConfigId: '',
  chapterModelConfigId: '',
  reviewModelConfigId: ''
})

const currentRun = ref(null)
const steps = ref([])
const runs = ref([])
const graphEvents = ref([])
const activeGraphTab = ref('event')
const llmConfigs = ref([])

const draftKeyPrefix = 'pipeline:draft:'
const settingsKeyPrefix = 'pipeline:settings:'
const isDraftLoading = ref(false)
let draftSaveTimer = null
let settingsSaveTimer = null
let modelSyncTimer = null

let refreshTimer = null

// steps 按照时间逆序排序
const sortedSteps = computed(() => {
  return [...steps.value].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
})

const stageLabelMap = {
  analyze: '分析评估',
  events_batch: '事件生成',
  plan: '生成计划',
  chapter_batch: '章节生成',
  graph_sync: '图谱同步',
  completed: '已完成'
}

const statusLabelMap = {
  running: '运行中',
  paused: '已暂停',
  failed: '失败',
  completed: '已完成'
}

async function loadNovels() {
  try {
    const list = await window.electronAPI.novel.list()
    novelOptions.value = list || []
    const queryNovelId = typeof route.query.novelId === 'string' ? route.query.novelId : ''
    if (queryNovelId && novelOptions.value.some(item => item.id === queryNovelId)) {
      selectedNovelId.value = queryNovelId
      return
    }
    if (!selectedNovelId.value && novelOptions.value.length > 0) {
      selectedNovelId.value = novelOptions.value[0].id
    }
  } catch (error) {
    console.error('加载小说列表失败:', error)
  }
}

async function loadWorldview(novelId) {
  try {
    const worldview = await window.electronAPI.worldview.get(novelId)
    inputWorldview.value = worldview?.worldview || ''
    inputRules.value = worldview?.rules || ''
  } catch (error) {
    console.error('加载世界观失败:', error)
  }
}


function normalizeSettings(value) {
  const targetChapters = Number(value?.targetChapters)
  const wordsPerChapter = Number(value?.wordsPerChapter)
  const batchSize = Number(value?.batchSize)
  const temperature = Number(value?.temperature)
  return {
    targetChapters: Number.isFinite(targetChapters) && targetChapters > 0 ? targetChapters : 10,
    wordsPerChapter: Number.isFinite(wordsPerChapter) && wordsPerChapter > 0 ? wordsPerChapter : 1200,
    batchSize: Number.isFinite(batchSize) && batchSize > 0 ? batchSize : 2,
    temperature: Number.isFinite(temperature) ? temperature : 0.7,
    modelConfigId: typeof value?.modelConfigId === 'string' ? value.modelConfigId : '',
    eventModelConfigId: typeof value?.eventModelConfigId === 'string' ? value.eventModelConfigId : '',
    planModelConfigId: typeof value?.planModelConfigId === 'string' ? value.planModelConfigId : '',
    chapterModelConfigId: typeof value?.chapterModelConfigId === 'string' ? value.chapterModelConfigId : '',
    reviewModelConfigId: typeof value?.reviewModelConfigId === 'string' ? value.reviewModelConfigId : ''
  }
}

// 读取生成参数设置
async function loadPipelineSettings(novelId) {
  if (!novelId) return
  try {
    const saved = await window.electronAPI.settings.get(`${settingsKeyPrefix}${novelId}`)
    if (saved) {
      const normalized = normalizeSettings(saved)
      settings.batchSize = normalized.batchSize
      settings.targetChapters = normalized.targetChapters
      settings.wordsPerChapter = normalized.wordsPerChapter
      settings.temperature = normalized.temperature
      settings.modelConfigId = normalized.modelConfigId
      settings.eventModelConfigId = normalized.eventModelConfigId
      settings.planModelConfigId = normalized.planModelConfigId
      settings.chapterModelConfigId = normalized.chapterModelConfigId
      settings.reviewModelConfigId = normalized.reviewModelConfigId
    }
  } catch (error) {
    console.error('加载生成参数失败:', error)
  }
}

// 保存生成参数设置
async function savePipelineSettings(novelId) {
  if (!novelId) return
  try {
    const payload = normalizeSettings(settings)
    await window.electronAPI.settings.set(`${settingsKeyPrefix}${novelId}`, payload, '流水线生成参数')
    // 运行中同步更新配置，确保模型切换实时生效
    if (currentRun.value?.id && ['running', 'paused'].includes(currentRun.value.status)) {
      await updatePipelineSettings({ runId: currentRun.value.id, settings: payload })
    }
  } catch (error) {
    console.error('保存生成参数失败:', error)
  }
}

function scheduleSettingsSave() {
  if (!selectedNovelId.value) return
  if (settingsSaveTimer) window.clearTimeout(settingsSaveTimer)
  settingsSaveTimer = window.setTimeout(() => {
    savePipelineSettings(selectedNovelId.value)
  }, 800)
}

// 模型选择变更时，优先同步到运行中的流水线
function scheduleModelSync() {
  if (!currentRun.value?.id) return
  if (!['running', 'paused'].includes(currentRun.value.status)) return
  if (modelSyncTimer) window.clearTimeout(modelSyncTimer)
  modelSyncTimer = window.setTimeout(async () => {
    try {
      const payload = normalizeSettings(settings)
      await updatePipelineSettings({ runId: currentRun.value.id, settings: payload })
    } catch (error) {
      console.error('同步运行中模型配置失败:', error)
    }
  }, 200)
}

// 读取流水线输入草稿（用于恢复离开页面前的内容）
async function loadDraft(novelId) {
  if (!novelId) return
  isDraftLoading.value = true
  try {
    const draft = await window.electronAPI.settings.get(`${draftKeyPrefix}${novelId}`)
    if (draft) {
      if (draft.worldview !== undefined) inputWorldview.value = draft.worldview
      if (draft.rules !== undefined) inputRules.value = draft.rules
      if (draft.outline !== undefined) inputOutline.value = draft.outline
    }
  } catch (error) {
    console.error('加载流水线草稿失败:', error)
  } finally {
    isDraftLoading.value = false
  }
}

async function loadLLMConfigs() {
  try {
    const configs = await window.electronAPI.settings.get('llm_configs')
    llmConfigs.value = Array.isArray(configs) ? configs : []
  } catch (error) {
    console.error('加载模型配置失败:', error)
  }
}

// 保存流水线输入草稿（离开页面仍可恢复）
async function saveDraft(novelId) {
  if (!novelId) return
  const payload = {
    worldview: inputWorldview.value,
    rules: inputRules.value,
    outline: inputOutline.value,
    updatedAt: Date.now()
  }
  try {
    await window.electronAPI.settings.set(`${draftKeyPrefix}${novelId}`, payload, '流水线输入草稿')
    await window.electronAPI.worldview.save(novelId, {
      worldview: inputWorldview.value,
      rules: inputRules.value
    })
  } catch (error) {
    console.error('保存流水线草稿失败:', error)
  }
}

// 输入变更后延迟保存，避免频繁写入
function scheduleDraftSave() {
  if (!selectedNovelId.value || isDraftLoading.value) return
  if (draftSaveTimer) window.clearTimeout(draftSaveTimer)
  draftSaveTimer = window.setTimeout(() => {
    saveDraft(selectedNovelId.value)
  }, 800)
}

function buildStepLog(step) {
  if (step.error) return `错误: ${step.error}`
  const data = step.output || step.input
  if (!data) return '无输出信息'
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

function buildStepsView(stepList) {
  return (stepList || []).map(step => ({
    title: stageLabelMap[step.stage] || step.stage,
    status: step.status,
    stage: step.stage,
    batch: step.batchIndex != null ? step.batchIndex + 1 : '-',
    timestamp: formatTimestamp(step.finishedAt || step.startedAt),
    log: buildStepLog(step)
  }))
}

function computeProgress(stepList) {
  if (!stepList || stepList.length === 0) return 0
  const completed = stepList.filter(step => step.status === 'completed').length
  return Math.round((completed / stepList.length) * 100)
}

function computeTotalBatches(stepList, stage) {
  if (!stepList || stepList.length === 0) return 0
  const stageSteps = stepList.filter(step => step.stage === stage)
  if (!stageSteps.length) return 0
  const batchIndexes = stageSteps.map(step => step.batchIndex).filter(val => typeof val === 'number')
  if (!batchIndexes.length) return stageSteps.length
  return Math.max(...batchIndexes) + 1
}

function applyPipelineStatus(run, stepList) {
  if (!run) {
    currentRun.value = null
    steps.value = []
    return
  }
  const progress = computeProgress(stepList)
  const totalBatches = computeTotalBatches(stepList, run.currentStage)
  currentRun.value = {
    ...run,
    stage: stageLabelMap[run.currentStage] || run.currentStage || '准备就绪',
    currentBatch: run.currentBatch ?? 0,
    progress,
    totalBatches
  }
  steps.value = buildStepsView(stepList)
}

async function loadRuns(novelId) {
  const list = await listPipelinesByNovel(novelId)
  runs.value = (list || []).map(run => ({
    id: run.id,
    startTime: formatTimestamp(run.createdAt),
    novelName: getNovelTitle(run.novelId),
    stage: stageLabelMap[run.currentStage] || run.currentStage || '未知',
    status: run.status
  }))

  if (list && list.length > 0) {
    await refreshStatus(list[0].id)
  } else {
    applyPipelineStatus(null, [])
  }
}

async function loadGraphData(novelId) {
  if (!novelId) return
  try {
    const data = await window.electronAPI.planning.loadData(novelId)
    graphEvents.value = data?.events || []
  } catch (error) {
    console.error('加载图谱数据失败:', error)
    graphEvents.value = []
  }
}

function getNovelTitle(novelId) {
  const novel = novelOptions.value.find(item => item.id === novelId)
  return novel?.title || '未命名'
}

async function refreshStatus(runId) {
  if (!runId) return
  try {
    const status = await getPipelineStatus(runId)
    if (!status) return
    applyPipelineStatus(status.run, status.steps)
    if (status.run?.status === 'running') {
      ensureAutoRefresh()
    } else {
      clearAutoRefresh()
    }
  } catch (error) {
    console.error('刷新流水线状态失败:', error)
  }
}

function ensureAutoRefresh() {
  if (refreshTimer) return
  refreshTimer = window.setInterval(() => {
    if (currentRun.value?.id) {
      refreshStatus(currentRun.value.id)
    }
  }, 4000)
}

function clearAutoRefresh() {
  if (!refreshTimer) return
  window.clearInterval(refreshTimer)
  refreshTimer = null
}

async function onStart() {
  if (!selectedNovelId.value) {
    ElMessage.warning('请先选择一本小说')
    return
  }
  loading.value = true
  try {
    const normalizedSettings = normalizeSettings(settings)
    const run = await startPipeline({
      novelId: selectedNovelId.value,
      inputWorldview: inputWorldview.value,
      inputRules: inputRules.value,
      inputOutline: inputOutline.value,
      settings: {
        targetChapters: normalizedSettings.targetChapters,
        wordsPerChapter: normalizedSettings.wordsPerChapter,
        eventBatchSize: normalizedSettings.batchSize,
        chapterBatchSize: normalizedSettings.batchSize,
        cycleBatchSize: normalizedSettings.batchSize,
        temperature: normalizedSettings.temperature,
        modelConfigId: normalizedSettings.modelConfigId,
        eventModelConfigId: normalizedSettings.eventModelConfigId,
        planModelConfigId: normalizedSettings.planModelConfigId,
        chapterModelConfigId: normalizedSettings.chapterModelConfigId,
        reviewModelConfigId: normalizedSettings.reviewModelConfigId
      }
    })
    await refreshStatus(run.id)
    await loadRuns(selectedNovelId.value)
    ElMessage.success('流水线已启动，离开页面也不会中断执行')
  } catch (error) {
    ElMessage.error('启动流水线失败: ' + (error?.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

async function onPause() {
  if (!currentRun.value?.id) return
  try {
    await pausePipeline(currentRun.value.id)
    await refreshStatus(currentRun.value.id)
    ElMessage.success('流水线已暂停')
  } catch (error) {
    ElMessage.error('暂停失败: ' + (error?.message || '未知错误'))
  }
}

async function onResume() {
  if (!currentRun.value?.id) return
  try {
    await resumePipeline(currentRun.value.id)
    await refreshStatus(currentRun.value.id)
    ElMessage.success('流水线已继续')
  } catch (error) {
    ElMessage.error('继续失败: ' + (error?.message || '未知错误'))
  }
}

async function onRetry() {
  if (!currentRun.value?.id || !currentRun.value?.currentStage) return
  try {
    await retryPipelineStep({
      runId: currentRun.value.id,
      stage: currentRun.value.currentStage,
      batchIndex: currentRun.value.currentBatch
    })
    await refreshStatus(currentRun.value.id)
    ElMessage.success('已触发重试')
  } catch (error) {
    ElMessage.error('重试失败: ' + (error?.message || '未知错误'))
  }
}

async function onRefresh() {
  if (!currentRun.value?.id) {
    await loadRuns(selectedNovelId.value)
    return
  }
  await refreshStatus(currentRun.value.id)
  ElMessage.success('状态已刷新')
}

async function onClear() {
  if (!selectedNovelId.value) {
    ElMessage.warning('请先选择一本小说')
    return
  }
  loading.value = true
  try {
    await clearPipelineData(selectedNovelId.value)
    // 重置本地状态
    currentRun.value = null
    steps.value = []
    runs.value = []
    graphEvents.value = []
    // 重新加载数据
    await loadRuns(selectedNovelId.value)
    await loadGraphData(selectedNovelId.value)
    ElMessage.success('流水线数据已清空')
  } catch (error) {
    ElMessage.error('清空失败: ' + (error?.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

const getStatusType = (status) => {
  const map = {
    running: 'primary',
    paused: 'warning',
    failed: 'danger',
    completed: 'success'
  }
  return map[status] || 'info'
}

const getStatusLabel = (status) => {
  return statusLabelMap[status] || status || '未知'
}

const getStepStatusType = (status) => {
  const map = {
    pending: 'info',
    running: 'primary',
    completed: 'success',
    failed: 'danger'
  }
  return map[status] || 'info'
}

const getStepBorderClass = (status) => {
  const map = {
    pending: '!border-l-gray-300',
    running: '!border-l-blue-500',
    completed: '!border-l-green-500',
    failed: '!border-l-red-500'
  }
  return map[status] || '!border-l-gray-300'
}

const tableRowClassName = ({ row }) => {
  if (row.status === 'failed') return 'bg-red-50 dark:bg-red-900/10'
  return ''
}

function formatTimestamp(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleString()
}

watch(selectedNovelId, async (novelId) => {
  if (!novelId) return
  await loadWorldview(novelId)
  await loadRuns(novelId)
  await loadGraphData(novelId)
  await loadDraft(novelId)
  await loadPipelineSettings(novelId)
})

watch([inputWorldview, inputRules, inputOutline], () => {
  scheduleDraftSave()
})

watch(settings, () => {
  scheduleSettingsSave()
}, { deep: true })

watch(
  () => [settings.eventModelConfigId, settings.planModelConfigId, settings.chapterModelConfigId, settings.reviewModelConfigId],
  () => {
    scheduleModelSync()
  }
)

onMounted(async () => {
  await loadNovels()
  await loadLLMConfigs()
  if (selectedNovelId.value) {
    await loadRuns(selectedNovelId.value)
    await loadGraphData(selectedNovelId.value)
  }
})

onBeforeUnmount(() => {
  clearAutoRefresh()
  if (draftSaveTimer) window.clearTimeout(draftSaveTimer)
  if (settingsSaveTimer) window.clearTimeout(settingsSaveTimer)
  if (modelSyncTimer) window.clearTimeout(modelSyncTimer)
})
</script>

<style scoped>
/* Custom scrollbar for content areas */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #dcdfe6;
  border-radius: 3px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: #4b5563;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #c0c4cc;
}
</style>
