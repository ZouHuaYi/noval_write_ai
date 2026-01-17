<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- 顶部工具栏 -->
    <div class="flex-shrink-0 px-4 py-2 border-b border-[color:var(--app-border)] bg-transparent flex items-center justify-between workbench-panel-header">
      <div class="workbench-panel-title">
        <div class="p-1.5 rounded-lg bg-amber-100">
          <el-icon class="text-amber-600 text-base"><Edit /></el-icon>
        </div>
        <span class="font-semibold">写作区</span>
        <!-- 编辑器类型切换 -->
        <el-radio-group v-model="editorMode" size="small" class="ml-4">
          <el-radio-button value="rich">富文本</el-radio-button>
          <el-radio-button value="plain">纯文本</el-radio-button>
        </el-radio-group>
      </div>
      <div class="flex items-center space-x-2">
        <el-button 
          type="primary" 
          @click="markMemory"
          class="shadow-sm hover:shadow-md transition-shadow"
        >
          <el-icon class="mr-1"><MagicStick /></el-icon>
          记忆
        </el-button>
        <el-button 
          type="success" 
          @click="markComplete"
          class="shadow-sm hover:shadow-md transition-shadow"
        >
          标记
        </el-button>
      </div>
    </div>

    <!-- 编辑区域 -->
    <div class="flex-1 px-6 py-5 overflow-y-auto min-h-0">
      <div class="editor-panel-form">
        <div v-if="!props.chapterId" class="h-full flex flex-col items-center justify-center app-muted">
          <div class="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-4">
            <el-icon class="text-2xl text-amber-400"><Edit /></el-icon>
          </div>
          <div class="text-sm">请选择左侧章节开始写作</div>
        </div>
        <div v-else>
          <div class="mb-4 app-section workbench-info-card p-3 flex flex-wrap items-center gap-3 text-sm">
            <span class="workbench-section-title">当前章节</span>
            <span class="app-muted">第 {{ chapterNumber || '-' }} 章</span>
            <span class="app-muted">标题：{{ chapterTitle || '未命名章节' }}</span>
            <el-tag size="small" :type="statusType" effect="plain" class="workbench-count">{{ statusText }}</el-tag>
            <el-tag size="small" type="info" effect="plain" class="workbench-count">{{ wordCount }} 字</el-tag>
            <el-tag v-if="mentionCount > 0" size="small" type="primary" effect="plain" class="workbench-count">
              {{ mentionCount }} 个引用
            </el-tag>
          </div>
          <!-- 章节编号和标题 -->
          <div class="mb-5 app-section p-4">
            <div class="flex items-end space-x-3">
              <div class="flex-shrink-0 w-28">
                <div class="text-xs font-medium app-muted mb-2">章节编号</div>
                <el-input-number
                  v-model="chapterNumber"
                  :min="1"
                  :precision="0"
                  class="w-full"
                />
              </div>
              <div class="flex-1">
                <div class="text-xs font-medium app-muted mb-2">章节标题</div>
                <el-input
                  v-model="chapterTitle"
                  placeholder="请输入章节标题"
                  size="default"
                  clearable
                />
              </div>
            </div>
          </div>

          <!-- 正文编辑区 -->
          <div class="app-section p-4">
            <!-- 富文本编辑器模式 -->
            <RichEditor
              v-if="editorMode === 'rich'"
              ref="richEditorRef"
              v-model="richContent"
              placeholder="开始写作... 输入 @ 引用知识库内容"
              :knowledge-items="knowledgeItems"
              @update:model-value="handleRichContentChange"
              @mention-insert="handleMentionInsert"
            />
            <!-- 纯文本编辑器模式 -->
            <el-input
              v-else
              v-model="content"
              type="textarea"
              :rows="25"
              placeholder="开始写作..."
              resize="none"
              class="editor-textarea"
              @input="handleContentInput"
              @select="handleTextSelect"
              @change="autoSave"
            />
          </div>

          <!-- @DSL 提示 -->
          <div v-if="editorMode === 'rich'" class="mt-3 px-2 flex items-center gap-2 text-xs app-muted">
            <el-icon><InfoFilled /></el-icon>
            <span>输入 <code class="px-1 py-0.5 bg-blue-50 text-blue-600 rounded">@</code> 可引用知识库中的角色、地点、事件等内容</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Edit, InfoFilled, MagicStick } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, ref, watch } from 'vue'
import RichEditor from '@/components/RichEditor.vue'
import { extractMentionIds, htmlToPlainText } from '@/utils/mentionParser'

interface KnowledgeItem {
  id: string
  type: 'character' | 'location' | 'event' | 'item' | 'rule' | 'other'
  name: string
  summary?: string
  detail?: string
  aliases?: string[]
}

const props = defineProps<{
  novelId?: string
  chapterId?: string | null
  externalContent?: string
}>()

const emit = defineEmits<{
  (e: 'chapter-updated', chapter: any): void
  (e: 'text-selected', text: string): void
  (e: 'content-changed', content: string): void
}>()

// 编辑器模式
const editorMode = ref<'rich' | 'plain'>('rich')

const richEditorRef = ref<InstanceType<typeof RichEditor> | null>(null)
const selectedText = ref('')
const chapterTitle = ref('')
const chapterNumber = ref<number | null>(null)
const content = ref('')
const richContent = ref('')
const wordCount = ref(0)
const mentionCount = ref(0)
const status = ref<'draft' | 'writing' | 'completed'>('draft')
const saving = ref(false)

// 知识库条目（用于 @提及）
const knowledgeItems = ref<KnowledgeItem[]>([])

const statusType = computed(() => {
  const map = {
    draft: 'info',
    writing: 'warning',
    completed: 'success'
  }
  return map[status.value]
})

const statusText = computed(() => {
  const map = {
    draft: '草稿',
    writing: '写作中',
    completed: '已完成'
  }
  return map[status.value]
})

// 加载知识库条目
async function loadKnowledgeItems() {
  if (!props.novelId) return
  try {
    if (window.electronAPI?.knowledge) {
      const items = await window.electronAPI.knowledge.list(props.novelId, undefined, 'approved')
      knowledgeItems.value = items.map((item: any) => ({
        id: item.id,
        type: item.type || 'other',
        name: item.name,
        summary: item.summary,
        detail: item.detail,
        aliases: item.aliases ? (typeof item.aliases === 'string' ? JSON.parse(item.aliases) : item.aliases) : []
      }))
    }
  } catch (error) {
    console.error('加载知识库失败:', error)
  }
}

watch(() => props.novelId, () => {
  loadKnowledgeItems()
}, { immediate: true })

watch(() => props.chapterId, async (newId) => {
  if (newId) {
    await loadChapter(newId)
  } else {
    chapterTitle.value = ''
    chapterNumber.value = null
    content.value = ''
    richContent.value = ''
    wordCount.value = 0
    mentionCount.value = 0
    status.value = 'draft'
  }
}, { immediate: true })

watch(() => props.externalContent, (newContent) => {
  if (typeof newContent === 'string' && newContent !== content.value) {
    content.value = newContent
    // 如果是富文本模式，也更新富文本内容
    if (editorMode.value === 'rich') {
      richContent.value = `<p>${newContent.replace(/\n/g, '</p><p>')}</p>`
    }
    updateWordCount()
  }
})

// 切换编辑器模式时同步内容
watch(editorMode, (newMode, oldMode) => {
  if (newMode === 'rich' && oldMode === 'plain') {
    // 从纯文本转富文本
    richContent.value = `<p>${content.value.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`
  } else if (newMode === 'plain' && oldMode === 'rich') {
    // 从富文本转纯文本
    content.value = htmlToPlainText(richContent.value)
  }
})

async function loadChapter(chapterId: string) {
  if (!chapterId) return
  
  try {
    if (window.electronAPI?.chapter) {
      const chapter = await window.electronAPI.chapter.get(chapterId)
      if (chapter) {
        chapterTitle.value = chapter.title || ''
        chapterNumber.value = chapter.chapterNumber || null
        content.value = chapter.content || ''
        // 初始化富文本内容
        richContent.value = chapter.content 
          ? `<p>${chapter.content.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`
          : ''
        status.value = (chapter.status as any) || 'draft'
        updateWordCount()
      }
    }
  } catch (error: any) {
    console.error('加载章节失败:', error)
    ElMessage.error('加载章节失败')
  }
}

const updateWordCount = () => {
  let text = ''
  if (editorMode.value === 'rich') {
    text = htmlToPlainText(richContent.value)
    mentionCount.value = extractMentionIds(richContent.value).length
  } else {
    text = content.value
    mentionCount.value = 0
  }
  // 简单的中文字数统计（去除空格和标点）
  wordCount.value = text.replace(/[\s\p{P}]/gu, '').length
}

const handleContentInput = () => {
  updateWordCount()
  emit('content-changed', content.value)
}

const handleRichContentChange = (html: string) => {
  // 同步到纯文本内容（用于保存）
  content.value = htmlToPlainText(html)
  updateWordCount()
  emit('content-changed', content.value)
}

const handleMentionInsert = (item: KnowledgeItem) => {
  console.log('插入引用:', item.name)
  mentionCount.value = extractMentionIds(richContent.value).length
}

const handleTextSelect = (event: Event) => {
  const target = event.target as HTMLTextAreaElement
  if (!target) return
  
  const start = target.selectionStart
  const end = target.selectionEnd
  
  if (start !== end && start !== null && end !== null) {
    selectedText.value = content.value.substring(start, end)
    emit('text-selected', selectedText.value)
  } else {
    selectedText.value = ''
    emit('text-selected', '')
  }
}

/**
 * 自动保存
 */
async function autoSave() {
  if (!props.chapterId || saving.value) return
  try {
    if (window.electronAPI?.chapter) {
      const updateData: any = {
        title: chapterTitle.value,
        content: content.value,
        status: 'draft' // 草稿状态
      }
      if (chapterNumber.value !== null) {
        updateData.chapterNumber = chapterNumber.value
      }
      await window.electronAPI.chapter.update(props.chapterId, updateData)
      // 静默保存，不显示消息
      status.value = 'draft'
    }
  } catch (error: any) {
    ElMessage.error('保存失败: ' + (error.message || '未知错误'))
  }
}

async function markMemory() {
  if (!props.chapterId) {
    ElMessage.warning('请先选择章节')
    return
  }
  saving.value = true
  try {
    // 1. 先保存章节内容，确保 StoryEngine 分析的是最新数据
    if (window.electronAPI?.chapter) {
      const updateData: any = {
        title: chapterTitle.value,
        content: content.value,
        status: 'completed'
      }
      if (chapterNumber.value !== null) {
        updateData.chapterNumber = chapterNumber.value
      }
      const chapter = await window.electronAPI.chapter.update(props.chapterId, updateData)
      status.value = 'completed'
      emit('chapter-updated', chapter)
      ElMessage.success('章节已保存并标记为完成')
    }

    // 2. 运行记忆提取 (基于已保存的数据)
    if (props.novelId && window.electronAPI?.storyEngine) {
      try {
        await window.electronAPI.storyEngine.run(props.novelId)
        ElMessage.success('记忆提取完成')
      } catch (error: any) {
        console.error('运行记忆提取失败:', error)
        ElMessage.warning('章节已保存，但记忆提取失败')
      }
    }
  } catch (error: any) {
    ElMessage.error('操作失败: ' + (error.message || '未知错误'))
  } finally {
    saving.value = false
  }
}

async function markComplete() {
  if (!props.chapterId) {
    ElMessage.warning('请先选择章节')
    return
  }
  saving.value = true
  try {
    if (window.electronAPI?.chapter) {
      const updateData: any = {
        title: chapterTitle.value,
        content: content.value,
        status: 'writing'
      }
      if (chapterNumber.value !== null) {
        updateData.chapterNumber = chapterNumber.value
      }
      const chapter = await window.electronAPI.chapter.update(props.chapterId, updateData)
      status.value = 'writing'
      emit('chapter-updated', chapter)
      ElMessage.success('章节已标记为写作中')
    }
  } catch (error: any) {
    ElMessage.error('更新失败: ' + (error.message || '未知错误'))
  } finally {
    saving.value = false
  }
}

// 暴露获取 @提及 的方法
defineExpose({
  getMentions: () => richEditorRef.value?.getMentions() || [],
  getContent: () => content.value,
})
</script>

<style scoped>
.editor-textarea :deep(.el-textarea__inner) {
  font-size: 15px;
  line-height: 1.8;
  font-family: inherit;
}
</style>