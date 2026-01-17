<template>
  <div class="h-full flex flex-col bg-[var(--app-bg)]">
    <!-- 工具栏 -->
    <div class="flex justify-between items-center px-4 py-3 border-b border-[var(--app-border)] bg-[var(--app-surface-muted)] shrink-0">
      <div class="flex items-center gap-2">
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button value="graph">
            <el-icon><Share /></el-icon>
            事件图谱
          </el-radio-button>
          <el-radio-button value="kanban">
            <el-icon><List /></el-icon>
            看板
          </el-radio-button>
        </el-radio-group>
      </div>
      <div class="flex items-center gap-2">
        <el-button size="small" @click="generateEventGraph" :loading="generating">
          <el-icon><MagicStick /></el-icon>
          生成图谱
        </el-button>
        <el-button size="small" @click="generatePlan" :loading="planLoading" :disabled="!events.length">
          <el-icon><Calendar /></el-icon>
          生成计划
        </el-button>
        <el-button size="small" @click="getRecommendation" :disabled="!chapters.length">
          <el-icon><Aim /></el-icon>
          智能推荐
        </el-button>
      </div>
    </div>

    <!-- 统计信息 -->
    <div class="flex items-center gap-6 px-4 py-3 bg-[var(--el-fill-color-lighter)] border-b border-[var(--app-border)] shrink-0">
      <div class="flex flex-col items-center">
        <span class="text-xl font-bold text-[var(--el-color-primary)]">{{ events.length }}</span>
        <span class="text-xs text-[var(--el-text-color-secondary)]">事件</span>
      </div>
      <div class="flex flex-col items-center">
        <span class="text-xl font-bold text-[var(--el-color-primary)]">{{ chapters.length }}</span>
        <span class="text-xs text-[var(--el-text-color-secondary)]">章节</span>
      </div>
      <div class="flex flex-col items-center">
        <span class="text-xl font-bold text-[var(--el-color-primary)]">{{ completedCount }}</span>
        <span class="text-xs text-[var(--el-text-color-secondary)]">已完成</span>
      </div>
      <div class="flex-1 max-w-[200px]">
        <el-progress :percentage="progressPercentage" :stroke-width="8" />
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="flex-1 overflow-hidden">
      <!-- 事件图谱视图 -->
      <EventGraph
        v-if="viewMode === 'graph'"
        :events="events"
        :layout="graphLayout"
        @event-select="handleEventSelect"
      />

      <!-- 看板视图 -->
      <KanbanBoard
        v-else
        :board="kanbanBoard"
        :recommendation="recommendation"
        @task-select="handleTaskSelect"
        @task-move="handleTaskMove"
        @start-writing="handleStartWriting"
        @refresh="loadData"
        @request-recommendation="getRecommendation"
      />
    </div>

    <!-- 生成图谱对话框 -->
    <el-dialog v-model="showGenerateDialog" title="生成事件图谱" width="500px">
      <el-form label-width="100px">
        <el-form-item label="目标章节数">
          <el-input-number v-model="generateOptions.targetChapters" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="故事梗概">
          <el-input 
            v-model="generateOptions.synopsis" 
            type="textarea" 
            :rows="4" 
            placeholder="输入故事梗概，帮助 AI 更好地理解情节..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showGenerateDialog = false">取消</el-button>
        <el-button type="primary" @click="doGenerateGraph" :loading="generating">
          开始生成
        </el-button>
      </template>
    </el-dialog>

    <!-- 事件详情抽屉 -->
    <el-drawer v-model="showEventDetail" title="事件详情" size="400px">
      <div v-if="selectedEvent" class="px-2">
        <div class="flex items-center gap-3 mb-3">
          <el-tag :type="getEventTypeTag(selectedEvent.eventType)">
            {{ getEventTypeLabel(selectedEvent.eventType) }}
          </el-tag>
          <span class="text-[13px] text-[var(--el-text-color-secondary)]">第 {{ selectedEvent.chapter }} 章</span>
        </div>
        <h3 class="text-lg font-600 m-0 mb-3">{{ selectedEvent.label }}</h3>
        <p class="text-sm leading-relaxed text-[var(--el-text-color-regular)] m-0 mb-4">{{ selectedEvent.description }}</p>
        
        <div v-if="selectedEvent.characters?.length" class="mb-4">
          <div class="text-xs text-[var(--el-text-color-secondary)] mb-2">相关角色</div>
          <div class="flex flex-wrap gap-1.5">
            <el-tag v-for="char in selectedEvent.characters" :key="char" size="small">
              {{ char }}
            </el-tag>
          </div>
        </div>

        <div v-if="selectedEvent.preconditions?.length" class="mb-4">
          <div class="text-xs text-[var(--el-text-color-secondary)] mb-2">前置条件</div>
          <ul class="m-0 pl-[18px] text-[13px] leading-relaxed text-[var(--el-text-color-regular)]">
            <li v-for="(cond, i) in selectedEvent.preconditions" :key="i">{{ cond }}</li>
          </ul>
        </div>

        <div v-if="selectedEvent.postconditions?.length" class="mb-4">
          <div class="text-xs text-[var(--el-text-color-secondary)] mb-2">后置影响</div>
          <ul class="m-0 pl-[18px] text-[13px] leading-relaxed text-[var(--el-text-color-regular)]">
            <li v-for="(cond, i) in selectedEvent.postconditions" :key="i">{{ cond }}</li>
          </ul>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Aim, Calendar, List, MagicStick, Share } from '@element-plus/icons-vue'
import EventGraph from '@/components/EventGraph.vue'
import KanbanBoard from '@/components/KanbanBoard.vue'

const props = defineProps<{
  novelId?: string
  novelTitle?: string
}>()

const emit = defineEmits<{
  (e: 'start-writing', chapterId: string): void
}>()

// 视图状态
const viewMode = ref<'graph' | 'kanban'>('graph')
const graphLayout = ref<'horizontal' | 'vertical'>('horizontal')

// 数据
const events = ref<any[]>([])
const chapters = ref<any[]>([])
const kanbanBoard = ref<any>(null)
const recommendation = ref<any>(null)

// 选中状态
const selectedEvent = ref<any>(null)
const showEventDetail = ref(false)

// 加载状态
const generating = ref(false)
const planLoading = ref(false)

// 生成对话框
const showGenerateDialog = ref(false)
const generateOptions = ref({
  targetChapters: 10,
  synopsis: ''
})

// 计算属性
const completedCount = computed(() => {
  if (!kanbanBoard.value?.columns) return 0
  const completedCol = kanbanBoard.value.columns.find((c: any) => c.id === 'completed')
  return completedCol?.tasks?.length || 0
})

const progressPercentage = computed(() => {
  if (chapters.value.length === 0) return 0
  return Math.round((completedCount.value / chapters.value.length) * 100)
})

// 事件类型配置
const eventTypeLabels: Record<string, string> = {
  plot: '情节',
  character: '角色',
  conflict: '冲突',
  resolution: '解决',
  transition: '过渡'
}

const eventTypeTags: Record<string, string> = {
  plot: 'primary',
  character: 'success',
  conflict: 'danger',
  resolution: 'warning',
  transition: 'info'
}

function getEventTypeLabel(type: string): string {
  return eventTypeLabels[type] || type
}

function getEventTypeTag(type: string): string {
  return eventTypeTags[type] || 'info'
}

// 加载数据
async function loadData() {
  if (!props.novelId) return
  
  try {
    // 这里可以从本地存储或后端加载已保存的数据
    // 暂时使用空数据，等待用户生成
  } catch (error) {
    console.error('加载数据失败:', error)
  }
}

// 生成事件图谱
function generateEventGraph() {
  showGenerateDialog.value = true
}

async function doGenerateGraph() {
  if (!props.novelId) {
    ElMessage.warning('请先选择小说')
    return
  }

  generating.value = true
  try {
    const result = await window.electronAPI?.planning?.generateEventGraph({
      novelTitle: props.novelTitle || '未命名小说',
      synopsis: generateOptions.value.synopsis,
      targetChapters: generateOptions.value.targetChapters
    })

    if (result?.events) {
      events.value = result.events
      ElMessage.success(`成功生成 ${result.events.length} 个事件节点`)
      showGenerateDialog.value = false
    }
  } catch (error: any) {
    console.error('生成图谱失败:', error)
    ElMessage.error('生成图谱失败: ' + (error.message || '未知错误'))
  } finally {
    generating.value = false
  }
}

// 生成章节计划
async function generatePlan() {
  if (events.value.length === 0) {
    ElMessage.warning('请先生成事件图谱')
    return
  }

  planLoading.value = true
  try {
    const result = await window.electronAPI?.planning?.generatePlan({
      events: events.value,
      targetChapters: generateOptions.value.targetChapters,
      wordsPerChapter: 3000
    })

    if (result?.chapters) {
      chapters.value = result.chapters
      
      // 创建看板
      const board = await window.electronAPI?.planning?.createKanban(result.chapters)
      if (board) {
        kanbanBoard.value = board
        viewMode.value = 'kanban'
        ElMessage.success('章节计划生成完成')
      }
    }
  } catch (error: any) {
    console.error('生成计划失败:', error)
    ElMessage.error('生成计划失败: ' + (error.message || '未知错误'))
  } finally {
    planLoading.value = false
  }
}

// 获取推荐
async function getRecommendation() {
  if (chapters.value.length === 0) return

  try {
    const result = await window.electronAPI?.planning?.recommendTask(
      events.value,
      chapters.value,
      {} // 当前进度
    )
    
    if (result) {
      recommendation.value = result
    }
  } catch (error) {
    console.error('获取推荐失败:', error)
  }
}

// 事件处理
function handleEventSelect(event: any) {
  selectedEvent.value = event
  showEventDetail.value = true
}

function handleTaskSelect(task: any) {
  // 可以显示任务详情
  console.log('选中任务:', task)
}

function handleTaskMove(taskId: string, targetStatus: string) {
  // 更新看板状态
  if (!kanbanBoard.value) return

  const columns = kanbanBoard.value.columns
  let movedTask: any = null

  // 从原列移除
  for (const col of columns) {
    const idx = col.tasks.findIndex((t: any) => t.id === taskId)
    if (idx !== -1) {
      movedTask = col.tasks.splice(idx, 1)[0]
      break
    }
  }

  // 添加到目标列
  if (movedTask) {
    movedTask.status = targetStatus
    const targetCol = columns.find((c: any) => c.id === targetStatus)
    if (targetCol) {
      targetCol.tasks.push(movedTask)
    }
  }
}

function handleStartWriting(chapterNumber: number) {
  emit('start-writing', `chapter_${chapterNumber}`)
  ElMessage.info(`开始写作第 ${chapterNumber} 章`)
}

// 监听 novelId 变化
watch(() => props.novelId, () => {
  loadData()
}, { immediate: true })

onMounted(() => {
  loadData()
})
</script>


