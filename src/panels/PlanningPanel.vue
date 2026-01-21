<template>
  <div class="h-full flex flex-col bg-[var(--app-bg)]">
    <!-- 工具栏 -->
    <div class="flex justify-between flex-wrap gap-2 items-center px-4 py-3 border-b border-[var(--app-border)] bg-[var(--app-surface-muted)] shrink-0">
      <div class="flex items-center gap-2 w-300px">
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button value="graph">
            <el-icon><Share /></el-icon>
            事件图谱
          </el-radio-button>
          <el-radio-button value="kanban">
            <el-icon><List /></el-icon>
            看板
          </el-radio-button>
          <el-radio-button value="list">
            <el-icon><Document /></el-icon>
            列表
          </el-radio-button>
        </el-radio-group>
      </div>
      <div class="flex items-center gap-2">
        <el-button size="small" @click="generateEventGraph" :loading="generating">
          <el-icon><MagicStick /></el-icon>
          生成图谱
        </el-button>
        <el-button size="small" @click="openGeneratePlanDialog" :loading="planLoading" :disabled="!events.length">
          <el-icon><Calendar /></el-icon>
          生成计划
        </el-button>
        <el-button size="small" @click="getRecommendation" :disabled="!chapters.length">
          <el-icon><Aim /></el-icon>
          智能推荐
        </el-button>
        <el-button size="small" type="primary" plain @click="openAddEventDialog">
          <el-icon><Plus /></el-icon>
          新增事件
        </el-button>
        <el-divider direction="vertical" />
        <el-button size="small" @click="runConsistencyCheck">
          <el-icon><Check /></el-icon>
          一致性检查
        </el-button>
        <el-dropdown @command="handleExportCommand" :disabled="!chapters.length">
          <el-button size="small">
            <el-icon><Download /></el-icon>
            导出
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="markdown">导出 Markdown (文档)</el-dropdown-item>
              <el-dropdown-item command="json">导出 JSON (备份)</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button size="small" type="danger" plain @click="handleClearData">
          <el-icon><Delete /></el-icon>
          清空
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
        :key="graphRefreshKey"
        :events="events"
        :layout-direction="graphLayout === 'vertical' ? 'TB' : 'LR'"
        @node-select="handleEventSelect"
      />

      <!-- 看板视图 -->
      <KanbanBoard
        v-else-if="viewMode === 'kanban'"
        :key="'kanban-' + planRefreshKey"
        :board="kanbanBoard"
        :recommendation="recommendation"
        @task-select="handleTaskSelect"
        @task-move="handleTaskMove"
        @start-writing="handleStartWriting"
        @refresh="loadData"
        @request-recommendation="getRecommendation"
        @add-chapter="handleManualAddChapter"
        @delete-chapter="handleDeleteChapter"
        @toggle-lock="handleToggleLock"
      />

      <!-- 列表视图 (大纲模式) -->
      <div v-else :key="'list-' + planRefreshKey" class="h-full overflow-y-auto p-4 max-w-4xl mx-auto">
        <div v-if="chapters.length === 0" class="flex flex-col items-center justify-center h-full text-[var(--app-text-muted)]">
          <el-empty description="暂无章节计划，请点击上方“生成计划”" />
        </div>
        <div v-else class="space-y-4">
          <div 
            v-for="chapter in chapters" 
            :key="chapter.chapterNumber"
            class="bg-white border border-[var(--app-border)] rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div class="flex justify-between items-start mb-3">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-bold text-lg">第 {{ chapter.chapterNumber }} 章</span>
                  <el-tag size="small" :type="chapter.status === 'completed' ? 'success' : 'info'">
                    {{ chapter.status === 'completed' ? '已完成' : '写作中' }}
                  </el-tag>
                </div>
                <div class="text-[15px] font-medium">{{ chapter.title }}</div>
              </div>
              <div class="flex items-center gap-1">
                <el-tooltip :content="chapter.lockWritingTarget ? '解锁写作目标' : '锁定写作目标'" placement="top">
                  <el-button 
                    :type="chapter.lockWritingTarget ? 'warning' : 'info'" 
                    size="small" 
                    circle 
                    text 
                    @click="handleToggleLock(chapter)"
                  >
                    <el-icon><Lock v-if="chapter.lockWritingTarget" /><Unlock v-else /></el-icon>
                  </el-button>
                </el-tooltip>
                <el-button type="primary" size="small" circle text @click="handleEditChapter(chapter)">
                  <el-icon><Edit /></el-icon>
                </el-button>
                <el-button type="danger" size="small" circle text @click="handleDeleteChapter(chapter.id)">
                  <el-icon><Delete /></el-icon>
                </el-button>
                <el-button type="primary" size="small" plain @click="handleStartWriting(chapter.chapterNumber)">
                  开始写作
                </el-button>
              </div>
            </div>
            
            <div class="text-sm text-[var(--app-text-muted)] leading-relaxed mb-3">
              {{ chapter.summary || chapter.content?.substring(0, 100) || '...' }}
            </div>

            <!-- 包含的事件 -->
            <div v-if="chapter.events?.length" class="mt-3 pt-3 border-t border-dashed border-[var(--app-border)]">
              <div class="text-xs text-[var(--el-text-color-secondary)] mb-2">包含事件</div>
              <div class="flex flex-wrap gap-2">
                <el-tag 
                  v-for="evtId in chapter.events" 
                  :key="evtId" 
                  size="small" 
                  type="info" 
                  effect="light"
                  class="cursor-pointer"
                  @click="handleEventSelect(events.find(e => e.id === evtId))"
                >
                  {{ events.find(e => e.id === evtId)?.label || evtId }}
                </el-tag>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 生成图谱对话框 -->
    <el-dialog v-model="showGenerateDialog" title="生成事件图谱" width="500px">
      <el-form label-width="100px">
        <el-form-item label="追加章节数">
          <el-input-number v-model="eventAppendCount" :min="1" :max="1000" />
          <div class="text-xs text-[var(--el-text-color-secondary)] mt-1">
            在当前章节范围之后追加 {{ eventAppendCount }} 章事件
          </div>
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


    <!-- 生成章节计划对话框 -->
    <el-dialog v-model="showGeneratePlanDialog" title="生成章节计划" width="500px">
      <el-form label-width="90px">
        <el-form-item label="起始章节">
          <el-input-number v-model="planStartChapter" :min="1" />
          <div class="text-xs text-[var(--el-text-color-secondary)] mt-1">
            从第 {{ planStartChapter }} 章开始生成
          </div>
        </el-form-item>
        <el-form-item label="结束章节">
          <el-input-number v-model="planEndChapter" :min="planStartChapter" />
          <div class="text-xs text-[var(--el-text-color-secondary)] mt-1">
            生成到第 {{ planEndChapter }} 章，共 {{ planEndChapter - planStartChapter + 1 }} 章
          </div>
        </el-form-item>
        <div class="ml-[90px] text-xs text-[var(--el-text-color-secondary)]">
          提示：只会为该范围内有事件的章节生成写作提示
        </div>
      </el-form>
      <template #footer>
        <el-button @click="showGeneratePlanDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmGeneratePlan" :loading="planLoading">
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

        <div v-if="selectedEvent.dependencies?.length" class="mb-4">
          <div class="text-xs text-[var(--el-text-color-secondary)] mb-2">依赖事件</div>
          <div class="flex flex-col gap-2">
            <div 
              v-for="depId in selectedEvent.dependencies" 
              :key="depId"
              class="text-sm px-2 py-1.5 bg-[var(--el-fill-color-lighter)] rounded cursor-pointer hover:bg-[var(--el-fill-color-light)]"
              @click="selectEventById(depId)"
            >
              {{ getEventLabelById(depId) }}
            </div>
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

        <div class="mt-6 pt-4 border-t border-[var(--el-border-color-lighter)] flex justify-between">
          <el-button type="primary" plain size="small" :icon="Edit" @click="openEditEventDialog(selectedEvent)">
            编辑事件
          </el-button>
          <el-button type="danger" plain size="small" :icon="Delete" @click="handleDeleteEvent(selectedEvent.id)">
            删除事件
          </el-button>
        </div>
      </div>
    </el-drawer>

    <!-- 事件编辑/新增对话框 -->
    <el-dialog v-model="showEventDialog" :title="isEditingEvent ? '编辑事件' : '新增事件'" width="550px">
      <el-form :model="eventForm" label-width="90px">
        <el-form-item label="事件名称" required>
          <el-input v-model="eventForm.label" placeholder="事件标题" />
        </el-form-item>
        <el-form-item label="事件类型">
          <el-select v-model="eventForm.eventType" placeholder="选择事件类型">
            <el-option label="情节推进" value="plot" />
            <el-option label="角色发展" value="character" />
            <el-option label="冲突事件" value="conflict" />
            <el-option label="解决事件" value="resolution" />
            <el-option label="过渡事件" value="transition" />
          </el-select>
        </el-form-item>
        <el-form-item label="所属章节">
          <el-input-number v-model="eventForm.chapter" :min="1" />
        </el-form-item>
        <el-form-item label="事件描述">
          <el-input v-model="eventForm.description" type="textarea" :rows="3" placeholder="详细描述事件内容" />
        </el-form-item>
        <el-form-item label="相关角色">
          <el-input v-model="eventForm.charactersText" placeholder="多个角色用逗号分隔" />
        </el-form-item>
        <el-form-item label="前置条件">
          <el-input 
            v-model="eventForm.preconditionsText" 
            type="textarea" 
            :rows="2" 
            placeholder="每行一个前置条件"
          />
          <div class="text-xs text-[var(--el-text-color-secondary)] mt-1">
            事件发生前需要满足的条件
          </div>
        </el-form-item>
        <el-form-item label="后置影响">
          <el-input 
            v-model="eventForm.postconditionsText" 
            type="textarea" 
            :rows="2" 
            placeholder="每行一个后置影响"
          />
          <div class="text-xs text-[var(--el-text-color-secondary)] mt-1">
            事件发生后产生的影响
          </div>
        </el-form-item>
        <el-form-item label="依赖事件">
          <el-select 
            v-model="eventForm.dependencies" 
            multiple 
            filterable
            placeholder="选择此事件依赖的前置事件"
            style="width: 100%"
          >
            <el-option
              v-for="event in availableDependencyEvents"
              :key="event.id"
              :label="`${event.label} (第${event.chapter}章)`"
              :value="event.id"
              :disabled="event.id === editingEventId"
            />
          </el-select>
          <div class="text-xs text-[var(--el-text-color-secondary)] mt-1">
            依赖关系将在事件图谱中显示为连接线
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEventDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSaveEvent">保存</el-button>
      </template>
    </el-dialog>


    <!-- 编辑章节对话框 -->
    <el-dialog v-model="showEditChapterDialog" title="编辑章节计划" width="450px">
      <el-form :model="editChapterForm" label-width="80px">
        <el-form-item label="章节号">
          <el-input-number v-model="editChapterForm.chapterNumber" :min="1" />
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="editChapterForm.title" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditChapterDialog = false">取消</el-button>
        <el-button type="primary" @click="handleUpdateChapter">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Aim, Calendar, List, MagicStick, Share, Document, Edit, Delete, Download, Plus, Lock, Unlock, Check, ArrowDown } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus'
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
const viewMode = ref<'graph' | 'kanban' | 'list'>('graph')
const graphLayout = ref<'horizontal' | 'vertical'>('horizontal')

// 数据
const events = ref<any[]>([])
const chapters = ref<any[]>([])
const kanbanBoard = ref<any>(null)
const recommendation = ref<any>(null)
const graphRefreshKey = ref(0)
const planRefreshKey = ref(0)


// 选中状态
const selectedEvent = ref<any>(null)
const showEventDetail = ref(false)

// 加载状态
const generating = ref(false)
const planLoading = ref(false)

// 生成对话框
const showGenerateDialog = ref(false)
const generateOptions = ref({
  targetChapters: 1,
  synopsis: '',
  lockWritingTarget: false
})

const eventGenerationMode = ref<'append' | 'override'>('append')
const eventAppendCount = ref(6)
const eventRangeStart = ref(1)
const eventRangeEnd = ref(6)

// 事件编辑相关
const showEventDialog = ref(false)
const isEditingEvent = ref(false)
const editingEventId = ref<string | null>(null)
const eventForm = ref({
  label: '',
  description: '',
  eventType: 'plot',
  chapter: 1,
  charactersText: '',
  preconditionsText: '',
  postconditionsText: '',
  dependencies: [] as string[]
})

// 可用的依赖事件列表（排除当前编辑的事件）
const availableDependencyEvents = computed(() => {
  return events.value.filter(e => e.id !== editingEventId.value)
})

// 打开新增事件对话框
function openAddEventDialog() {
  isEditingEvent.value = false
  editingEventId.value = null
  eventForm.value = {
    label: '',
    description: '',
    eventType: 'plot',
    chapter: 1,
    charactersText: '',
    preconditionsText: '',
    postconditionsText: '',
    dependencies: []
  }
  showEventDialog.value = true
}

// 打开编辑事件对话框
function openEditEventDialog(event: any) {
  isEditingEvent.value = true
  editingEventId.value = event.id
  eventForm.value = {
    label: event.label || '',
    description: event.description || '',
    eventType: event.eventType || 'plot',
    chapter: event.chapter || 1,
    charactersText: (event.characters || []).join('、'),
    preconditionsText: (event.preconditions || []).join('\n'),
    postconditionsText: (event.postconditions || []).join('\n'),
    dependencies: event.dependencies || []
  }
  showEventDetail.value = false
  showEventDialog.value = true
}

// 保存事件（新增或更新）
async function handleSaveEvent() {
  if (!eventForm.value.label.trim()) {
    ElMessage.warning('请输入事件名称')
    return
  }
  
  const characters = eventForm.value.charactersText
    .split(/[,，、]/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
  
  const preconditions = eventForm.value.preconditionsText
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0)
  
  const postconditions = eventForm.value.postconditionsText
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0)
  
  let eventId: string
  let eventChapter: number
  
  if (isEditingEvent.value && editingEventId.value) {
    // 更新现有事件
    const idx = events.value.findIndex(e => e.id === editingEventId.value)
    if (idx !== -1) {
      const oldChapter = events.value[idx].chapter
      events.value[idx] = {
        ...events.value[idx],
        label: eventForm.value.label,
        description: eventForm.value.description,
        eventType: eventForm.value.eventType,
        chapter: eventForm.value.chapter,
        characters,
        preconditions,
        postconditions,
        dependencies: eventForm.value.dependencies
      }
      eventId = editingEventId.value
      eventChapter = eventForm.value.chapter
      
      // 如果章节号改变了，需要从旧章节中移除，添加到新章节
      if (oldChapter !== eventChapter) {
        // 从旧章节移除
        const oldChapterObj = chapters.value.find(ch => Number(ch.chapterNumber) === oldChapter)
        if (oldChapterObj && oldChapterObj.events) {
          oldChapterObj.events = oldChapterObj.events.filter((id: string) => id !== eventId)
        }
      }
      
      ElMessage.success('事件已更新')
    } else {
      return
    }
  } else {
    // 新增事件
    const newEvent = {
      id: `event_manual_${Date.now()}`,
      label: eventForm.value.label,
      description: eventForm.value.description,
      eventType: eventForm.value.eventType,
      chapter: eventForm.value.chapter,
      characters,
      preconditions,
      postconditions,
      dependencies: eventForm.value.dependencies
    }
    events.value.push(newEvent)
    eventId = newEvent.id
    eventChapter = newEvent.chapter
    ElMessage.success('事件已添加')
  }
  
  // 同步事件到对应章节的 events 列表
  const targetChapter = chapters.value.find(ch => Number(ch.chapterNumber) === eventChapter)
  if (targetChapter) {
    if (!targetChapter.events) {
      targetChapter.events = []
    }
    if (!targetChapter.events.includes(eventId)) {
      targetChapter.events.push(eventId)
    }
  }
  
  graphRefreshKey.value += 1
  planRefreshKey.value += 1
  showEventDialog.value = false
  await saveData()
}

watch(
  () => props.novelId,
  (value) => {
    if (value) {
      loadData()
    }
  },
  { immediate: true }
)

watch(
  () => generateOptions.value,
  () => {
    if (props.novelId) {
      saveData()
    }
  },
  { deep: true }
)

// 监听生成参数变化，保持逻辑一致性
watch(
  [() => eventRangeStart.value, () => eventRangeEnd.value, () => eventGenerationMode.value],
  ([start, end, mode]) => {
    if (mode === 'override') {
      // 验证结束章节不能小于起始章节
      if (end < start) {
        eventRangeEnd.value = start
        return
      }
      // 自动计算目标章节数
      const count = end - start + 1
      if (generateOptions.value.targetChapters !== count) {
        generateOptions.value.targetChapters = count
      }
    } else if (mode === 'append') {
      // 在追加模式下，目标章节数应与追加数量一致
      if (generateOptions.value.targetChapters !== eventAppendCount.value) {
        generateOptions.value.targetChapters = eventAppendCount.value
      }
    }
  }
)

watch(
  () => eventAppendCount.value,
  (val) => {
    if (eventGenerationMode.value === 'append') {
      if (generateOptions.value.targetChapters !== val) {
        generateOptions.value.targetChapters = val
      }
    }
  }
)

watch(
  () => generateOptions.value.targetChapters,
  (val) => {
    const count = Math.max(val || 1, 1)
    if (eventGenerationMode.value === 'override') {
      // 根据目标章节数更新结束章节
      const newEnd = eventRangeStart.value + count - 1
      if (eventRangeEnd.value !== newEnd) {
        eventRangeEnd.value = newEnd
      }
    } else if (eventGenerationMode.value === 'append') {
      // 同步追加数量
      if (eventAppendCount.value !== count) {
        eventAppendCount.value = count
      }
    }
  }
)


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

async function syncPlanWithEvents() {
  const eventIds = new Set(events.value.map(event => event.id))
  chapters.value = chapters.value.map(chapter => {
    const chapterEvents = Array.isArray(chapter.events)
      ? chapter.events.filter((id: string) => eventIds.has(id))
      : []
    return {
      ...chapter,
      events: chapterEvents
    }
  })

  if (kanbanBoard.value) {
    const serializedChapters = JSON.parse(JSON.stringify(chapters.value))
    const board = await window.electronAPI?.planning?.createKanban(serializedChapters)
    if (board) {
      kanbanBoard.value = board
      planRefreshKey.value += 1
    }
  }
}

async function handleDeleteEvent(eventId: string) {
  events.value = events.value.filter(e => e.id !== eventId)
  graphRefreshKey.value += 1
  planRefreshKey.value += 1
  await syncPlanWithEvents()
  saveData()
  showEventDetail.value = false
  ElMessage.success('事件已删除')
}


// 加载数据
async function loadData() {
  if (!props.novelId) return
  
  try {
    const savedData = await window.electronAPI?.planning?.loadData(props.novelId)
    if (savedData) {
      events.value = savedData.events || []
      chapters.value = savedData.chapters || []
      kanbanBoard.value = savedData.kanbanBoard || null
      if (savedData.generateOptions) {
        generateOptions.value = savedData.generateOptions
      }
    } else {
      events.value = []
      chapters.value = []
      kanbanBoard.value = null
    }

    if (!kanbanBoard.value && chapters.value.length) {
      kanbanBoard.value = await window.electronAPI?.planning?.createKanban(chapters.value)
    }

    console.log('已加载规划数据:', {  
      events: events.value.length,
      chapters: chapters.value.length
    })
  } catch (error) {
    console.error('加载数据失败:', error)
  }
}


// 保存数据
async function saveData() {
  if (!props.novelId) return
  
  try {
    // 使用 JSON 序列化确保数据可以通过 IPC 传输
    const dataToSave = JSON.parse(JSON.stringify({
      events: events.value,
      chapters: chapters.value,
      kanbanBoard: kanbanBoard.value,
      generateOptions: generateOptions.value
    }))
    
    await window.electronAPI?.planning?.saveData(props.novelId, dataToSave)
    console.log('规划数据已保存')
  } catch (error: any) {
    const message = error?.message || '保存数据失败'
    console.error('保存数据失败:', error)
    ElMessage.error(message)
    await loadData()
  }
}


// 清空数据
async function handleClearData() {
  if (!props.novelId) return
  
  try {
    await ElMessageBox.confirm(
      '确定要清空当前的事件图谱和章节计划吗？此操作不可撤销。',
      '确认清空',
      {
        confirmButtonText: '确定清空',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await window.electronAPI?.planning?.clearData(props.novelId)
    events.value = []
    chapters.value = []
    kanbanBoard.value = null
    ElMessage.success('规划数据已清空')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('清空数据失败:', error)
      ElMessage.error('清空数据失败')
    }
  }
}


// 智能推荐
async function getRecommendation() {
  if (!props.novelId || chapters.value.length === 0) {
    ElMessage.warning('请先生成章节于事件数据')
    return
  }
  
  try {
    const serializedEvents = JSON.parse(JSON.stringify(events.value))
    const serializedChapters = JSON.parse(JSON.stringify(chapters.value))
    
    // 显示加载中
    const loadingInstance = ElLoading.service({
      target: '.planning-panel',
      text: '正在智能分析剧情走向...'
    })

    const result = await window.electronAPI?.planning?.recommendTask({
      novelId: props.novelId,
      events: serializedEvents,
      chapters: serializedChapters
    })
    
    loadingInstance.close()
    
    if (!result) {
      ElMessage.info('暂时没有推荐的任务，请先完成现有章节或添加更多事件')
      return
    }
    
    const { chapter, reason, blockedBy } = result
    
    // 构建提示内容
    const title = `推荐任务：第 ${chapter.chapterNumber} 章 ${chapter.title || '未命名'}`
    let message = `<div style="text-align: left;">`
    
    if (reason && reason.length > 0) {
      message += `<p><strong>推荐理由：</strong></p><ul>`
      reason.forEach((r: string) => message += `<li>${r}</li>`)
      message += `</ul>`
    }
    
    if (blockedBy && blockedBy.length > 0) {
      message += `<p style="color: var(--el-color-warning); margin-top: 10px;"><strong>阻碍因素：</strong></p>`
      message += `<p>以下依赖事件尚未完成，建议先处理：</p><ul>`
      blockedBy.forEach((dep: any) => {
        message += `<li>${dep.label || dep.id} (第 ${dep.chapter} 章)</li>`
      })
      message += `</ul>`
    }
    
    message += `</div>`
    
    ElMessageBox.alert(message, title, {
      dangerouslyUseHTMLString: true,
      confirmButtonText: '收到',
      customClass: 'recommendation-dialog'
    })
    
  } catch (error) {
    console.error('获取推荐失败:', error)
    ElMessage.error('获取智能推荐失败')
  }
}

// 一致性检查
async function runConsistencyCheck() {
  if (!props.novelId) return
  const errors: string[] = []
  const warnings: string[] = []

  // 1. 章节号检查
  const chapterNumbers = chapters.value
    .map(ch => Number(ch.chapterNumber))
    .filter(Number.isFinite)

  const numberSet = new Set(chapterNumbers)
  if (numberSet.size !== chapterNumbers.length) {
    errors.push('存在重复的章节号，请检查章节列表')
  }

  // 2. 事件关联章节检查
  const invalidEvents = events.value.filter(event => {
    if (event.chapter == null) return false
    return !numberSet.has(Number(event.chapter))
  })

  if (invalidEvents.length) {
    const labels = invalidEvents
      .slice(0, 3)
      .map(event => event.label || event.id)
      .join('、')
    errors.push(`${invalidEvents.length} 个事件关联了不存在的章节: ${labels}...`)
  }

  // 构建事件映射以便后续检查
  const eventMap = new Map(events.value.map(e => [e.id, e]))

  // 3. 依赖关系检查
  events.value.forEach(event => {
    if (event.dependencies && event.dependencies.length) {
      event.dependencies.forEach((depId: string) => {
        const depEvent = eventMap.get(depId)
        
        // 3.1 无效依赖
        if (!depEvent) {
          warnings.push(`事件 "${event.label}" 依赖了不存在的事件 (${depId})`)
          return
        }

        // 3.2 时序倒置 (依赖了未来的事件)
        if (event.chapter && depEvent.chapter && event.chapter < depEvent.chapter) {
          warnings.push(`时序异常: 第${event.chapter}章的 "${event.label}" 依赖了第${depEvent.chapter}章的 "${depEvent.label}"`)
        }
      })
    }
  })

  // 4. 循环依赖检查 (DFS)
  const visited = new Set()
  const recursionStack = new Set()
  let hasCycle = false

  function checkCycle(eventId: string) {
    if (recursionStack.has(eventId)) return true // 发现循环
    if (visited.has(eventId)) return false
    
    visited.add(eventId)
    recursionStack.add(eventId)
    
    const event = eventMap.get(eventId)
    if (event && event.dependencies) {
      for (const depId of event.dependencies) {
        if (checkCycle(depId)) {
          // 仅报告一次循环
          if (!hasCycle) {
            errors.push(`检测到循环依赖: 相关事件包含 "${event.label || eventId}"`)
            hasCycle = true
          }
          return true
        }
      }
    }
    
    recursionStack.delete(eventId)
    return false
  }

  for (const event of events.value) {
    if (checkCycle(event.id)) break
  }

  // 结果汇报
  if (errors.length > 0) {
    // 严重错误
    ElMessageBox.alert(
      `<div style="color: var(--el-color-danger)">${errors.map(e => `<p>• ${e}</p>`).join('')}</div>` +
      (warnings.length ? `<hr><div style="color: var(--el-color-warning)">${warnings.slice(0, 5).map(e => `<p>• ${e}</p>`).join('')}</div>` : ''),
      '一致性检查未通过',
      { dangerouslyUseHTMLString: true, title: '发现严重问题' }
    )
    return
  }

  if (warnings.length > 0) {
    // 仅有警告
    ElMessageBox.alert(
      `<div style="color: var(--el-color-warning)">${warnings.slice(0, 8).map(e => `<p>• ${e}</p>`).join('')}${warnings.length > 8 ? '<p>...</p>' : ''}</div>`,
      '发现潜在问题',
      { dangerouslyUseHTMLString: true, title: '一致性检查建议' }
    )
    // 即使有警告，也保存数据
  } else {
    ElMessage.success('一致性检查通过，数据结构正常')
  }

  // 无论是否有警告，只要没有严重错误，都尝试保存一次以确保元数据一致
  if (!props.novelId) return
  try {
    const dataToSave = JSON.parse(JSON.stringify({
      events: events.value,
      chapters: chapters.value,
      kanbanBoard: kanbanBoard.value,
      generateOptions: generateOptions.value
    }))
    await window.electronAPI?.planning?.saveData(props.novelId, dataToSave)
  } catch (error: any) {
    console.error('保存失败:', error)
  }
}

// 导出计划
async function handleExportCommand(command: string | undefined) {
  if (!chapters.value.length && !events.value.length) return
  const type = command || 'markdown'
  
  try {
    let content = ''
    let title = `${props.novelTitle || 'novel'}_plan`
    
    if (type === 'json') {
      content = JSON.stringify({
        meta: generateOptions.value,
        events: events.value,
        chapters: chapters.value,
        kanbanBoard: kanbanBoard.value,
        exportedAt: new Date().toISOString()
      }, null, 2)
      title = `${props.novelTitle || 'novel'}_backup`
    } else {
      // Markdown generation
      content = `# ${props.novelTitle || '未命名小说'} - 章节计划\n\n`
      chapters.value.forEach(ch => {
        content += `## 第 ${ch.chapterNumber} 章: ${ch.title}\n`
        content += `**重点**: ${ch.focus?.join(', ') || '无'}\n\n`
        
        if (ch.writingHints?.length) {
          content += `### 写作建议\n`
          ch.writingHints.forEach((hint: string) => {
            content += `- ${hint}\n`
          })
          content += '\n'
        }
        
        const chapterEvents = events.value.filter(e => ch.events?.includes(e.id))
        if (chapterEvents.length) {
          content += `### 包含事件\n`
          chapterEvents.forEach(e => {
            content += `- **${e.label}**: ${e.description || '无描述'}\n`
          })
          content += '\n'
        }
        
        content += '---\n\n'
      })
    }
    
    // 既然是 Electron 应用，调用主进程保存文件对话框
    if (window.electronAPI?.planning?.export) {
      const result = await window.electronAPI.planning.export({
        title,
        content,
        type
      })
      
      if (result?.success) {
        ElMessage.success(`导出成功: ${result.filePath}`)
      }
    } else {
       // 降级回退：浏览器下载
      const blob = new Blob([content], { type: type === 'json' ? 'application/json' : 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title}.${type === 'json' ? 'json' : 'md'}`
      a.click()
      URL.revokeObjectURL(url)
      ElMessage.success(`已导出为 ${type === 'json' ? 'JSON' : 'Markdown'}`)
    }
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败')
  }
}


// 生成事件图谱
function getMaxChapterNumber() {
  const eventMax = events.value.reduce((max, event) => {
    const chapter = Number(event.chapter)
    return Number.isFinite(chapter) ? Math.max(max, chapter) : max
  }, 0)
  const planMax = chapters.value.reduce((max, chapter) => {
    const chapterNumber = Number(chapter.chapterNumber)
    return Number.isFinite(chapterNumber) ? Math.max(max, chapterNumber) : max
  }, 0)
  return Math.max(eventMax, planMax)
}

function generateEventGraph() {
  const maxChapterNumber = getMaxChapterNumber()

  eventGenerationMode.value = 'append'
  eventAppendCount.value = 5
  eventRangeStart.value = 1
  eventRangeEnd.value = maxChapterNumber || Math.max(generateOptions.value.targetChapters || 1, 1)

  showGenerateDialog.value = true
}


async function doGenerateGraph() {
  if (!props.novelId) {
    ElMessage.warning('请先选择小说')
    return
  }

  generating.value = true
  try {
    const maxChapterNumber = getMaxChapterNumber()
    const targetChapters = eventAppendCount.value

    // 追加模式：从当前最大章节号后开始
    const startChapter = maxChapterNumber + 1
    const endChapter = startChapter + targetChapters - 1

    const existingEvents = JSON.parse(JSON.stringify(events.value))
    const result = await window.electronAPI?.planning?.generateEventGraph({
      novelTitle: props.novelTitle || '未命名小说',
      synopsis: generateOptions.value.synopsis,
      targetChapters,
      startChapter,
      endChapter,
      mergeEvents: true,
      existingEvents,
      overrideRange: false
    })

    if (result?.events) {
      console.log('[doGenerateGraph] 生成前事件数量:', events.value.length)
      console.log('[doGenerateGraph] 后端返回事件数量:', result.events.length)
      
      events.value = result.events
      
      console.log('[doGenerateGraph] 更新后事件数量:', events.value.length)
      console.log('[doGenerateGraph] 事件列表:', events.value.map(e => ({ id: e.id, label: e.label, chapter: e.chapter })))

      // 将事件 ID 同步到已有章节的 events 列表（不自动创建新章节）
      const evtMap = new Map<number, string[]>()
      events.value.forEach((e: any) => {
        const c = Number(e.chapter)
        if (Number.isFinite(c)) {
            if (!evtMap.has(c)) evtMap.set(c, [])
            evtMap.get(c)?.push(e.id)
        }
      })
      
      // 只更新已存在章节的事件列表
      if (chapters.value.length > 0) {
        chapters.value = chapters.value.map(ch => {
          const chNum = Number(ch.chapterNumber)
          if (evtMap.has(chNum)) {
              const newIds = evtMap.get(chNum) || []
              const existing = ch.events || []
              return {
                  ...ch,
                  events: Array.from(new Set([...existing, ...newIds]))
              }
          }
          return ch
        })
        await syncPlanWithEvents()
      }

      graphRefreshKey.value += 1
      planRefreshKey.value += 1
      
      // 提示用户下一步操作
      const hasChapters = chapters.value.length > 0
      const message = hasChapters 
        ? `成功生成 ${result.events.length} 个事件节点，已同步到现有章节`
        : `成功生成 ${result.events.length} 个事件节点，请点击"生成计划"创建章节`
      ElMessage.success(message)
      
      showGenerateDialog.value = false
      // 自动保存
      await saveData()
    }
  } catch (error: any) {
    ElMessage.error('生成图谱失败: ' + (error.message || '未知错误'))
  } finally {
    generating.value = false
  }
}

// 生成计划配置
const showGeneratePlanDialog = ref(false)
const planStartChapter = ref(1)
const planEndChapter = ref(10)

function openGeneratePlanDialog() {
  if (events.value.length === 0) {
    ElMessage.warning('请先生成事件图谱')
    return
  }
  
  // 从事件中提取章节号范围
  const eventChapters = events.value
    .map(e => Number(e.chapter))
    .filter(n => Number.isFinite(n))
  const minEventChapter = eventChapters.length > 0 ? Math.min(...eventChapters) : 1
  const maxEventChapter = eventChapters.length > 0 ? Math.max(...eventChapters) : 10
  
  // 获取当前已有章节的最大章节号
  const existingChapterNumbers = chapters.value.map(ch => Number(ch.chapterNumber)).filter(Number.isFinite)
  const maxExistingChapter = existingChapterNumbers.length > 0 ? Math.max(...existingChapterNumbers) : 0
  
  // 设置默认值：起始章节为当前最大章节+1，结束章节为事件的最大章节号
  planStartChapter.value = maxExistingChapter + 1
  planEndChapter.value = Math.max(maxEventChapter, maxExistingChapter + 5)
  
  showGeneratePlanDialog.value = true
}

async function confirmGeneratePlan() {
  showGeneratePlanDialog.value = false
  await generatePlan()
}

// 生成章节计划
async function generatePlan() {
  if (events.value.length === 0) {
    ElMessage.warning('请先生成事件图谱')
    return
  }

  planLoading.value = true
  try {
    // 序列化事件数据
    const serializedEvents = JSON.parse(JSON.stringify(events.value))
    
    // 使用起始章节和结束章节
    const startChapter = planStartChapter.value
    const endChapter = planEndChapter.value
    const targetChapters = endChapter - startChapter + 1
    
    // 在生成前，先移除范围内已有的章节计划
    // 这样可以让 LLM 重新审视整个范围，生成更连贯的计划
    const chaptersToRemove = chapters.value.filter(ch => {
      const chNum = Number(ch.chapterNumber)
      return chNum >= startChapter && chNum <= endChapter
    })
    
    if (chaptersToRemove.length > 0) {
      console.log(`[generatePlan] 将移除 ${chaptersToRemove.length} 个已有章节计划，重新生成`)
      chapters.value = chapters.value.filter(ch => {
        const chNum = Number(ch.chapterNumber)
        return chNum < startChapter || chNum > endChapter
      })
    }
    
    // 构建请求参数
    const params: any = {
      events: serializedEvents,
      wordsPerChapter: 1500,
      startChapter,
      endChapter,
      targetChapters
    }
    
    const result = await window.electronAPI?.planning?.generatePlan(params)

    if (result?.chapters) {
      const nextChapters = result.chapters.map((chapter: any) => ({
        ...chapter,
        id: chapter.id || `ch_plan_${Date.now()}_${chapter.chapterNumber}`,
        lockWritingTarget: generateOptions.value.lockWritingTarget
      }))

      // 添加新生成的章节并排序
      chapters.value = [...chapters.value, ...nextChapters].sort((a, b) => a.chapterNumber - b.chapterNumber)
      
      // 同步事件ID到章节（确保章节的events列表正确）
      const evtMap = new Map<number, string[]>()
      events.value.forEach((e: any) => {
        const c = Number(e.chapter)
        if (Number.isFinite(c)) {
          if (!evtMap.has(c)) evtMap.set(c, [])
          evtMap.get(c)?.push(e.id)
        }
      })
      
      chapters.value = chapters.value.map(ch => {
        const chNum = Number(ch.chapterNumber)
        if (evtMap.has(chNum)) {
          return {
            ...ch,
            events: evtMap.get(chNum) || []
          }
        }
        return ch
      })
      
      // 创建看板
      const serializedChapters = JSON.parse(JSON.stringify(chapters.value))
      const board = await window.electronAPI?.planning?.createKanban(serializedChapters)
      if (board) {
        kanbanBoard.value = board
        planRefreshKey.value += 1
        viewMode.value = 'kanban'
        ElMessage.success(`章节计划生成完成，共 ${nextChapters.length} 章`)
        // 自动保存
        await saveData()
      }
    }
  } catch (error: any) {
    console.error('生成计划失败:', error)
    ElMessage.error('生成计划失败: ' + (error.message || '未知错误'))
  } finally {
    planLoading.value = false
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

async function handleTaskMove(taskId: string, targetStatus: string) {
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
    
    // 深度绑定：同步状态到规划（主进程投影到章节）
    try {
      if (props.novelId && window.electronAPI?.planning?.updateChapterStatus) {
        await window.electronAPI.planning.updateChapterStatus(props.novelId, movedTask.chapterNumber, targetStatus)
        console.log(`已同步章节 ${movedTask.chapterNumber} 状态至规划: ${targetStatus}`)
        ElMessage.success(`已同步章节 ${movedTask.chapterNumber} 状态: ${targetStatus === 'completed' ? '已完成' : '写作中'}`)
      }
    } catch (error) {
      console.error('状态同步失败:', error)
    }


    // 更新 chapters 列表中的状态
    const chapterIdx = chapters.value.findIndex(ch => ch.chapterNumber === movedTask.chapterNumber)
    if (chapterIdx !== -1) {
      chapters.value[chapterIdx].status = targetStatus
    }

    // 自动保存看板状态
    saveData()
  }
}

// 锁定/解锁章节目标
async function handleToggleLock(chapter: any) {
  if (!props.novelId) return
  
  const newLockState = !chapter.lockWritingTarget
  
  // 乐观更新
  chapter.lockWritingTarget = newLockState
  
  // 同步到看板
  if (kanbanBoard.value?.columns) {
    kanbanBoard.value.columns.forEach((col: any) => {
      const task = col.tasks.find((t: any) => t.chapterNumber === chapter.chapterNumber)
      if (task) {
        task.lockWritingTarget = newLockState
      }
    })
  }

  try {
    if (window.electronAPI?.planning?.updateChapterStatus) {
      await window.electronAPI.planning.updateChapterStatus(
        props.novelId, 
        chapter.chapterNumber, 
        chapter.status, 
        { lockWritingTarget: newLockState }
      )
      ElMessage.success(newLockState ? '已锁定写作目标' : '已解锁写作目标')
      await saveData()
    }
  } catch (error) {
    // 失败回滚
    chapter.lockWritingTarget = !newLockState
    // 回滚看板
    if (kanbanBoard.value?.columns) {
      kanbanBoard.value.columns.forEach((col: any) => {
        const task = col.tasks.find((t: any) => t.chapterNumber === chapter.chapterNumber)
        if (task) {
          task.lockWritingTarget = !newLockState
        }
      })
    }
    console.error('更新锁定状态失败:', error)
    ElMessage.error('操作失败')
  }
}

// 手动新增章节
async function handleManualAddChapter(chapterData: any) {
  const newChapter = {
    ...chapterData,
    id: `ch_${Date.now()}`,
    eventCount: 0,
    focus: [],
    writingHints: [],
    lockWritingTarget: generateOptions.value.lockWritingTarget,
    progress: 0
  }
  
  // 更新列表
  chapters.value = [...chapters.value, newChapter].sort((a, b) => a.chapterNumber - b.chapterNumber)
  
  // 更新看板
  if (!kanbanBoard.value) {
    kanbanBoard.value = await window.electronAPI?.planning?.createKanban(chapters.value)
  } else {
    const targetCol = kanbanBoard.value.columns.find((c: any) => c.id === chapterData.status)
    if (targetCol) {
      targetCol.tasks.push(newChapter)
    }
  }
  
  saveData()
}

// 根据事件ID获取事件标签
function getEventLabelById(eventId: string): string {
  const event = events.value.find(e => e.id === eventId)
  return event ? `${event.label} (第${event.chapter}章)` : '未知事件'
}

// 根据ID选中事件
function selectEventById(eventId: string) {
  const event = events.value.find(e => e.id === eventId)
  if (event) {
    selectedEvent.value = event
    showEventDetail.value = true
  }
}



// 删除章节
async function handleDeleteChapter(chapterId: string) {
  try {
    const chapter = chapters.value.find(c => c.id === chapterId)
    if (!chapter) return
    
    await ElMessageBox.confirm(`确定要删除第 ${chapter.chapterNumber} 章的规划吗？此操作不会删除数据库中的实际代码/内容，仅移除规划任务。`, '确认删除', {
      type: 'warning'
    })
    
    // 从列表中移除
    chapters.value = chapters.value.filter(c => c.id !== chapterId)
    
    // 从看板中移除
    if (kanbanBoard.value?.columns) {
      kanbanBoard.value.columns.forEach((col: any) => {
        col.tasks = col.tasks.filter((t: any) => t.id !== chapterId)
      })
    }
    
    saveData()
    ElMessage.success('章节计划已移除')
  } catch { /* 取消 */ }
}

// 编辑章节
const showEditChapterDialog = ref(false)
const editChapterForm = ref({
  id: '',
  chapterNumber: 1,
  title: ''
})

function handleEditChapter(chapter: any) {
  editChapterForm.value = {
    id: chapter.id,
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
  }
  showEditChapterDialog.value = true
}

async function handleUpdateChapter() {
  const chIdx = chapters.value.findIndex(c => c.id === editChapterForm.value.id)
  if (chIdx === -1) return
  
  const oldNum = chapters.value[chIdx].chapterNumber
  const newNum = editChapterForm.value.chapterNumber

    if (props.novelId && oldNum !== newNum && window.electronAPI?.planning?.updateChapterNumber) {
      try {
        await window.electronAPI.planning.updateChapterNumber(props.novelId, oldNum, newNum)
      } catch (error: any) {
        ElMessage.error(error.message || '章节号更新失败')
        await loadData()
        return
      }
    }


  // 更新局部数据
  chapters.value[chIdx] = {
    ...chapters.value[chIdx],
    chapterNumber: newNum,
    title: editChapterForm.value.title,
  }
  
  // 重新排序
  chapters.value.sort((a, b) => a.chapterNumber - b.chapterNumber)

  if (props.novelId && window.electronAPI?.planning?.updateChapter) {
    await window.electronAPI.planning.updateChapter(props.novelId, newNum, {
      title: editChapterForm.value.title
    })
  }

  await syncPlanWithEvents()

  // 重构看板（因为章节号变了，看板需要重新生成以保证逻辑正确，或者手动更新任务）
  // 简单起见，如果看板存在，直接重新生成或刷新
  if (kanbanBoard.value) {
    kanbanBoard.value = await window.electronAPI?.planning?.createKanban(chapters.value)
  }

  await saveData()
  showEditChapterDialog.value = false
  ElMessage.success('章节计划已更新')
}


// 开始写作
async function handleStartWriting(chapterNumber: number) {
  if (!props.novelId) return

  const plan = chapters.value.find(c => c.chapterNumber === chapterNumber)
  if (!plan) {
    ElMessage.warning('章节计划不存在')
    return
  }

  try {
    // 1. 检查章节是否已存在
    const existingChapter = await window.electronAPI?.chapter?.getByNumber(props.novelId, chapterNumber)
    
    let chapterId: string
    
    if (existingChapter) {
      // 2. 章节已存在，直接使用
      chapterId = existingChapter.id
      console.log(`章节 ${chapterNumber} 已存在，ID: ${chapterId}`)
    } else {
      // 3. 章节不存在，创建新章节
      if (!window.electronAPI?.planning?.ensureChapter) {
        ElMessage.error('无法创建章节')
        return
      }
      
      const newChapter = await window.electronAPI.planning.ensureChapter(props.novelId, {
        chapterNumber
      })
      
      if (!newChapter?.id) {
        ElMessage.error('创建章节失败')
        return
      }
      
      chapterId = newChapter.id
      console.log(`已创建章节 ${chapterNumber}，ID: ${chapterId}`)
      ElMessage.success(`已创建第 ${chapterNumber} 章`)
    }
    
    // 4. 发送事件到父组件，让父组件切换标签页并选中章节
    emit('start-writing', chapterId)
  } catch (error: any) {
    console.error('开始写作操作失败:', error)
    ElMessage.error('操作失败: ' + (error.message || '未知错误'))
  }
}

// 监听 novelId 变化
watch(() => props.novelId, () => {
  loadData()
}, { immediate: true })

onMounted(() => {
  loadData()
})
</script>


