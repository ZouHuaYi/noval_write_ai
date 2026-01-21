<template>
  <div class="kanban-board">
    <!-- 看板头部 -->
    <div class="kanban-header">
      <div class="kanban-title">
        <el-icon class="kanban-icon"><List /></el-icon>
        <span>写作计划看板</span>
      </div>
      <div class="kanban-actions">
        <el-button size="small" @click="refreshBoard">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
        <el-button size="small" type="primary" @click="showRecommendation">
          <el-icon><Aim /></el-icon>
          智能推荐
        </el-button>
      </div>
    </div>

    <!-- 看板统计 -->
    <div class="kanban-stats">
      <div class="stat-item">
        <span class="stat-label">待写作</span>
        <span class="stat-value">{{ pendingCount }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">进行中</span>
        <span class="stat-value stat-value--progress">{{ inProgressCount }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">已完成</span>
        <span class="stat-value stat-value--completed">{{ completedCount }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">总进度</span>
        <el-progress 
          :percentage="progressPercentage" 
          :stroke-width="6"
          style="width: 100px"
        />
      </div>
    </div>

    <!-- 看板列 -->
    <div class="kanban-columns">
      <div 
        v-for="column in board.columns" 
        :key="column.id"
        class="kanban-column"
        :class="`kanban-column--${column.id}`"
        @dragover.prevent
        @drop="onDrop($event, column.id)"
      >
        <div class="column-header">
          <div class="flex items-center gap-2">
            <span class="column-title">{{ column.title }}</span>
            <el-tag size="small" type="info" round>{{ column.tasks.length }}</el-tag>
          </div>
          <el-button 
            v-if="column.id === 'pending'"
            size="small" 
            text 
            circle 
            :icon="Plus" 
            @click="showAddTaskDialog"
          />
        </div>
        
        <div class="column-content">
          <div
            v-for="task in column.tasks"
            :key="task.id"
            class="task-card"
            :class="`task-card--${task.priority}`"
            draggable="true"
            @dragstart="onDragStart($event, task)"
            @click="selectTask(task)"
          >
            <!-- 优先级标记 -->
            <div class="task-priority" :class="`priority--${task.priority}`">
              {{ getPriorityLabel(task.priority) }}
            </div>
            
            <!-- 章节信息 -->
            <div class="task-header">
              <div class="flex items-center gap-1">
                <span class="task-chapter">第 {{ task.chapterNumber }} 章</span>
                <el-icon v-if="task.id === recommendedTaskId" class="task-recommended">
                  <Star />
                </el-icon>
              </div>
              <div class="task-actions opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <el-button
                  size="small"
                  circle
                  text
                  :type="task.lockWritingTarget ? 'warning' : 'info'"
                  :icon="task.lockWritingTarget ? Lock : Unlock"
                  @click.stop="emit('toggle-lock', task)"
                />
                <el-button size="small" circle text :icon="Delete" @click.stop="emit('delete-chapter', task.id)" />
              </div>
            </div>

            
            <!-- 任务标题 -->
            <div class="task-title">{{ task.title }}</div>
            
            <!-- 任务元信息 -->
            <div class="task-meta">
              <span class="meta-item">
                <el-icon><Document /></el-icon>
                {{ task.eventCount }} 事件
              </span>
              <span class="meta-item">
                <el-icon><Edit /></el-icon>
                {{ task.targetWords }} 字
              </span>
            </div>
            
            <!-- 写作重点 -->
            <div v-if="task.focus?.length" class="task-focus">
              <el-tag 
                v-for="f in task.focus.slice(0, 3)" 
                :key="f" 
                size="small" 
                type="info"
                effect="plain"
              >
                {{ f }}
              </el-tag>
            </div>

            <!-- 进度条 -->
            <el-progress 
              v-if="task.progress > 0"
              :percentage="task.progress" 
              :stroke-width="4"
              :show-text="false"
              class="task-progress"
            />
          </div>

          <!-- 空状态 -->
          <div v-if="column.tasks.length === 0" class="column-empty">
            <el-icon><Folder /></el-icon>
            <span>暂无任务</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 任务详情抽屉 -->
    <el-drawer
      v-model="showTaskDetail"
      title="任务详情"
      direction="rtl"
      size="400px"
    >
      <div v-if="selectedTask" class="task-detail">
        <div class="detail-section">
          <h4>基本信息</h4>
          <div class="detail-row">
            <span class="detail-label">章节</span>
            <span class="detail-value">第 {{ selectedTask.chapterNumber }} 章</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">标题</span>
            <span class="detail-value">{{ selectedTask.title }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">优先级</span>
            <el-tag :type="getPriorityTagType(selectedTask.priority)">
              {{ getPriorityLabel(selectedTask.priority) }}
            </el-tag>
          </div>
          <div class="detail-row">
            <span class="detail-label">目标字数</span>
            <span class="detail-value">{{ selectedTask.targetWords }} 字</span>
          </div>
        </div>

        <div v-if="selectedTask.focus?.length" class="detail-section">
          <h4>写作重点</h4>
          <div class="focus-tags">
            <el-tag v-for="f in selectedTask.focus" :key="f" type="success">
              {{ f }}
            </el-tag>
          </div>
        </div>

        <div v-if="selectedTask.hints?.length" class="detail-section">
          <h4>写作建议</h4>
          <ul class="hints-list">
            <li v-for="(hint, i) in selectedTask.hints" :key="i">{{ hint }}</li>
          </ul>
        </div>

        <div v-if="taskTimeEstimate" class="detail-section">
          <h4>时间估算</h4>
          <div class="time-estimate">
            <div class="time-main">
              预计 {{ taskTimeEstimate.estimatedHours }} 小时
            </div>
            <div class="time-breakdown">
              <span>写作 {{ taskTimeEstimate.breakdown.writing }} 分钟</span>
              <span v-if="taskTimeEstimate.breakdown.complexity">
                + 复杂度 {{ taskTimeEstimate.breakdown.complexity }} 分钟
              </span>
            </div>
          </div>
        </div>

        <div class="detail-actions">
          <el-button type="primary" @click="startWriting(selectedTask)">
            开始写作
          </el-button>
          <el-button @click="moveToNextStatus(selectedTask)">
            移至下一阶段
          </el-button>
        </div>
      </div>
    </el-drawer>


    <!-- 推荐弹窗 -->
    <el-dialog
      v-model="showRecommendDialog"
      title="🎯 智能推荐"
      width="500px"
    >
      <div v-if="recommendation" class="recommendation-content">
        <div class="recommendation-header">
          <span class="recommendation-label">推荐下一步写作：</span>
          <span class="recommendation-chapter">
            第 {{ recommendation.chapter.chapterNumber }} 章 - {{ recommendation.chapter.title }}
          </span>
        </div>
        
        <div v-if="recommendation.reason" class="recommendation-reason">
          <el-icon><InfoFilled /></el-icon>
          <span>{{ recommendation.reason }}</span>
        </div>

        <div v-if="recommendation.blockedBy?.length" class="recommendation-blocked">
          <el-icon class="warning-icon"><Warning /></el-icon>
          <div>
            <div class="blocked-title">注意：存在前置依赖</div>
            <ul class="blocked-list">
              <li v-for="dep in recommendation.blockedBy" :key="dep.eventId">
                第 {{ dep.chapter }} 章：{{ dep.eventLabel }}
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div v-else class="recommendation-empty">
        <el-icon><CircleCheck /></el-icon>
        <span>太棒了！所有章节都已完成</span>
      </div>
      
      <template #footer>
        <el-button @click="showRecommendDialog = false">关闭</el-button>
        <el-button v-if="recommendation" type="primary" @click="acceptRecommendation">
          开始写作
        </el-button>
      </template>
    </el-dialog>

    <!-- 新增章节对话框 -->
    <el-dialog
      v-model="addTaskDialogVisible"
      title="新增章节任务"
      width="450px"
    >
      <el-form :model="taskForm" label-width="80px">
        <el-form-item label="章节号">
          <el-input-number v-model="taskForm.chapterNumber" :min="1" />
        </el-form-item>
        <el-form-item label="章节标题">
          <el-input v-model="taskForm.title" placeholder="输入章节标题" />
        </el-form-item>
        <el-form-item label="任务状态">
          <el-select v-model="taskForm.status" style="width: 100%">
            <el-option label="待写作" value="pending" />
            <el-option label="写作中" value="in_progress" />
            <el-option label="已完成" value="completed" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-radio-group v-model="taskForm.priority">
            <el-radio value="high">高</el-radio>
            <el-radio value="medium">中</el-radio>
            <el-radio value="low">低</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="目标字数">
          <el-input-number v-model="taskForm.targetWords" :step="500" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addTaskDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAddTask">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Aim, CircleCheck, Document, Edit, Folder,
  InfoFilled, List, Refresh, Star, Warning, Plus, Delete, Lock, Unlock
} from '@element-plus/icons-vue'

import { ElMessage } from 'element-plus'

interface Task {
  id: string
  chapterNumber: number
  title: string
  priority: 'high' | 'medium' | 'low'
  eventCount: number
  targetWords: number
  focus: string[]
  hints: string[]
  status: string
  progress: number
  lockWritingTarget?: boolean
}

interface Column {
  id: string
  title: string
  tasks: Task[]
}

interface Board {
  columns: Column[]
}

interface Recommendation {
  chapter: any
  reason: string
  blockedBy: Array<{ eventId: string; eventLabel: string; chapter: number }>
}

const props = defineProps<{
  board?: Board
  recommendation?: Recommendation | null
}>()

interface KanbanEmits {
  (e: 'task-select', task: Task): void
  (e: 'task-move', taskId: string, targetStatus: string): void
  (e: 'start-writing', chapterNumber: number): void
  (e: 'refresh'): void
  (e: 'request-recommendation'): void
  (e: 'add-chapter', chapterData: any): void
  (e: 'delete-chapter', taskId: string): void
  (e: 'toggle-lock', task: Task): void
}

const emit = defineEmits<KanbanEmits>()

const showTaskDetail = ref(false)
const selectedTask = ref<Task | null>(null)
const showRecommendDialog = ref(false)
const draggedTask = ref<Task | null>(null)
const recommendedTaskId = ref<string | null>(null)
const taskTimeEstimate = ref<any>(null)

const addTaskDialogVisible = ref(false)
const taskForm = ref({
  chapterNumber: 1,
  title: '',
  priority: 'medium' as 'high' | 'medium' | 'low',
  targetWords: 1500,
  status: 'pending'
})

function showAddTaskDialog() {
  const maxChapter = props.board?.columns.reduce((max, col) => {
    const colMax = col.tasks.reduce((m, t) => Math.max(m, t.chapterNumber), 0)
    return Math.max(max, colMax)
  }, 0) || 0

  taskForm.value = {
    chapterNumber: maxChapter + 1,
    title: '',
    priority: 'medium',
    targetWords: 3000,
    status: 'pending'
  }
  addTaskDialogVisible.value = true
}

function handleAddTask() {
  if (!taskForm.value.title.trim()) {
    taskForm.value.title = `第 ${taskForm.value.chapterNumber} 章`
  }

  emit('add-chapter', { ...taskForm.value })
  addTaskDialogVisible.value = false
  ElMessage.success('已添加章节任务')
}


// 默认看板
const defaultBoard: Board = {
  columns: [
    { id: 'pending', title: '待写作', tasks: [] },
    { id: 'in_progress', title: '写作中', tasks: [] },
    { id: 'review', title: '待审核', tasks: [] },
    { id: 'completed', title: '已完成', tasks: [] }
  ]
}

const board = computed(() => props.board || defaultBoard)
const recommendation = computed(() => props.recommendation)

// 统计
const pendingCount = computed(() => 
  board.value.columns.find(c => c.id === 'pending')?.tasks.length || 0
)
const inProgressCount = computed(() => 
  board.value.columns.find(c => c.id === 'in_progress')?.tasks.length || 0
)
const completedCount = computed(() => 
  board.value.columns.find(c => c.id === 'completed')?.tasks.length || 0
)
const totalTasks = computed(() => 
  board.value.columns.reduce((sum, col) => sum + col.tasks.length, 0)
)
const progressPercentage = computed(() => {
  if (totalTasks.value === 0) return 0
  return Math.round((completedCount.value / totalTasks.value) * 100)
})

// 优先级
function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    high: '高',
    medium: '中',
    low: '低'
  }
  return labels[priority] || priority
}

function getPriorityTagType(priority: string): string {
  const types: Record<string, string> = {
    high: 'danger',
    medium: 'warning',
    low: 'info'
  }
  return types[priority] || 'info'
}

// 拖拽
function onDragStart(event: DragEvent, task: Task) {
  draggedTask.value = task
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', task.id)
  }
}

function onDrop(_event: DragEvent, targetColumnId: string) {
  if (draggedTask.value) {
    emit('task-move', draggedTask.value.id, targetColumnId)
    draggedTask.value = null
  }
}

// 任务操作
function selectTask(task: Task) {
  selectedTask.value = task
  showTaskDetail.value = true
  estimateTaskTime(task)
  emit('task-select', task)
}

function estimateTaskTime(task: Task) {
  // 简单的时间估算
  const wordsPerHour = 500
  const baseHours = task.targetWords / wordsPerHour
  const complexityFactor = 1 + (task.eventCount - 1) * 0.2
  const priorityFactor = task.priority === 'high' ? 1.3 : 1
  
  const estimatedHours = baseHours * complexityFactor * priorityFactor
  
  taskTimeEstimate.value = {
    estimatedHours: Math.round(estimatedHours * 10) / 10,
    breakdown: {
      writing: Math.round(baseHours * 60),
      complexity: Math.round((complexityFactor - 1) * baseHours * 60),
      polish: Math.round((priorityFactor - 1) * baseHours * 60)
    }
  }
}

function startWriting(task: Task) {
  emit('start-writing', task.chapterNumber)
  showTaskDetail.value = false
}

function moveToNextStatus(task: Task) {
  const statusOrder = ['pending', 'in_progress', 'review', 'completed']
  const currentIndex = statusOrder.indexOf(task.status)
  if (currentIndex < statusOrder.length - 1) {
    emit('task-move', task.id, statusOrder[currentIndex + 1])
  }
}

// 推荐
function showRecommendation() {
  emit('request-recommendation')
  showRecommendDialog.value = true
}

function acceptRecommendation() {
  if (recommendation.value) {
    emit('start-writing', recommendation.value.chapter.chapterNumber)
    showRecommendDialog.value = false
  }
}

function refreshBoard() {
  emit('refresh')
}

// 监听推荐变化
watch(recommendation, (newRec) => {
  if (newRec?.chapter) {
    recommendedTaskId.value = `task_chapter_${newRec.chapter.chapterNumber}`
  } else {
    recommendedTaskId.value = null
  }
})
</script>

<style scoped>
.kanban-board {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--app-bg);
}

.kanban-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--app-border);
}

.kanban-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}

.kanban-icon {
  font-size: 20px;
  color: var(--el-color-primary);
}

.kanban-actions {
  display: flex;
  gap: 8px;
}

.kanban-stats {
  display: flex;
  gap: 24px;
  padding: 12px 16px;
  background: var(--el-fill-color-lighter);
  border-bottom: 1px solid var(--app-border);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stat-value--progress {
  color: var(--el-color-primary);
}

.stat-value--completed {
  color: var(--el-color-success);
}

.kanban-columns {
  display: flex;
  flex: 1;
  gap: 12px;
  padding: 16px;
  overflow-x: auto;
}

.kanban-column {
  flex: 1;
  min-width: 280px;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
  overflow: hidden;
}

.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  font-weight: 600;
  border-bottom: 1px solid var(--app-border);
}

.kanban-column--pending .column-header { border-top: 3px solid #909399; }
.kanban-column--in_progress .column-header { border-top: 3px solid #409eff; }
.kanban-column--review .column-header { border-top: 3px solid #e6a23c; }
.kanban-column--completed .column-header { border-top: 3px solid #67c23a; }

.column-content {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.task-card {
  background: white;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 3px solid transparent;
}

.task-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.task-card--high { border-left-color: #f56c6c; }
.task-card--medium { border-left-color: #e6a23c; }
.task-card--low { border-left-color: #67c23a; }

.task-priority {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  margin-bottom: 8px;
}

.priority--high { background: #fef0f0; color: #f56c6c; }
.priority--medium { background: #fdf6ec; color: #e6a23c; }
.priority--low { background: #f0f9eb; color: #67c23a; }

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.task-chapter {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.task-recommended {
  color: #e6a23c;
}

.task-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
  line-height: 1.4;
}

.task-meta {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.task-focus {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.task-progress {
  margin-top: 8px;
}

.column-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: var(--el-text-color-placeholder);
  gap: 8px;
}

.column-empty .el-icon {
  font-size: 24px;
}

/* 任务详情 */
.task-detail {
  padding: 0 4px;
}

.detail-section {
  margin-bottom: 24px;
}

.detail-section h4 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--el-text-color-primary);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px dashed var(--el-border-color-lighter);
}

.detail-label {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.detail-value {
  font-weight: 500;
}

.focus-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hints-list {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  line-height: 1.8;
  color: var(--el-text-color-regular);
}

.time-estimate {
  background: var(--el-fill-color-lighter);
  padding: 12px;
  border-radius: 8px;
}

.time-main {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-color-primary);
  margin-bottom: 8px;
}

.time-breakdown {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.time-breakdown span {
  margin-right: 8px;
}

.detail-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

/* 推荐弹窗 */
.recommendation-content {
  padding: 8px 0;
}

.recommendation-header {
  margin-bottom: 16px;
}

.recommendation-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  display: block;
  margin-bottom: 4px;
}

.recommendation-chapter {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-color-primary);
}

.recommendation-reason {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.recommendation-reason .el-icon {
  color: var(--el-color-primary);
  margin-top: 2px;
}

.recommendation-blocked {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding: 12px;
  background: #fef0f0;
  border-radius: 8px;
  font-size: 13px;
}

.warning-icon {
  color: #f56c6c;
  font-size: 16px;
  margin-top: 2px;
}

.blocked-title {
  font-weight: 600;
  color: #f56c6c;
  margin-bottom: 4px;
}

.blocked-list {
  margin: 0;
  padding-left: 16px;
  color: var(--el-text-color-regular);
}

.recommendation-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px;
  color: var(--el-color-success);
}

.recommendation-empty .el-icon {
  font-size: 48px;
  margin-bottom: 12px;
}
</style>
