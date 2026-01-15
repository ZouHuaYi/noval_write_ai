<template>
  <div class="h-full flex flex-col overflow-hidden bg-gradient-to-b from-gray-50 to-white">
    <!-- 标题栏 -->
    <div class="flex-shrink-0 px-4 py-3 border-b border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-sm">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <div class="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-500 shadow-md">
            <el-icon class="text-white text-lg"><Cpu /></el-icon>
          </div>
          <div>
            <div class="font-bold text-base text-gray-800">AI 大纲助手</div>
            <div class="text-xs text-gray-500">辅助设计与优化故事大纲</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 内容区域 - 可滚动 -->
    <div class="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar min-h-0">
      <!-- 功能按钮区 -->
      <div>
        <div class="grid grid-cols-2 gap-3">
          <!-- 生成章节建议 -->
          <div 
            class="group bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
             @click="openGenerateDialog"
          >
            <div class="p-4 space-y-2">
              <div class="flex items-center justify-between">
                <div class="p-2 rounded-lg bg-blue-100 group-hover:bg-blue-200 transition-colors">
                  <el-icon class="text-blue-600 text-lg"><List /></el-icon>
                </div>
                <el-icon 
                  v-if="processing" 
                  class="is-loading text-gray-400 text-sm"
                >
                  <Loading />
                </el-icon>
              </div>
              <div class="text-sm font-semibold text-gray-800">生成大纲</div>
              <div class="text-xs text-gray-500">根据当前章节范围大纲</div>
            </div>
          </div>

          <!-- 优化大纲 -->
          <div 
            class="group bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
             @click="openPolishDialog"
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
              <div class="text-sm font-semibold text-gray-800">优化大纲</div>
              <div class="text-xs text-gray-500">优化剧情节奏与冲突设计</div>
            </div>
          </div>

          <!-- 逻辑检查 -->
          <div 
            class="group bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
             @click="openLogicDialog"
          >
            <div class="p-4 space-y-2">
              <div class="flex items-center justify-between">
                <div class="p-2 rounded-lg bg-orange-100 group-hover:bg-orange-200 transition-colors">
                  <el-icon class="text-orange-600 text-lg"><Warning /></el-icon>
                </div>
                <el-icon 
                  v-if="processing" 
                  class="is-loading text-gray-400 text-sm"
                >
                  <Loading />
                </el-icon>
              </div>
              <div class="text-sm font-semibold text-gray-800">逻辑检查</div>
              <div class="text-xs text-gray-500">检查设定冲突与情节漏洞</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 提示信息 -->
      <div class="mt-5 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
        <div class="flex items-start space-x-2">
          <el-icon class="text-indigo-500 text-sm mt-0.5 flex-shrink-0"><InfoFilled /></el-icon>
          <div class="text-xs text-indigo-700 leading-relaxed">
            <div class="font-semibold mb-1">使用提示：</div>
            <div>• 请先在中间选择并编辑一个大纲</div>
            <div>• 点击卡片输入需求，AI 将根据提示生成建议</div>

          </div>
        </div>
      </div>
    </div>

    <!-- AI 功能对话框 -->
    <el-dialog
      v-model="showDialog"
      :title="dialogTitle"
      width="600px"
      :close-on-click-modal="false"
    >
      <div class="space-y-3">
        <div class="text-sm font-medium text-gray-700">
          {{ dialogType === 'polish' ? '优化要求（可选）' :
             dialogType === 'generate' ? '生成要求（可选）' :
             '检查重点（可选）' }}
        </div>
        <el-input
          v-model="dialogPrompt"
          type="textarea"
          :rows="6"
          :placeholder="getDialogPlaceholder()"
          clearable
        />
        <div class="text-xs text-gray-500">
          {{ getDialogHint() }}
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
import { Brush, Cpu, InfoFilled, List, Loading, Warning } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { callChatModel } from '@/llm/client'
import { outlineSkills } from '@/llm/prompts/outline'
import { ref, watch } from 'vue'


const props = defineProps<{
  novelId?: string
  outlineId?: string | null
  novelTitle?: string
}>()

const processing = ref(false)
const showDialog = ref(false)
const dialogType = ref<'generate' | 'polish' | 'logic'>('generate')
const dialogTitle = ref('')
const dialogPrompt = ref('')
const outlineInfo = ref<any>(null)


const applyOutlineContent = async (content: string) => {
  if (!props.outlineId) return
  if (!window.electronAPI?.outline) {
    throw new Error('大纲 API 未加载')
  }

  const updated = await window.electronAPI.outline.update(props.outlineId, { content })
  outlineInfo.value = updated

  if (window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('outline-updated', { detail: { outlineId: props.outlineId } }))
  }
}

// 获取大纲内容
const getOutlineContent = async () => {

  if (!props.outlineId) return ''
  try { 
    if (window.electronAPI?.outline) {
      const outline = await window.electronAPI.outline.get(props.outlineId)
      outlineInfo.value = outline

    }
  } catch (error: any) {
    ElMessage.error('获取大纲内容失败' + (error.message || '未知错误'))
  }
}

watch(() => props.outlineId, (newId) => {
  if (newId) {
    getOutlineContent()
  }
})

const ensureOutlineSelected = (): boolean => {
  if (!props.outlineId) {
    ElMessage.warning('请先在中间选择一个大纲')
    return false
  }
  return true
}

const getDialogPlaceholder = () => {
  const placeholders = {
    generate: '例如：\n• 生成三幕结构大纲\n• 细化当前章节范围内的情节\n• 增加支线剧情和伏笔',
    polish: '例如：\n• 提升冲突和戏剧张力\n• 调整节奏更紧凑\n• 补充人物动机和成长线',
    logic: '例如：\n• 检查人物行为是否合理\n• 检查设定是否自洽\n• 查找时间线或因果逻辑问题'
  }
  return placeholders[dialogType.value]
}

const getDialogHint = () => {
  const hints = {
    generate: '留空则按默认规则生成大纲建议，填写可以指定你希望的结构或侧重点。',
    polish: '留空则整体优化当前大纲；填写可以指定更关注节奏、冲突或人物弧光等。',
    logic: '留空则做全面逻辑检查；填写可以聚焦某些角色、章节或设定。'
  }
  return hints[dialogType.value]
}

const formatOutlineRange = (start?: number | null, end?: number | null) => {
  if (start && end) return `第 ${start} 章 - 第 ${end} 章`
  if (start) return `第 ${start} 章起`
  if (end) return `至第 ${end} 章`
  return '未设置范围'
}

const buildOutlineContextForRange = async (start?: number | null, end?: number | null) => {
  if (!props.novelId) return ''
  if (!window.electronAPI?.outline) return ''
  if (!start || !end) return ''

  try {
    const outlines = await window.electronAPI.outline.list(props.novelId)
    const matched = outlines.filter(outline => {
      if (outline.id === props.outlineId) return false
      if (outline.startChapter == null || outline.endChapter == null) return false
      return outline.startChapter <= end && outline.endChapter >= start
    })

    if (matched.length === 0) return ''

    return matched.map(outline => {
      const range = formatOutlineRange(outline.startChapter, outline.endChapter)
      const content = outline.content?.trim() || '（该大纲暂无内容）'
      return `【${outline.title}】(${range})\n${content}`
    }).join('\n\n')
  } catch (error: any) {
    console.error('加载关联大纲失败:', error)
    return ''
  }
}

const buildMemoryContextForRange = async (start?: number | null, end?: number | null) => {
  if (!props.novelId) return ''
  if (!window.electronAPI?.storyEngine?.compress) return ''
  const chapter = end ?? start
  if (!chapter) return ''

  try {
    return await window.electronAPI.storyEngine.compress(chapter, props.novelId)
  } catch (error: any) {
    console.error('获取记忆上下文失败:', error)
    return ''
  }
}

const openGenerateDialog = () => {

  if (!ensureOutlineSelected()) return
  dialogType.value = 'generate'
  dialogTitle.value = '生成大纲建议'
  dialogPrompt.value = ''
  showDialog.value = true
}

const openPolishDialog = () => {
  if (!ensureOutlineSelected()) return
  dialogType.value = 'polish'
  dialogTitle.value = '优化大纲'
  dialogPrompt.value = ''
  showDialog.value = true
}

const openLogicDialog = () => {
  if (!ensureOutlineSelected()) return
  dialogType.value = 'logic'
  dialogTitle.value = '逻辑检查'
  dialogPrompt.value = ''
  showDialog.value = true
}

const confirmAction = async () => {
  processing.value = true
  showDialog.value = false
  try {
    if (dialogType.value === 'polish') {
      await handlePolishOutline()
    } else if (dialogType.value === 'generate') {
      await handleGenerateChapters()
    } else {
      await handleCheckLogic()
    }
  } catch (error: any) {
    ElMessage.error('执行失败: ' + (error.message || '未知错误'))
  } finally {
    processing.value = false
  }
}

const handleGenerateChapters = async () => {
  if (!ensureOutlineSelected()) return
  await getOutlineContent()

  if (!window.electronAPI?.outline?.generate) {
    ElMessage.error('大纲生成接口未加载')
    return
  }

  try {
    const prompt = dialogPrompt.value.trim()
    const startChapter = outlineInfo.value?.startChapter ?? null
    const endChapter = outlineInfo.value?.endChapter ?? null
    const [outlineContext, memoryContext] = await Promise.all([
      buildOutlineContextForRange(startChapter, endChapter),
      buildMemoryContextForRange(startChapter, endChapter)
    ])

    const systemPrompt = outlineSkills.generate.systemPrompt
    const userPrompt = outlineSkills.generate.buildUserPrompt({
      novelTitle: props.novelTitle,
      outlineTitle: outlineInfo.value?.title,
      startChapter,
      endChapter,
      outlineContext,
      memoryContext,
      extraPrompt: prompt
    })

    const result = (await window.electronAPI.outline.generate({
      systemPrompt,
      userPrompt
    })).trim()

    if (!result) {
      ElMessage.warning('未生成有效大纲内容')
      return
    }

    await applyOutlineContent(result)
    ElMessage.success('已生成大纲内容')
  } catch (error: any) {
    ElMessage.error('生成大纲失败: ' + (error.message || '未知错误'))
  }
}

const handlePolishOutline = async () => {
  if (!ensureOutlineSelected()) return
  await getOutlineContent()

  try {
    const prompt = dialogPrompt.value.trim()
    const systemPrompt = outlineSkills.polish.systemPrompt
    const userPrompt = outlineSkills.polish.buildUserPrompt({
      outlineContent: outlineInfo.value?.content,
      extraPrompt: prompt
    })

    const result = (await callChatModel(systemPrompt, userPrompt)).trim()
    if (!result) {
      ElMessage.warning('未生成有效优化结果')
      return
    }

    await applyOutlineContent(result)
    ElMessage.success('已更新优化后的大纲')
  } catch (error: any) {
    ElMessage.error('优化大纲失败: ' + (error.message || '未知错误'))
  }
}

const handleCheckLogic = async () => {
  if (!ensureOutlineSelected()) return
  await getOutlineContent()

  try {
    const prompt = dialogPrompt.value.trim()
    const systemPrompt = outlineSkills.logic.systemPrompt
    const userPrompt = outlineSkills.logic.buildUserPrompt({
      novelTitle: props.novelTitle,
      outlineContent: outlineInfo.value?.content,
      extraPrompt: prompt
    })

    const result = (await callChatModel(systemPrompt, userPrompt)).trim()
    if (!result) {
      ElMessage.warning('未生成逻辑检查结果')
      return
    }

    await ElMessageBox.alert(result, '大纲逻辑检查', {
      confirmButtonText: '知道了',
      dangerouslyUseHTMLString: false
    })
  } catch (error: any) {
    ElMessage.error('逻辑检查失败: ' + (error.message || '未知错误'))
  }
}



</script>

<style scoped>
@media (max-width: 640px) {
  .grid-cols-2 {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
}
</style>

