<template>
  <div
    class="fixed right-5 bottom-5 z-[999] flex flex-col items-end"
    @mouseenter="hovering = true"
    @mouseleave="hovering = false"
  >
    <div
      class="w-[32px] h-[32px] rounded-full cursor-pointer flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.18)] transition-transform duration-200 hover:scale-110"
      :class="{
        'bg-[#e53935]': hasFailed,
        'bg-[#2f7bff]': !hasFailed && hasRunning,
        'bg-[#9aa4b2]': !hasFailed && !hasRunning
      }"
      @click="togglePinned"
    >
      <span v-if="hasFailed" class="text-white text-[10px] font-600 leading-none">{{ failedRuns.length }}</span>
      <span v-else-if="hasRunning" class="text-white text-[10px] font-600 leading-none">{{ runningRuns.length }}</span>
    </div>

    <div
      v-if="showPanel"
      class="w-[260px] max-h-[360px] mt-2.5 p-3 rounded-xl bg-[rgba(25,28,34,0.95)] text-[#e6e9ef] shadow-[0_14px_30px_rgba(0,0,0,0.3)] overflow-y-auto backdrop-blur-[8px] custom-scrollbar"
    >
      <div class="text-[13px] font-600 mb-2">流水线监控</div>

      <div class="mb-3">
        <div class="text-[12px] text-[#b6c0cc] mb-1.5">正在执行</div>
        <div v-if="!runningRuns.length" class="text-[11px] text-[#8b95a3] py-1">暂无正在执行的流水线</div>
        <div v-else class="flex flex-col gap-1.5">
          <div v-for="run in runningRuns" :key="run.id" class="flex justify-between items-center px-2 py-1.5 rounded-lg bg-[rgba(255,255,255,0.06)]">
            <div class="flex flex-col gap-0.5 min-w-0">
              <div class="text-[12px] font-600 text-white truncate max-w-[160px]">{{ getNovelTitle(run.novelId) }}</div>
              <div class="text-[11px] text-[#a8b2bf]">阶段：{{ run.currentStage || '未知' }}</div>
            </div>
            <div class="text-[11px] px-1.5 py-0.5 rounded-full whitespace-nowrap text-[#d7e6ff] bg-[rgba(47,123,255,0.25)]">正在执行</div>
          </div>
        </div>
      </div>

      <div class="mb-3">
        <div class="text-[12px] text-[#b6c0cc] mb-1.5">执行失败</div>
        <div v-if="!failedRuns.length" class="text-[11px] text-[#8b95a3] py-1">暂无失败的流水线</div>
        <div v-else class="flex flex-col gap-1.5">
          <div v-for="run in failedRuns" :key="run.id" class="flex justify-between items-center px-2 py-1.5 rounded-lg bg-[rgba(255,255,255,0.06)]">
            <div class="flex flex-col gap-0.5 min-w-0">
              <div class="text-[12px] font-600 text-white truncate max-w-[160px]">{{ getNovelTitle(run.novelId) }}</div>
              <div class="text-[11px] text-[#a8b2bf]">阶段：{{ run.currentStage || '未知' }}</div>
            </div>
            <div class="text-[11px] px-1.5 py-0.5 rounded-full whitespace-nowrap text-[#ffe1e1] bg-[rgba(229,57,53,0.25)]">执行失败</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { listPipelinesByStatus } from '@/pipeline/client'
import type { PipelineRun } from '@/pipeline/types'
import { useNovelStore } from '@/stores/novel'

const novelStore = useNovelStore()
const runningRuns = ref<PipelineRun[]>([])
const failedRuns = ref<PipelineRun[]>([])
const hovering = ref(false)
const pinned = ref(false)
const refreshing = ref(false)
let timer: number | null = null

// 记录已提示过的失败流水线，避免重复提示
const notifiedFailedIds = new Set<string>()

const hasRunning = computed(() => runningRuns.value.length > 0)
const hasFailed = computed(() => failedRuns.value.length > 0)
const showPanel = computed(() => hovering.value || pinned.value)

function togglePinned() {
  pinned.value = !pinned.value
}

function getNovelTitle(novelId: string) {
  const hit = novelStore.novels.find((item: any) => item.id === novelId)
  return hit?.title || `未命名小说(${novelId})`
}

async function ensureNovelsLoaded() {
  if (!novelStore.novels.length && !novelStore.loading) {
    await novelStore.fetchNovels()
  }
}

async function refreshPipelineStatus(silent = false) {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await ensureNovelsLoaded()
    const [runningList, failedList] = await Promise.all([
      listPipelinesByStatus('running'),
      listPipelinesByStatus('failed')
    ])

    runningRuns.value = (runningList || []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    failedRuns.value = (failedList || []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))

    // 失败提示：仅提示新增失败的流水线
    for (const run of failedRuns.value) {
      if (!notifiedFailedIds.has(run.id)) {
        notifiedFailedIds.add(run.id)
        ElMessage.error(`流水线执行失败：${getNovelTitle(run.novelId)}`)
      }
    }
  } catch (error: any) {
    console.error('刷新流水线状态失败:', error)
    if (!silent) {
      ElMessage.error('刷新流水线状态失败')
    }
  } finally {
    refreshing.value = false
  }
}

onMounted(async () => {
  await refreshPipelineStatus(true)
  timer = window.setInterval(() => {
    refreshPipelineStatus(true)
  }, 5000)
})

onBeforeUnmount(() => {
  if (timer) {
    window.clearInterval(timer)
    timer = null
  }
})
</script>
