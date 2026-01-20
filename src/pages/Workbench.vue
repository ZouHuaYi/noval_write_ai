<template>
  <div class="h-screen flex flex-col bg-[radial-gradient(circle_at_top,rgba(243,236,224,0.6),transparent_55%),var(--app-bg)] text-[var(--app-text)]">

    <!-- 顶部导航栏 -->
    <div class="h-14 bg-[var(--app-surface)] border-b border-[var(--app-border)] shadow-[0_6px_18px_rgba(32,30,25,0.06)] flex items-center justify-between px-6 flex-shrink-0 z-10">

      <div class="flex items-center space-x-3">
        <el-button 
          text 
          @click="goBack"
          class="flex items-center hover:bg-[var(--app-surface-muted)] rounded-lg px-2 py-1"
        >
          <el-icon class="mr-1 text-[var(--app-text-muted)]"><ArrowLeft /></el-icon>
          <span class="text-sm text-[var(--app-text-muted)]">返回</span>
        </el-button>
        <el-divider direction="vertical" class="h-6" />
        <div v-if="novel" class="flex flex-col">
          <span class="text-xs text-[var(--app-text-muted)]">当前小说</span>
          <span class="text-[1.05rem] font-600 tracking-wide">{{ novel?.title }}</span>
        </div>
        <div v-else class="text-[var(--app-text-muted)] text-sm">加载中...</div>

      </div>
      <div class="flex items-center space-x-2">
        <el-tag size="large" type="info" effect="plain" class="rounded-full font-600 tracking-wide px-3 py-1.5 shadow-sm">
          {{ activeTabLabel }}
        </el-tag>
        <el-tag v-if="currentChapter" size="large" type="primary" effect="plain" class="rounded-full font-600 tracking-wide px-3 py-1.5 shadow-sm">
          {{ currentChapter.title }}
        </el-tag>
        <el-tag v-else size="large" type="info" effect="plain" class="rounded-full font-600 tracking-wide px-3 py-1.5 shadow-sm">
          未选择章节
        </el-tag>
        <el-button text @click="goToNovels">小说列表</el-button>
        <el-button text @click="goToSettings">设置</el-button>
      </div>

    </div>

    <!-- 工作台内容 -->
    <WorkbenchLayout :show-right="leftTab === 'chapters'" class="flex-1 overflow-hidden">
      <template #left>
        <div class="h-full flex flex-col">
          <div class="relative flex-shrink-0 px-4 py-3 border-b border-[var(--app-border)] bg-[var(--app-surface-muted)] rounded-t-[var(--app-radius)]">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm font-semibold">工作区</div>
                <div class="text-xs text-[var(--app-text-muted)]">资料导航</div>
              </div>
              <div 
                class="cursor-pointer text-gray-400 hover:text-gray-600 transition-colors p-1"
                @click="toggleLeftPanel"
              >
                <el-icon :class="{ 'rotate-180': !isLeftPanelOpen }" class="transition-transform duration-300">
                  <ArrowUp />
                </el-icon>
              </div>
            </div>
          </div>
          <el-collapse-transition>
            <div v-show="isLeftPanelOpen" class="flex-shrink-0 px-4 py-3">
              <div class="flex flex-col gap-2">
                <button
                  type="button"
                  class="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl border border-transparent bg-transparent text-[var(--app-text)] cursor-pointer transition-all hover:bg-[var(--app-surface-muted)] hover:border-[var(--app-border)]"
                  :class="leftTab === 'chapters' ? 'bg-[var(--app-primary-soft)] border-[rgba(79,138,118,0.4)] shadow-[0_10px_22px_rgba(79,138,118,0.18)]' : ''"
                  @click="leftTab = 'chapters'"
                >
                  <span class="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center bg-[var(--app-surface-strong)] text-[var(--app-primary)]" :class="leftTab === 'chapters' ? 'bg-[rgba(79,138,118,0.18)]' : ''">
                    <el-icon><Document /></el-icon>
                  </span>
                  <span>
                    <div class="text-sm font-semibold">章节</div>
                    <div class="text-xs text-[var(--app-text-muted)]">章节管理与顺序</div>
                  </span>
                </button>
                <button
                  type="button"
                  class="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl border border-transparent bg-transparent text-[var(--app-text)] cursor-pointer transition-all hover:bg-[var(--app-surface-muted)] hover:border-[var(--app-border)]"
                  :class="leftTab === 'planning' ? 'bg-[var(--app-primary-soft)] border-[rgba(79,138,118,0.4)] shadow-[0_10px_22px_rgba(79,138,118,0.18)]' : ''"
                  @click="leftTab = 'planning'"
                >
                  <span class="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center bg-[var(--app-surface-strong)] text-[var(--app-primary)]" :class="leftTab === 'planning' ? 'bg-[rgba(79,138,118,0.18)]' : ''">
                    <el-icon><DataAnalysis /></el-icon>
                  </span>
                  <span>
                    <div class="text-sm font-semibold">规划工作台</div>
                    <div class="text-xs text-[var(--app-text-muted)]">事件图谱/看板/日程</div>
                  </span>
                </button>
                <button
                  type="button"
                  class="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl border border-transparent bg-transparent text-[var(--app-text)] cursor-pointer transition-all hover:bg-[var(--app-surface-muted)] hover:border-[var(--app-border)]"
                  :class="leftTab === 'graph' ? 'bg-[var(--app-primary-soft)] border-[rgba(79,138,118,0.4)] shadow-[0_10px_22px_rgba(79,138,118,0.18)]' : ''"
                  @click="leftTab = 'graph'"
                >
                  <span class="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center bg-[var(--app-surface-strong)] text-[var(--app-primary)]" :class="leftTab === 'graph' ? 'bg-[rgba(79,138,118,0.18)]' : ''">
                    <el-icon><Share /></el-icon>
                  </span>
                  <span>
                    <div class="text-sm font-semibold">知识图谱</div>
                    <div class="text-xs text-[var(--app-text-muted)]">实体关系/一致性</div>
                  </span>
                </button>
              </div>
            </div>
          </el-collapse-transition>

          <!-- 内容区域 -->
          <div class="flex-1 overflow-hidden">
            <NovelTree 
              ref="novelTreeRef"
              v-if="leftTab === 'chapters'"
              :novel-id="novelId" 
              :selected-chapter-id="currentChapterId"
              @chapter-selected="handleChapterSelected"
            />
            <div
              v-else
              class="h-full flex items-center justify-center text-sm text-[var(--app-text-muted)]"
            >
              请在中间区域查看
            </div>
          </div>
        </div>
      </template>


      <template #center>
        <EditorPanel 
          v-if="leftTab === 'chapters'"
          :novel-id="novelId"
          :chapter-id="currentChapterId"
          :external-content="currentChapterContent"
          @chapter-updated="handleChapterUpdated"
          @text-selected="handleTextSelected"
          @content-changed="handleContentChanged"
          @editor-mode-changed="handleEditorModeChanged"
        />

        <PlanningPanel
          v-else-if="leftTab === 'planning'"
          :novel-id="novelId"
          :novel-title="novel?.title"
          @start-writing="handleStartWriting"
        />

        <GraphPanel
          v-else-if="leftTab === 'graph'"
          :novel-id="novelId"
        />

      </template>

      <template #right>
        <AgentPanel 
          v-if="leftTab === 'chapters'"
          :novel-id="novelId"
          :novel-title="novel?.title"
          :chapter-id="currentChapterId"
          :chapter-title="currentChapter?.title"
          :chapter-content="currentChapterContent"
          :selected-text="selectedText"
          :selected-from="selectedFrom"
          :selected-to="selectedTo"
          :editor-mode="editorMode"
          @chapter-generated="handleChapterGenerated"
          @content-updated="handleContentUpdated"
        />
      </template>
    </WorkbenchLayout>
  </div>
</template>


<script setup lang="ts">
import WorkbenchLayout from '@/layouts/WorkbenchLayout.vue'
import AgentPanel from '@/panels/AgentPanel.vue'
import EditorPanel from '@/panels/EditorPanel.vue'
import NovelTree from '@/panels/NovelTree.vue'
import PlanningPanel from '@/panels/PlanningPanel.vue'
import GraphPanel from '@/panels/GraphPanel.vue'
import { ArrowLeft, ArrowUp, Document, DataAnalysis, Share } from '@element-plus/icons-vue'


import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'


const route = useRoute()
const router = useRouter()

const isLeftPanelOpen = ref(true)
const toggleLeftPanel = () => {
  isLeftPanelOpen.value = !isLeftPanelOpen.value
}

const novelId = ref<string>('')
const novel = ref<any>(null)
const leftTab = ref<'chapters' | 'planning' | 'graph'>('chapters')


const currentChapterId = ref<string | null>(null)
const currentChapter = ref<any>(null)
const currentChapterContent = ref<string>('')
const selectedText = ref<string>('')
const selectedFrom = ref(0)
const selectedTo = ref(0)
const editorMode = ref<'rich' | 'plain'>('rich')
const novelTreeRef = ref<InstanceType<typeof NovelTree> | null>(null)

const activeTabLabel = computed(() => {
  const labelMap: Record<string, string> = {
    chapters: '章节',
    planning: '规划工作台',
    graph: '知识图谱'
  }
  return labelMap[leftTab.value]
})


onMounted(async () => {
  novelId.value = route.params.novelId as string
  await loadNovel()
})

watch(() => route.params.novelId, async (newId) => {
  if (newId) {
    novelId.value = newId as string
    await loadNovel()
  }
})

async function loadNovel() {
  if (!novelId.value) return
  
  try {
    if (!window.electronAPI?.novel) {
      ElMessage.warning('Electron API 未加载')
      return
    }
    const result = await window.electronAPI.novel.get(novelId.value)
    if (result) {
      novel.value = result
    } else {
      ElMessage.error('小说不存在')
      goBack()
    }
  } catch (error: any) {
    console.error('加载小说失败:', error)
    ElMessage.error('加载小说失败')
    goBack()
  }
}

function handleChapterSelected(chapterId: string) {
  currentChapterId.value = chapterId
  loadChapter(chapterId)
}

async function loadChapter(chapterId: string) {
  if (!chapterId) return
  
  try {
    if (!window.electronAPI?.chapter) {
      ElMessage.warning('Electron API 未加载')
      return
    }
    const chapter = await window.electronAPI.chapter.get(chapterId)
    if (chapter) {
      currentChapter.value = chapter
      currentChapterContent.value = chapter.content || ''
    }
  } catch (error) {
    console.error('加载章节失败:', error)
    ElMessage.error('加载章节失败')
  }
}

// 处理从规划工作台点击"开始写作"
async function handleStartWriting(chapterId: string) {
  console.log('[Workbench] handleStartWriting 被调用，章节ID:', chapterId)
  
  // 1. 切换到章节标签页
  leftTab.value = 'chapters'
  console.log('[Workbench] 已切换到章节标签页')
  
  // 2. 选中该章节
  currentChapterId.value = chapterId
  console.log('[Workbench] 设置 currentChapterId:', chapterId)
  
  await loadChapter(chapterId)
  
  console.log('[Workbench] 章节加载完成')
}

// 处理章节更新
async function handleChapterUpdated() {
  if (currentChapterId.value) {
    await loadChapter(currentChapterId.value)
  }
  // 刷新章节列表以更新字数和标题
  if (novelTreeRef.value && typeof (novelTreeRef.value as any).loadChapters === 'function') {
    try {
      await (novelTreeRef.value as any).loadChapters()
    } catch (error) {
      console.error('[Workbench] 刷新章节列表失败:', error)
    }
  }
}

// 处理文本选中
function handleTextSelected(data: { text: string; from: number; to: number }) {
  selectedText.value = data.text
  selectedFrom.value = data.from
  selectedTo.value = data.to
}

// 处理编辑器模式变化
function handleEditorModeChanged(mode: 'rich' | 'plain') {
  editorMode.value = mode
}


// 处理内容变化
function handleContentChanged(content: string) {
  currentChapterContent.value = content
}

// 处理章节生成完成
async function handleChapterGenerated() {
  if (currentChapterId.value) {
    await loadChapter(currentChapterId.value)
  }
}

// 处理内容更新
function handleContentUpdated(content: string) {
  currentChapterContent.value = content
}

function goBack() {
  router.back()
}

function goToNovels() {
  router.push('/novels')
}

function goToSettings() {
  router.push('/settings')
}

</script>
