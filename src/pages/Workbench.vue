<template>
  <div class="h-screen flex flex-col app-shell">

    <!-- 顶部导航栏 -->
    <div class="h-14 app-header flex items-center justify-between px-6 flex-shrink-0 z-10">

      <div class="flex items-center space-x-3">
        <el-button 
          text 
          @click="goBack"
          class="flex items-center hover:bg-[color:var(--app-surface-muted)] rounded-lg px-2 py-1"

        >
          <el-icon class="mr-1 app-muted"><ArrowLeft /></el-icon>
          <span class="text-sm app-muted">返回</span>

        </el-button>
        <el-divider direction="vertical" class="h-6" />
        <div v-if="novel" class="flex flex-col">
          <span class="text-xs app-muted">当前小说</span>
          <span class="workbench-title">{{ novel?.title }}</span>
        </div>
        <div v-else class="app-muted text-sm">加载中...</div>

      </div>
      <div class="flex items-center space-x-2">
        <el-tag size="large" type="info" effect="plain" class="workbench-pill">
          {{ activeTabLabel }}
        </el-tag>
        <el-tag v-if="currentChapter" size="large" type="primary" effect="plain" class="workbench-pill">
          {{ currentChapter.title }}
        </el-tag>
        <el-tag v-else size="large" type="info" effect="plain" class="workbench-pill">
          未选择章节
        </el-tag>
        <el-button text @click="goToNovels">小说列表</el-button>
        <el-button text @click="goToSettings">设置</el-button>
      </div>

    </div>

    <!-- 工作台内容 -->
    <WorkbenchLayout class="flex-1 overflow-hidden">
      <template #left>
        <div class="h-full flex flex-col">
          <div class="relative flex-shrink-0 px-4 py-3 border-b border-[color:var(--app-border)] workbench-panel-header">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm font-semibold">工作区</div>
                <div class="text-xs app-muted">资料导航</div>
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
              <div class="workbench-nav">
                <button
                  type="button"
                  class="workbench-nav-item"
                  :class="{ 'is-active': leftTab === 'chapters' }"
                  @click="leftTab = 'chapters'"
                >
                  <span class="workbench-nav-icon">
                    <el-icon><Document /></el-icon>
                  </span>
                  <span>
                    <div class="text-sm font-semibold">章节</div>
                    <div class="text-xs app-muted">章节管理与顺序</div>
                  </span>
                </button>
                <button
                  type="button"
                  class="workbench-nav-item"
                  :class="{ 'is-active': leftTab === 'outlines' }"
                  @click="leftTab = 'outlines'"
                >
                  <span class="workbench-nav-icon">
                    <el-icon><List /></el-icon>
                  </span>
                  <span>
                    <div class="text-sm font-semibold">大纲</div>
                    <div class="text-xs app-muted">情节结构与节奏</div>
                  </span>
                </button>
                <button
                  type="button"
                  class="workbench-nav-item"
                  :class="{ 'is-active': leftTab === 'world' }"
                  @click="leftTab = 'world'"
                >
                  <span class="workbench-nav-icon">
                    <el-icon><Edit /></el-icon>
                  </span>
                  <span>
                    <div class="text-sm font-semibold">世界观</div>
                    <div class="text-xs app-muted">设定与规则</div>
                  </span>
                </button>
                <button
                  type="button"
                  class="workbench-nav-item"
                  :class="{ 'is-active': leftTab === 'memory' }"
                  @click="leftTab = 'memory'"
                >
                  <span class="workbench-nav-icon">
                    <el-icon><Memo /></el-icon>
                  </span>
                  <span>
                    <div class="text-sm font-semibold">记忆</div>
                    <div class="text-xs app-muted">角色与事件记录</div>
                  </span>
                </button>
              </div>
            </div>
          </el-collapse-transition>

          <!-- 内容区域 -->
          <div class="flex-1 overflow-hidden">
            <NovelTree 
              v-if="leftTab === 'chapters'"
              :novel-id="novelId" 
              @chapter-selected="handleChapterSelected"
            />
            <OutlinePanel 
              v-else-if="leftTab === 'outlines'"
              :novel-id="novelId" 
              @outline-selected="handleOutlineSelected"
            />
            <div
              v-else-if="leftTab === 'world'"
              class="h-full flex items-center justify-center text-sm app-muted"
            >
              世界观在中间编辑
            </div>
            <MemoryPanel
              v-else
              :novel-id="novelId"
            />

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
        />

        <OutlineEditor
          v-else-if="leftTab === 'outlines'"
          :outline-id="currentOutlineId"
          @outline-updated="handleOutlineUpdated"
        />

        <WorldPanel
          v-else-if="leftTab === 'world'"
          :novel-id="novelId"
        />

        <div v-else class="h-full flex items-center justify-center text-sm app-muted">
          记忆信息仅在左侧展示
        </div>

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
          @chapter-generated="handleChapterGenerated"
          @content-updated="handleContentUpdated"
        />

        <OutlineAgentPanel
          v-else-if="leftTab === 'outlines'"
          :novel-id="novelId"
          :novel-title="novel?.title"
          :outline-id="currentOutlineId"
        />

        <div
          v-else-if="leftTab === 'world'"
          class="h-full flex items-center justify-center text-sm app-muted"
        >
          世界观管理区
        </div>

        <div v-else class="h-full flex items-center justify-center text-sm app-muted">
          StoryEngine 记忆区
        </div>

      </template>
    </WorkbenchLayout>
  </div>
</template>


<script setup lang="ts">
import WorkbenchLayout from '@/layouts/WorkbenchLayout.vue'
import AgentPanel from '@/panels/AgentPanel.vue'
import EditorPanel from '@/panels/EditorPanel.vue'
import MemoryPanel from '@/panels/MemoryPanel.vue'
import NovelTree from '@/panels/NovelTree.vue'
import OutlineAgentPanel from '@/panels/OutlineAgentPanel.vue'
import OutlineEditor from '@/panels/OutlineEditor.vue'
import OutlinePanel from '@/panels/OutlinePanel.vue'
import WorldPanel from '@/panels/WorldPanel.vue'
import { ArrowLeft, ArrowUp, Document, Edit, List, Memo } from '@element-plus/icons-vue'


import { ElMessage } from 'element-plus'
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
const leftTab = ref<'chapters' | 'outlines' | 'world' | 'memory'>('chapters')


const currentChapterId = ref<string | null>(null)
const currentOutlineId = ref<string | null>(null)
const currentChapter = ref<any>(null)
const currentChapterContent = ref<string>('')
const selectedText = ref<string>('')

const activeTabLabel = computed(() => {
  const labelMap = {
    chapters: '章节',
    outlines: '大纲',
    world: '世界观',
    memory: '记忆'
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
    if (window.electronAPI?.novel) {
      novel.value = await window.electronAPI.novel.get(novelId.value)
      if (!novel.value) {
        ElMessage.error('小说不存在')
        goBack()
      }
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
    if (window.electronAPI?.chapter) {
      currentChapter.value = await window.electronAPI.chapter.get(chapterId)
      currentChapterContent.value = currentChapter.value?.content || ''
    }
  } catch (error: any) {
    console.error('加载章节失败:', error)
    ElMessage.error('加载章节失败')
  }
}

function handleChapterUpdated(chapter: any) {
  currentChapter.value = chapter
  currentChapterContent.value = chapter?.content || ''
}

function handleChapterGenerated(chapter: any) {
  if (chapter?.id) {
    currentChapterId.value = chapter.id
    loadChapter(chapter.id)
  }
}

function handleContentUpdated(content: string) {
  currentChapterContent.value = content
  // 如果当前有章节，更新章节内容
  if (currentChapterId.value) {
    updateChapterContent(currentChapterId.value, content)
  }
}

function handleTextSelected(text: string) {
  selectedText.value = text
}

function handleContentChanged(content: string) {
  currentChapterContent.value = content
}

function handleOutlineSelected(outlineId: string) {

  currentOutlineId.value = outlineId
}

function handleOutlineUpdated(_outline: any) {
  // 大纲更新后的处理（如果需要可以在这里刷新大纲列表）
}

async function updateChapterContent(chapterId: string, content: string) {
  try {
    if (window.electronAPI?.chapter) {
      const chapter = await window.electronAPI.chapter.update(chapterId, {
        content: content
      })
      currentChapter.value = chapter
    }
  } catch (error: any) {
    console.error('更新章节内容失败:', error)
  }
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
