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
        <el-button size="small" @click="generatePlan" :loading="planLoading" :disabled="!events.length">
          <el-icon><Calendar /></el-icon>
          生成计划
        </el-button>
        <el-button size="small" @click="getRecommendation" :disabled="!chapters.length">
          <el-icon><Aim /></el-icon>
          智能推荐
        </el-button>
        <el-divider direction="vertical" />
        <el-button size="small" type="primary" plain @click="handleAddEvent">
          <el-icon><Plus /></el-icon>
          新增事件
        </el-button>
        <el-button size="small" @click="handleExport" :disabled="!chapters.length">
          <el-icon><Download /></el-icon>
          导出计划
        </el-button>
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
        :events="events"
        :layout-direction="graphLayout === 'vertical' ? 'TB' : 'LR'"
        @node-select="handleEventSelect"
      />

      <!-- 看板视图 -->
      <KanbanBoard
        v-else-if="viewMode === 'kanban'"
        :board="kanbanBoard"
        :recommendation="recommendation"
        @task-select="handleTaskSelect"
        @task-move="handleTaskMove"
        @start-writing="handleStartWriting"
        @refresh="loadData"
        @request-recommendation="getRecommendation"
        @add-chapter="handleManualAddChapter"
        @delete-chapter="handleDeleteChapter"
      />

      <!-- 列表视图 (大纲模式) -->
      <div v-else class="h-full overflow-y-auto p-4 max-w-4xl mx-auto">
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
        <el-form-item label="目标章节数">
          <el-input-number v-model="generateOptions.targetChapters" :min="1" :max="1000" />
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

        <div class="mt-6 pt-4 border-t border-[var(--el-border-color-lighter)] flex justify-end">
          <el-button type="danger" plain size="small" :icon="Delete" @click="handleDeleteEvent(selectedEvent.id)">
            删除此事件
          </el-button>
        </div>
      </div>
    </el-drawer>


    <!-- 新增事件对话框 -->
    <el-dialog v-model="showAddEventDialog" title="新增事件节点" width="500px">
      <el-form :model="eventForm" label-width="80px">
        <el-form-item label="事件名称">
          <el-input v-model="eventForm.label" placeholder="如：集市邂逅" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="eventForm.description" type="textarea" placeholder="事件具体发生的过程..." />
        </el-form-item>
        <el-form-item label="事件类型">
          <el-select v-model="eventForm.eventType" style="width: 100%">
            <el-option label="情节 (Plot)" value="plot" />
            <el-option label="冲突 (Conflict)" value="conflict" />
            <el-option label="角色 (Character)" value="character" />
            <el-option label="转折 (Twist)" value="twist" />
          </el-select>
        </el-form-item>
        <el-form-item label="建议章节">
          <el-input-number v-model="eventForm.chapter" :min="1" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddEventDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSaveNewEvent">提交</el-button>
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
        <el-form-item label="目标字数">
          <el-input-number v-model="editChapterForm.targetWords" :step="500" />
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
import { Aim, Calendar, List, MagicStick, Share, Document, Edit, Delete, Download, Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
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
    const savedData = await window.electronAPI?.planning?.loadData(props.novelId)
    if (savedData) {
      events.value = savedData.events || []
      chapters.value = savedData.chapters || []
      kanbanBoard.value = savedData.kanbanBoard || null
      if (savedData.generateOptions) {
        generateOptions.value = savedData.generateOptions
      }
      console.log('已加载规划数据:', {
        events: events.value.length,
        chapters: chapters.value.length
      })
    }
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
  } catch (error) {
    console.error('保存数据失败:', error)
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

// 导出计划
async function handleExport() {
  if (!chapters.value.length) return
  
  try {
    let mdContent = `# ${props.novelTitle || '未命名小说'} - 章节计划\n\n`
    
    chapters.value.forEach(ch => {
      mdContent += `## 第 ${ch.chapterNumber} 章: ${ch.title}\n`
      mdContent += `**重点**: ${ch.focus?.join(', ') || '无'}\n\n`
      
      if (ch.writingHints?.length) {
        mdContent += `### 写作建议\n`
        ch.writingHints.forEach((hint: string) => {
          mdContent += `- ${hint}\n`
        })
        mdContent += '\n'
      }
      
      const chapterEvents = events.value.filter(e => ch.events?.includes(e.id))
      if (chapterEvents.length) {
        mdContent += `### 包含事件\n`
        chapterEvents.forEach(e => {
          mdContent += `- **${e.label}**: ${e.description || '无描述'}\n`
        })
        mdContent += '\n'
      }
      
      mdContent += '---\n\n'
    })
    
    // 这里简单通过 Blob 导出，或者调用原生对话框
    // 既然是 Electron 应用，最好调用主进程保存文件对话框，但这里先实现简单的展示或下载
    const blob = new Blob([mdContent], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${props.novelTitle || 'novel'}_plan.md`
    a.click()
    URL.revokeObjectURL(url)
    
    ElMessage.success('章节计划已导出为 Markdown')
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败')
  }
}

// 新增事件
const showAddEventDialog = ref(false)
const eventForm = ref({
  label: '',
  description: '',
  eventType: 'plot' as 'plot' | 'conflict' | 'character' | 'twist',
  chapter: 1
})

function handleAddEvent() {
  eventForm.value = {
    label: '',
    description: '',
    eventType: 'plot',
    chapter: 1
  }
  showAddEventDialog.value = true
}

async function handleSaveNewEvent() {
  if (!eventForm.value.label.trim()) {
    ElMessage.warning('请输入事件名称')
    return
  }
  
  const newId = `evt_${Date.now()}`
  const newEvent = {
    id: newId,
    label: eventForm.value.label,
    description: eventForm.value.description,
    eventType: eventForm.value.eventType,
    chapter: eventForm.value.chapter,
    characters: []
  }
  
  events.value = [...events.value, newEvent]
  await saveData()
  showAddEventDialog.value = false
  ElMessage.success('已新增事件节点')
}

// 删除事件
async function handleDeleteEvent(eventId: string) {
  try {
    await ElMessageBox.confirm('确定要删除该事件吗？如果在章节计划中已被引用，可能产生影响。', '确认删除', {
      type: 'warning'
    })
    events.value = events.value.filter(e => e.id !== eventId)
    // 同时从章节计划中移除
    chapters.value.forEach(ch => {
      if (ch.events) {
        ch.events = ch.events.filter((id: string) => id !== eventId)
      }
    })
    saveData()
    ElMessage.success('事件已删除')
  } catch { /* 取消 */ }
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
      // 自动保存
      await saveData()
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
    // 序列化事件数据
    const serializedEvents = JSON.parse(JSON.stringify(events.value))
    
    const result = await window.electronAPI?.planning?.generatePlan({
      events: serializedEvents,
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

// 获取推荐
async function getRecommendation() {
  if (chapters.value.length === 0) return

  try {
    // 序列化数据
    const serializedEvents = JSON.parse(JSON.stringify(events.value))
    const serializedChapters = JSON.parse(JSON.stringify(chapters.value))

    const result = await window.electronAPI?.planning?.recommendTask(
      serializedEvents,
      serializedChapters,
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
    
    // 深度绑定：同步状态到数据库章节
    try {
      if (props.novelId && window.electronAPI?.chapter) {
        // 查找对应的章节
        const dbChapters = await window.electronAPI.chapter.list(props.novelId)
        const matchedChapter = dbChapters.find((c: any) => c.chapterNumber === movedTask.chapterNumber)
        
        if (matchedChapter) {
          // 映射状态: pending/in_progress -> writing, completed -> completed
          const dbStatus = targetStatus === 'completed' ? 'completed' : 'writing'
          await window.electronAPI.chapter.update(matchedChapter.id, {
            status: dbStatus
          })
          console.log(`已同步章节 ${movedTask.chapterNumber} 状态至 ${dbStatus}`)
        }
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

// 手动新增章节
async function handleManualAddChapter(chapterData: any) {
  const newChapter = {
    ...chapterData,
    id: `ch_${Date.now()}`,
    eventCount: 0,
    focus: [],
    writingHints: [],
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
  title: '',
  targetWords: 3000
})

function handleEditChapter(chapter: any) {
  editChapterForm.value = {
    id: chapter.id,
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    targetWords: chapter.targetWords || 3000
  }
  showEditChapterDialog.value = true
}

async function handleUpdateChapter() {
  const chIdx = chapters.value.findIndex(c => c.id === editChapterForm.value.id)
  if (chIdx === -1) return
  
  const oldNum = chapters.value[chIdx].chapterNumber
  const newNum = editChapterForm.value.chapterNumber

  // 更新局部数据
  chapters.value[chIdx] = {
    ...chapters.value[chIdx],
    chapterNumber: newNum,
    title: editChapterForm.value.title,
    targetWords: editChapterForm.value.targetWords
  }
  
  // 重新排序
  chapters.value.sort((a, b) => a.chapterNumber - b.chapterNumber)
  
  // 同步到数据库章节（如果存在）
  if (oldNum !== newNum && props.novelId && window.electronAPI?.chapter) {
    try {
      const dbChapters = await window.electronAPI.chapter.list(props.novelId)
      const matched = dbChapters.find((c: any) => c.chapterNumber === oldNum)
      if (matched) {
        await window.electronAPI.chapter.update(matched.id, {
          chapterNumber: newNum,
          title: editChapterForm.value.title // 同时更新标题？
        })
        ElMessage.success(`已同步更新数据库中的第 ${newNum} 章`)
      }
    } catch (error) {
      console.error('数据库同步失败:', error)
    }
  }

  // 重构看板（因为章节号变了，看板需要重新生成以保证逻辑正确，或者手动更新任务）
  // 简单起见，如果看板存在，直接重新生成或刷新
  if (kanbanBoard.value) {
    kanbanBoard.value = await window.electronAPI?.planning?.createKanban(chapters.value)
  }

  saveData()
  showEditChapterDialog.value = false
  ElMessage.success('章节计划已更新')
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


