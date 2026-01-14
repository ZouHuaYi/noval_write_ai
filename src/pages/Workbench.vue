<template>
  <div class="h-screen flex flex-col">
    <!-- 顶部导航栏 -->
    <div class="h-14 border-b border-gray-200/60 bg-white/95 backdrop-blur-sm shadow-sm flex items-center justify-between px-5 flex-shrink-0 z-10">
      <div class="flex items-center space-x-3">
        <el-button 
          text 
          @click="goBack"
          class="flex items-center hover:bg-gray-100 rounded-lg px-2 py-1"
        >
          <el-icon class="mr-1 text-gray-600"><ArrowLeft /></el-icon>
          <span class="text-sm text-gray-700">返回</span>
        </el-button>
        <el-divider direction="vertical" class="h-6" />
        <div v-if="novel" class="flex items-center space-x-3">
          <div class="flex justify-center">
            <span class="font-semibold text-base text-gray-800 leading-tight">{{ novel.title }}</span>
          </div>
        </div>
        <div v-else class="text-gray-400 text-sm">加载中...</div>
      </div>
      <div class="flex items-center space-x-2">
        <el-tag v-if="currentChapter" size="large" type="primary" effect="plain" class="px-3 py-1">
          {{ currentChapter.title }}
        </el-tag>
      </div>
    </div>

    <!-- 工作台内容 -->
    <WorkbenchLayout class="flex-1 overflow-hidden">
      <template #left>
        <div class="h-full flex flex-col bg-white">
          <!-- 顶部标签切换：使用 Element Plus Tabs -->
          <div class="flex-shrink-0 bg-white border-b border-gray-200 px-3 pt-1 mt-13px">
            <el-tabs
              v-model="leftTab"
              type="card"
              class="workbench-left-tabs"
            >
              <el-tab-pane name="chapters">
                <template #label>
                  <span class="inline-flex items-center gap-1.5 text-xs">
                    <el-icon class="text-sm"><Document /></el-icon>
                    <span>章节</span>
                  </span>
                </template>
              </el-tab-pane>
              <el-tab-pane name="outlines">
                <template #label>
                  <span class="inline-flex items-center gap-1.5 text-xs">
                    <el-icon class="text-sm"><List /></el-icon>
                    <span>大纲</span>
                  </span>
                </template>
              </el-tab-pane>
            </el-tabs>
          </div>
          
          <!-- 内容区域 -->
          <div class="flex-1 overflow-hidden">
            <NovelTree 
              v-if="leftTab === 'chapters'"
              :novel-id="novelId" 
              @chapter-selected="handleChapterSelected"
            />
            <OutlinePanel 
              v-else
              :novel-id="novelId" 
              @outline-selected="handleOutlineSelected"
            />
          </div>
        </div>
      </template>

      <template #center>
        <EditorPanel 
          v-if="leftTab === 'chapters'"
          :novel-id="novelId"
          :chapter-id="currentChapterId"
          @chapter-updated="handleChapterUpdated"
          @text-selected="handleTextSelected"
        />
        <OutlineEditor
          v-else
          :outline-id="currentOutlineId"
          @outline-updated="handleOutlineUpdated"
        />
      </template>

      <template #right>
        <AgentPanel 
          v-if="leftTab === 'chapters'"
          :novel-id="novelId"
          :novel-title="novel.title"
          :chapter-id="currentChapterId"
          :chapter-content="currentChapterContent"
          :selected-text="selectedText"
          @chapter-generated="handleChapterGenerated"
          @content-updated="handleContentUpdated"
        />
        <OutlineAgentPanel
          v-else
          :novel-id="novelId"
          :novel-title="novel.title"
          :outline-id="currentOutlineId"
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
import OutlineAgentPanel from '@/panels/OutlineAgentPanel.vue'
import OutlineEditor from '@/panels/OutlineEditor.vue'
import OutlinePanel from '@/panels/OutlinePanel.vue'
import { ArrowLeft, Document, List } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const novelId = ref<string>('')
const novel = ref<any>(null)
const leftTab = ref<'chapters' | 'outlines'>('chapters')
const currentChapterId = ref<string | null>(null)
const currentOutlineId = ref<string | null>(null)
const currentChapter = ref<any>(null)
const currentChapterContent = ref<string>('')
const selectedText = ref<string>('')

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
</script>
