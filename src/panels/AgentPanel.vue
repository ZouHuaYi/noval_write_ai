<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- 标题栏 -->
    <div class="flex-shrink-0 px-4 py-3 border-b border-[var(--app-border)] bg-transparent bg-[var(--app-surface-muted)] rounded-t-[var(--app-radius)]">

      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="p-1.5 rounded-lg bg-emerald-500 shadow-md">
            <el-icon class="text-white text-lg"><Cpu /></el-icon>
          </div>
          <div>
            <div class="font-bold text-base">AI 写作助手</div>
            <div class="text-xs text-[var(--app-text-muted)]">智能创作与编辑工具</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 内容区域 - 可滚动 -->
    <div class="flex-1 px-4 py-4 min-h-0 overflow-y-auto">
      <el-collapse v-model="activeSections" class="mb-3">
        <el-collapse-item name="tools">
          <template #title>
            <span class="text-xs font-semibold">写作工具</span>
          </template>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <!-- 润色文本 -->
            <div 
              class="group bg-[var(--app-surface-muted)] border border-[var(--app-border)] rounded-[var(--app-radius)] transition-all duration-200 hover:border-[rgba(79,138,118,0.28)] shadow-sm hover:shadow-md cursor-pointer overflow-hidden"
              @click="handlePolish"
            >
              <div class="p-4 space-y-2">
                <div class="flex items-center justify-between">
                  <div class="p-2 rounded-lg bg-green-100 group-hover:bg-green-200 transition-colors">
                    <el-icon class="text-green-600 text-lg"><Brush /></el-icon>
                  </div>
                  <el-icon 
                    v-if="processing" 
                    class="is-loading text-[var(--app-text-muted)] text-sm"
                  >
                    <Loading />
                  </el-icon>
                </div>
                <div class="text-sm font-semibold">润色文本</div>
                <div class="text-xs text-[var(--app-text-muted)]">优化文字表达</div>
              </div>
            </div>

            <!-- 生成内容 -->
            <div 
              class="group bg-[var(--app-surface-muted)] border border-[var(--app-border)] rounded-[var(--app-radius)] transition-all duration-200 hover:border-[rgba(79,138,118,0.28)] border-2 border-emerald-300 shadow-md hover:shadow-lg cursor-pointer overflow-hidden bg-emerald-50/60"
              @click="handleGenerateNextChapter"
            >
              <div class="p-4 space-y-2">
                <div class="flex items-center justify-between">
                  <div class="p-2 rounded-lg bg-blue-500 group-hover:bg-blue-600 transition-colors shadow-sm">
                    <el-icon class="text-white text-lg"><Plus /></el-icon>
                  </div>
                  <el-icon 
                    v-if="processing" 
                    class="is-loading text-[var(--app-text-muted)] text-sm"
                  >
                    <Loading />
                  </el-icon>
                </div>
                <div class="text-sm font-semibold">生成内容</div>
                <div class="text-xs text-[var(--app-text-muted)]">AI 自动续写</div>
              </div>
            </div>

            <!-- 一致性检查 -->
            <div 
              class="group bg-[var(--app-surface-muted)] border border-[var(--app-border)] rounded-[var(--app-radius)] transition-all duration-200 hover:border-[rgba(79,138,118,0.28)] shadow-sm hover:shadow-md cursor-pointer overflow-hidden"
              @click="handleConsistency"
            >
              <div class="p-4 space-y-2">
                <div class="flex items-center justify-between">
                  <div class="p-2 rounded-lg bg-orange-100 group-hover:bg-orange-200 transition-colors">
                    <el-icon class="text-orange-600 text-lg"><Search /></el-icon>
                  </div>
                  <el-icon 
                    v-if="processing" 
                    class="is-loading text-[var(--app-text-muted)] text-sm"
                  >
                    <Loading />
                  </el-icon>
                </div>
                <div class="text-sm font-semibold">一致性检查</div>
                <div class="text-xs text-[var(--app-text-muted)]">检查内容一致性</div>
              </div>
            </div>
          </div>
        </el-collapse-item>
        <el-collapse-item name="reio">
          <template #title>
            <span class="text-xs font-semibold">ReIO 质量检查</span>
            <el-tag v-if="reioStats.totalChecks > 0" size="small" type="success" class="ml-2">
              {{ reioStats.passRate }}%
            </el-tag>
          </template>
          <div class="p-3 space-y-3">
            <!-- 统计概览 -->
            <div class="grid grid-cols-3 gap-2 text-center">
              <div class="bg-[var(--app-surface-muted)] border border-[var(--app-border)] rounded-[var(--app-radius)] transition-all duration-200 hover:border-[rgba(79,138,118,0.28)] hover:shadow-[0_10px_24px_rgba(32,30,25,0.08)] p-2 rounded-lg">
                <div class="text-lg font-bold text-blue-500">{{ reioStats.totalChecks }}</div>
                <div class="text-xs text-[var(--app-text-muted)]">检查次数</div>
              </div>
              <div class="bg-[var(--app-surface-muted)] border border-[var(--app-border)] rounded-[var(--app-radius)] transition-all duration-200 hover:border-[rgba(79,138,118,0.28)] hover:shadow-[0_10px_24px_rgba(32,30,25,0.08)] p-2 rounded-lg">
                <div class="text-lg font-bold text-green-500">{{ reioStats.passCount }}</div>
                <div class="text-xs text-[var(--app-text-muted)]">通过</div>
              </div>
              <div class="bg-[var(--app-surface-muted)] border border-[var(--app-border)] rounded-[var(--app-radius)] transition-all duration-200 hover:border-[rgba(79,138,118,0.28)] hover:shadow-[0_10px_24px_rgba(32,30,25,0.08)] p-2 rounded-lg">
                <div class="text-lg font-bold text-orange-500">{{ reioStats.rewriteCount }}</div>
                <div class="text-xs text-[var(--app-text-muted)]">重写</div>
              </div>
            </div>
            
            <!-- 最近检查 -->
            <div v-if="reioStats.lastCheck" class="bg-[var(--app-surface-muted)] border border-[var(--app-border)] rounded-[var(--app-radius)] transition-all duration-200 hover:border-[rgba(79,138,118,0.28)] hover:shadow-[0_10px_24px_rgba(32,30,25,0.08)] p-3 rounded-lg">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-semibold">最近检查</span>
                <el-tag :type="reioStats.lastCheck.passed ? 'success' : 'warning'" size="small">
                  {{ reioStats.lastCheck.passed ? '通过' : '需改进' }}
                </el-tag>
              </div>
              <div class="text-xs text-[var(--app-text-muted)]">
                得分: {{ reioStats.lastCheck.score }}/100
              </div>
              <div v-if="reioStats.lastCheck.issues?.length" class="mt-2 space-y-1">
                <div v-for="(issue, i) in reioStats.lastCheck.issues.slice(0, 3)" :key="i" 
                     class="text-xs text-orange-600 flex items-start gap-1">
                  <el-icon class="mt-0.5"><Warning /></el-icon>
                  {{ issue }}
                </div>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="flex gap-2">
              <el-button size="small" @click="runReioCheck" :loading="reioChecking" :disabled="!props.chapterId" class="flex-1">
                <el-icon><Refresh /></el-icon>
                执行检查
              </el-button>
              <el-button size="small" @click="resetReioStats" type="info" plain>
                重置
              </el-button>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>
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
          <div class="text-sm font-semibold text-[var(--app-text-muted)] mb-2">选中的文字：</div>
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
          <div class="text-sm font-semibold text-[var(--app-text-muted)] mb-2">
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
          <div class="text-xs text-[var(--app-text-muted)] mt-1">
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
import { callChatModel } from '@/llm/client';
import { chapterSkills } from '@/llm/prompts/chapter';
import { Brush, Cpu, InfoFilled, Loading, Plus, Refresh, Search, Warning } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ref, onMounted } from 'vue';

// ... other imports ...

// ... inside script setup ...

onMounted(() => {
  if (props.novelId) {
    loadReIOStats()
  }
})

// Keep closing script tag


const props = defineProps<{
  novelId?: string
  chapterId?: string | null
  chapterTitle?: string
  chapterContent?: string
  selectedText?: string
  novelTitle?: string
}>()

const emit = defineEmits<{
  (e: 'chapter-generated', chapter: any): void
  (e: 'content-updated', content: string): void
}>()

const processing = ref(false)
const showDialog = ref(false)
const dialogType = ref<'continue' | 'polish' | 'consistency'>('continue')
const dialogTitle = ref('')
const dialogPrompt = ref('')
const lastAction = ref('')
const lastActionAt = ref<number | null>(null)
const activeSections = ref(['tools'])

// ReIO 相关状态
interface ReICheckResult {
  passed: boolean;
  score: number;
  issues: string[];
}

interface ReIOStats {
  totalChecks: number;
  passCount: number;
  rewriteCount: number;
  passRate: number;
  lastCheck: ReICheckResult | null;
}

const reioStats = ref<ReIOStats>({
  totalChecks: 0,
  passCount: 0,
  rewriteCount: 0,
  passRate: 100,
  lastCheck: null
})
const reioLoading = ref(false)
const reioChecking = ref(false)

// 加载 ReIO 统计
async function loadReIOStats() {
  if (!props.novelId) return
  
  reioLoading.value = true
  try {
    if (window.electronAPI?.reio?.getStats) {
      const stats = await window.electronAPI.reio.getStats()
      if (stats) {
        reioStats.value = {
          totalChecks: stats.totalChecks || 0,
          passCount: stats.passedChecks || 0,
          rewriteCount: stats.totalRewrites || 0,
          passRate: stats.totalChecks > 0 
            ? Math.round((stats.passedChecks / stats.totalChecks) * 100) 
            : 100,
          lastCheck: stats.lastCheckResult || null
        }
      }
    }
  } catch (error) {
    console.error('加载 ReIO 统计失败:', error)
  } finally {
    reioLoading.value = false
  }
}

// 执行 ReIO 检查
async function runReioCheck() {
  if (!props.novelId || !props.chapterId || !props.chapterContent) {
    ElMessage.warning('请先选择章节并输入内容')
    return
  }

  reioChecking.value = true
  try {
    if (window.electronAPI?.reio?.check) {
      // 构建上下文
      const { outlineContext, memoryContext } = await buildGenerationContext()
      
      const result = await window.electronAPI.reio.check({
        novelId: props.novelId,
        generatedText: props.chapterContent,
        eventGoal: outlineContext || '无明确目标',
        memoryContext: memoryContext || '',
        activeCharacters: [], // 可以从上下文提取，或由后端提取
        worldRules: [] // 后端会自动提取
      })

      if (result) {
        reioStats.value.totalChecks++
        if (result.passed) {
          reioStats.value.passCount++
        }
        reioStats.value.passRate = Math.round(
          (reioStats.value.passCount / reioStats.value.totalChecks) * 100
        )
        reioStats.value.lastCheck = {
          passed: result.passed,
          score: result.score || 0,
          issues: result.issues || []
        }

        if (result.passed) {
          ElMessage.success(`检查通过！得分: ${result.score}/100`)
        } else {
          ElMessage.warning(`发现 ${result.issues?.length || 0} 个问题需要改进`)
        }
      }
    }
  } catch (error: any) {
    console.error('ReIO 检查失败:', error)
    ElMessage.error('检查失败: ' + (error.message || '未知错误'))
  } finally {
    reioChecking.value = false
  }
}

// 重置 ReIO 统计
function resetReioStats() {
  reioStats.value = {
    totalChecks: 0,
    passCount: 0,
    rewriteCount: 0,
    passRate: 100,
    lastCheck: null
  }
  ElMessage.success('统计已重置')
}

const getDialogPlaceholder = () => {
  const placeholders = {
    continue: '例如：\n• 让主角遇到一个神秘老人\n• 增加一段环境描写\n• 让对话更加生动\n• 延续当前情节发展',
    polish: '例如：\n• 让文字更加优美\n• 增加细节描写\n• 优化对话表达\n• 提升文笔水平',
    consistency: '例如：\n• 检查人物名称是否一致\n• 检查时间线是否合理\n• 检查世界观设定\n• 检查情节逻辑'
  }
  return placeholders[dialogType.value] || ''
}

const getDialogHint = () => {
  const hints = {
    continue: '留空则使用默认续写逻辑，输入提示可指导 AI 续写方向',
    polish: '留空则使用默认润色逻辑，输入要求可指定润色重点',
    consistency: '留空则进行全面检查，输入重点可指定检查范围'
  }
  return hints[dialogType.value] || ''
}

const buildContextForChapter = async (chapterId: string | null) => {
  if (!props.novelId || !chapterId) {
    return { outlineContext: '', memoryContext: '' }
  }
  
  try {
    const result = await window.electronAPI.planning.buildContext(props.novelId, chapterId)
    return result
  } catch (error) {
    console.error('获取上下文失败:', error)
    return { outlineContext: '', memoryContext: '' }
  }
}

const buildGenerationContext = async () => {
  if (!props.chapterId || !window.electronAPI?.chapter) {
    return { chapterNumber: null, outlineContext: '', memoryContext: '' }
  }

  const chapter = await window.electronAPI.chapter.get(props.chapterId)
  const chapterNumber = chapter?.chapterNumber ?? null
  
  const { outlineContext, memoryContext } = await buildContextForChapter(props.chapterId)

  return {
    chapterNumber,
    outlineContext,
    memoryContext
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
    let actionResult: string | null = null
    switch (dialogType.value) {
      case 'continue':
        actionResult = await executeContinue()
        break
      case 'polish':
        actionResult = await executePolish()
        break
      case 'consistency':
        actionResult = await executeConsistency()
        break
    }
    if (actionResult) {
      lastAction.value = actionResult
      lastActionAt.value = Date.now()
    }
  } catch (error: any) {
    ElMessage.error('执行失败: ' + (error.message || '未知错误'))
  } finally {
    processing.value = false
  }
}


const executeContinue = async () => {
  if (!props.chapterId) {
    ElMessage.warning('请先选择章节')
    return null
  }

  const prompt = dialogPrompt.value.trim()
  const { chapterNumber, outlineContext, memoryContext } = await buildGenerationContext()
  const systemPrompt = chapterSkills.continue.systemPrompt
  const userPrompt = chapterSkills.continue.buildUserPrompt({
    novelTitle: props.novelTitle,
    chapterTitle: props.chapterTitle,
    chapterNumber,
    content: props.chapterContent || '',
    outlineContext,
    memoryContext,
    extraPrompt: prompt
  })

  const newText = await callChatModel(systemPrompt, userPrompt)
  const trimmed = newText.trim()
  if (!trimmed) {
    ElMessage.warning('未生成有效续写内容')
    return null
  }

  const separator = props.chapterContent?.endsWith('\n') ? '\n' : '\n\n'
  emit('content-updated', props.chapterContent + separator + trimmed)
  ElMessage.success('续写完成')
  return '续写完成'
}


const executePolish = async () => {
  if (!props.chapterId || !props.chapterContent) {
    ElMessage.warning('请先选择章节并输入内容')
    return null
  }

  const prompt = dialogPrompt.value.trim()
  const textToPolish = props.selectedText || props.chapterContent

  const systemPrompt = chapterSkills.polish.systemPrompt
  const userPrompt = chapterSkills.polish.buildUserPrompt({
    text: textToPolish,
    extraPrompt: prompt
  })

  const polishedText = (await callChatModel(systemPrompt, userPrompt)).trim()
  if (!polishedText) {
    ElMessage.warning('未生成有效润色内容')
    return null
  }

  if (props.selectedText) {
    const originalContent = props.chapterContent || ''
    const firstIndex = originalContent.indexOf(props.selectedText)
    const newContent = firstIndex >= 0
      ? originalContent.slice(0, firstIndex) + polishedText + originalContent.slice(firstIndex + props.selectedText.length)
      : originalContent + polishedText
    emit('content-updated', newContent)
    ElMessage.success('选中文字润色完成')
    return '选中文字润色完成'
  }
  emit('content-updated', polishedText)
  ElMessage.success('润色完成')
  return '润色完成'
}

const executeConsistency = async () => {
  if (!props.chapterId || !props.chapterContent) {
    ElMessage.warning('请先选择章节并输入内容')
    return null
  }

  const prompt = dialogPrompt.value.trim()
  const systemPrompt = chapterSkills.consistency.systemPrompt
  const userPrompt = chapterSkills.consistency.buildUserPrompt({
    novelTitle: props.novelTitle,
    content: props.chapterContent,
    extraPrompt: prompt
  })

  const result = (await callChatModel(systemPrompt, userPrompt)).trim()
  if (!result) {
    ElMessage.warning('未生成一致性检查结果')
    return null
  }

  await ElMessageBox.alert(result, '一致性检查结果', {
    confirmButtonText: '知道了',
    dangerouslyUseHTMLString: false
  })
  return '一致性检查完成'
}


const handleGenerateNextChapter = () => {
  if (!props.chapterId || !props.chapterContent) {
    ElMessage.warning('请先选择章节并输入内容')
    return
  }
  dialogType.value = 'continue'
  dialogTitle.value = 'AI 续写内容'
  dialogPrompt.value = ''
  showDialog.value = true
}

</script>


