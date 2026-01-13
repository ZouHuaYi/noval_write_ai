<template>
  <div class="h-full flex flex-col overflow-hidden bg-gradient-to-b from-gray-50 to-white">
    <!-- 标题栏 -->
    <div class="flex-shrink-0 px-4 py-3 border-b border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-sm">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <div class="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 shadow-md">
            <el-icon class="text-white text-lg"><Cpu /></el-icon>
          </div>
          <div>
            <div class="font-bold text-base text-gray-800">AI 写作助手</div>
            <div class="text-xs text-gray-500">智能创作与编辑工具</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 内容区域 - 可滚动 -->
    <div class="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar min-h-0">
      <!-- AI 功能工具卡片 -->
      <div>
        <div class="grid grid-cols-2 gap-3">
          <!-- 润色文本 -->
          <div 
            class="group bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
            @click="handlePolish"
          >
            <div class="p-4 space-y-2">
              <div class="flex items-center justify-between">
                <div class="p-2 rounded-lg bg-green-100 group-hover:bg-green-200 transition-colors">
                  <el-icon class="text-green-600 text-lg"><Brush /></el-icon>
                </div>
                <el-icon 
                  v-if="processing" 
                  class="is-loading text-gray-400 text-sm"
                >
                  <Loading />
                </el-icon>
              </div>
              <div class="text-sm font-semibold text-gray-800">润色文本</div>
              <div class="text-xs text-gray-500">优化文字表达</div>
            </div>
          </div>

          <!-- 生成内容 -->
          <div 
            class="group bg-white rounded-lg border-2 border-blue-200 shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50"
            @click="handleGenerateNextChapter"
          >
            <div class="p-4 space-y-2">
              <div class="flex items-center justify-between">
                <div class="p-2 rounded-lg bg-blue-500 group-hover:bg-blue-600 transition-colors shadow-sm">
                  <el-icon class="text-white text-lg"><Plus /></el-icon>
                </div>
                <el-icon 
                  v-if="processing" 
                  class="is-loading text-gray-400 text-sm"
                >
                  <Loading />
                </el-icon>
              </div>
              <div class="text-sm font-semibold text-gray-800">生成内容</div>
              <div class="text-xs text-gray-500">AI 自动续写</div>
            </div>
          </div>

          <!-- 一致性检查 -->
          <div 
            class="group bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
            @click="handleConsistency"
          >
            <div class="p-4 space-y-2">
              <div class="flex items-center justify-between">
                <div class="p-2 rounded-lg bg-orange-100 group-hover:bg-orange-200 transition-colors">
                  <el-icon class="text-orange-600 text-lg"><Search /></el-icon>
                </div>
                <el-icon 
                  v-if="processing" 
                  class="is-loading text-gray-400 text-sm"
                >
                  <Loading />
                </el-icon>
              </div>
              <div class="text-sm font-semibold text-gray-800">一致性检查</div>
              <div class="text-xs text-gray-500">检查内容一致性</div>
            </div>
          </div>

        </div>
      </div>

      <!-- 提示信息 -->
      <div class="mt-5 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div class="flex items-start space-x-2">
          <el-icon class="text-blue-500 text-sm mt-0.5 flex-shrink-0"><InfoFilled /></el-icon>
          <div class="text-xs text-blue-700 leading-relaxed">
            <div class="font-semibold mb-1">使用提示：</div>
            <div>• 选择章节后可使用润色和续写功能</div>
            <div>• 选中文字后可针对选中内容进行操作</div>
            <div>• 所有操作都会自动保存到章节中</div>
          </div>
        </div>
      </div>
    </div>

    <!-- AI 功能对话框 -->
    <el-dialog
      v-model="showDialog"
      :title="dialogTitle"
      width="700px"
      :close-on-click-modal="false"
    >
      <div class="space-y-4">
        <!-- 选中的文字（仅润色时显示） -->
        <div v-if="dialogType === 'polish' && props.selectedText">
          <div class="text-sm font-semibold text-gray-600 mb-2">选中的文字：</div>
          <el-input
            :model-value="props.selectedText"
            type="textarea"
            :rows="4"
            readonly
            class="mb-2"
          />
        </div>
        <div v-if="dialogType === 'polish' && !props.selectedText" class="text-sm text-amber-600 mb-2">
          <el-icon class="mr-1"><Warning /></el-icon>
          未选中文字，将润色整个章节
        </div>
        
        <!-- 自定义提示输入框 -->
        <div>
          <div class="text-sm font-semibold text-gray-600 mb-2">
            {{ dialogType === 'polish' ? '润色要求（可选）：' :
               dialogType === 'consistency' ? '检查重点（可选）：' :
               '自定义提示（可选）：' }}
          </div>
          <el-input
            v-model="dialogPrompt"
            type="textarea"
            :rows="6"
            :placeholder="getDialogPlaceholder()"
            clearable
          />
          <div class="text-xs text-gray-500 mt-1">
            {{ getDialogHint() }}
          </div>
        </div>
      </div>
      
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button
          type="primary"
          @click="confirmAction"
          :loading="processing"
        >
          确认执行
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { Brush, Cpu, InfoFilled, Loading, Plus, Search, Warning } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { ref } from 'vue';

const props = defineProps<{
  novelId?: string
  chapterId?: string | null
  chapterContent?: string
  selectedText?: string
}>()

const emit = defineEmits<{
  (e: 'chapter-generated', chapter: any): void
  (e: 'content-updated', content: string): void
}>()

const processing = ref(false)
const showDialog = ref(false)
const dialogType = ref<'continue' | 'polish' | 'consistency' | 'next'>('continue')
const dialogTitle = ref('')
const dialogPrompt = ref('')

const getDialogPlaceholder = () => {
  const placeholders = {
    continue: '例如：\n• 让主角遇到一个神秘老人\n• 增加一段环境描写\n• 让对话更加生动\n• 延续当前情节发展',
    polish: '例如：\n• 让文字更加优美\n• 增加细节描写\n• 优化对话表达\n• 提升文笔水平',
    consistency: '例如：\n• 检查人物名称是否一致\n• 检查时间线是否合理\n• 检查世界观设定\n• 检查情节逻辑',
    next: '例如：\n• 让下一章发生战斗\n• 引入新角色\n• 推进主线剧情\n• 增加悬念'
  }
  return placeholders[dialogType.value] || ''
}

const getDialogHint = () => {
  const hints = {
    continue: '留空则使用默认续写逻辑，输入提示可指导AI续写方向',
    polish: '留空则使用默认润色逻辑，输入要求可指定润色重点',
    consistency: '留空则进行全面检查，输入重点可指定检查范围',
    next: '留空则使用默认生成逻辑，输入提示可指导下一章内容'
  }
  return hints[dialogType.value] || ''
}

const executeGenerateNextChapter = async () => {
  const prompt = dialogPrompt.value.trim()
  ElMessage.info(prompt ? `正在生成该章节内容：${prompt}` : '正在使用 AI 生成该章节内容...')
  
  // 模拟 AI 生成过程
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  // 创建新章节
  if (window.electronAPI?.chapter) {
    const chapters = await window.electronAPI.chapter.list(props.novelId!)
    const nextChapterNum = chapters.length + 1
    
    // 这里应该使用 AI 生成的内容，目前先用占位符
    const aiGeneratedContent = prompt 
      ? `[AI 生成的内容将在这里显示]\n\n基于提示"${prompt}"和该章节的内容，AI 将自动生成该章节的内容。`
      : `[AI 生成的内容将在这里显示]\n\n基于该章节的内容，AI 将自动生成该章节的内容。`
    const aiGeneratedTitle = `第${nextChapterNum}章 [AI 生成]`
    
    const newChapter = await window.electronAPI.chapter.create(props.novelId!, {
      title: aiGeneratedTitle,
      content: aiGeneratedContent,
      status: 'draft'
    })
    
    if (newChapter?.id) {
      ElMessage.success('AI 已生成该章节内容！')
      emit('chapter-generated', newChapter)
      // 触发章节树刷新
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('chapter-created', { detail: { chapterId: newChapter.id } }))
      }
    }
  } else {
    ElMessage.error('Electron API 未加载')
  }
}

const handlePolish = () => {
  if (!props.chapterId || !props.chapterContent) {
    ElMessage.warning('请先选择章节并输入内容')
    return
  }
  dialogType.value = 'polish'
  dialogTitle.value = props.selectedText ? '润色选中文字' : '润色文本'
  dialogPrompt.value = ''
  showDialog.value = true
}

const handleConsistency = () => {
  if (!props.novelId) {
    ElMessage.warning('请先选择小说')
    return
  }
  dialogType.value = 'consistency'
  dialogTitle.value = '一致性检查'
  dialogPrompt.value = ''
  showDialog.value = true
}

const confirmAction = async () => {
  processing.value = true
  showDialog.value = false
  
  try {
    switch (dialogType.value) {
      case 'continue':
        await executeContinue()
        break
      case 'polish':
        await executePolish()
        break
      case 'consistency':
        await executeConsistency()
        break
      case 'next':
        await executeGenerateNextChapter()
        break
    }
  } catch (error: any) {
    ElMessage.error('执行失败: ' + (error.message || '未知错误'))
  } finally {
    processing.value = false
  }
}

const executeContinue = async () => {
  // TODO: 调用 Agent API 续写
  const prompt = dialogPrompt.value.trim()
  ElMessage.info(prompt ? `正在续写：${prompt}` : '正在续写本章...')
  await new Promise(resolve => setTimeout(resolve, 1500))
  
  // 模拟生成续写内容
  const continuedContent = props.chapterContent + '\n\n[续写内容将在这里显示]'
  emit('content-updated', continuedContent)
  ElMessage.success('续写完成（模拟）')
}

const executePolish = async () => {
  // TODO: 调用 Agent API 润色
  const prompt = dialogPrompt.value.trim()
  const textToPolish = props.selectedText || props.chapterContent || ''
  
  if (!textToPolish) {
    ElMessage.warning('没有可润色的内容')
    return
  }
  
  ElMessage.info(prompt ? `正在润色：${prompt}` : (props.selectedText ? '正在润色选中文字...' : '正在润色文本...'))
  await new Promise(resolve => setTimeout(resolve, 1500))
  
  // 模拟生成润色内容
  if (props.selectedText) {
    // 只润色选中的文字
    const polishedText = `[润色后的文字：${props.selectedText}]`
    // 替换原内容中的选中文字
    const newContent = props.chapterContent?.replace(props.selectedText, polishedText) || polishedText
    emit('content-updated', newContent)
    ElMessage.success('选中文字润色完成（模拟）')
  } else {
    // 润色整个章节
    const polishedContent = '[润色后的内容将在这里显示]\n' + props.chapterContent
    emit('content-updated', polishedContent)
    ElMessage.success('润色完成（模拟）')
  }
}

const executeConsistency = async () => {
  // TODO: 调用 Agent API 一致性检查
  const prompt = dialogPrompt.value.trim()
  ElMessage.info(prompt ? `正在检查：${prompt}` : '正在进行一致性检查...')
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  ElMessage.success('一致性检查完成（模拟）')
  // 这里可以显示检查结果
}

const handleGenerateNextChapter = () => {
  if (!props.novelId) {
    ElMessage.warning('请先选择小说')
    return
  }
  dialogType.value = 'next'
  dialogTitle.value = 'AI 生成内容'
  dialogPrompt.value = ''
  showDialog.value = true
}
</script>

<style scoped>
/* 响应式调整 */
@media (max-width: 640px) {
  .grid-cols-2 {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
}
</style>
