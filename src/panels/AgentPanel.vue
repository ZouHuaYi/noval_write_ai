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
              :class="{ 'pointer-events-none opacity-60': processing }"
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
                <div class="text-xs text-[var(--app-text-muted)]">
                  {{ props.editorMode === 'rich' ? '请切换到纯文本模式' : '优化文字表达' }}
                </div>
              </div>
            </div>

            <!-- 生成内容 -->
            <div 
              class="group bg-[var(--app-surface-muted)] border border-[var(--app-border)] rounded-[var(--app-radius)] transition-all duration-200 hover:border-[rgba(79,138,118,0.28)] border-2 border-emerald-300 shadow-md hover:shadow-lg cursor-pointer overflow-hidden bg-emerald-50/60"
              :class="{ 'pointer-events-none opacity-60': processing }"
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
                <div class="text-sm font-semibold">生成章节内容</div>
                <div class="text-xs text-[var(--app-text-muted)]">基于规划生成内容</div>
              </div>
            </div>

            <!-- 一致性检查 -->
            <div 
              class="group bg-[var(--app-surface-muted)] border border-[var(--app-border)] rounded-[var(--app-radius)] transition-all duration-200 hover:border-[rgba(79,138,118,0.28)] shadow-sm hover:shadow-md cursor-pointer overflow-hidden"
              :class="{ 'pointer-events-none opacity-60': processing }"
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
        <!-- 章节计划预览 (仅生成时显示) -->
        <div v-if="dialogType === 'continue'" class="space-y-4">
          <div class="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-blue-700 flex items-center gap-1">
                <el-icon><Calendar /></el-icon>
                当前章节规划
              </span>
              <el-tag v-if="currentPlan" size="small" type="primary">{{ currentPlan.title }}</el-tag>
            </div>
            
            <div v-if="loadingPlan" class="py-4 text-center text-blue-400">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span class="text-xs ml-2">正在加载规划...</span>
            </div>
            
            <div v-else-if="currentPlan" class="space-y-2">
              <div class="text-sm text-gray-700 leading-relaxed bg-white/60 p-2 rounded">
                {{ currentPlan.summary || currentPlan.description || '暂无详细规划' }}
              </div>
              
                <div v-if="currentPlanEvents.length" class="flex flex-wrap gap-1">
                  <el-tag 
                    v-for="evt in currentPlanEvents" 
                    :key="evt.id" 
                    size="small" 
                    type="warning" 
                    effect="plain"
                    class="text-xs"
                  >
                    {{ evt.label || evt.id }}
                  </el-tag>
                </div>

              
              <div v-if="currentPlan.focus?.length" class="flex flex-wrap gap-1 mt-1">
                 <span class="text-xs text-blue-600 mr-1">重点:</span>
                 <span v-for="(f, i) in currentPlan.focus" :key="i" class="text-xs text-blue-800 bg-blue-100 px-1 rounded">
                   {{ f }}
                 </span>
              </div>
            </div>
            
            <div v-else class="text-xs text-blue-400 italic text-center py-2">
              该章节暂无特定规划，将基于上下文自由发挥
            </div>
          </div>

          <!-- 上下文预览 -->
          <div class="bg-purple-50/50 p-3 rounded-lg border border-purple-100">
             <div class="flex items-center justify-between mb-2">
               <span class="text-xs font-bold text-purple-700 flex items-center gap-1">
                 <el-icon><List /></el-icon>
                 上下文预览
               </span>
             </div>
             
             <div v-if="loadingContext" class="py-4 text-center text-purple-400">
               <el-icon class="is-loading"><Loading /></el-icon>
               <span class="text-xs ml-2">正在准备上下文...</span>
             </div>
             
             <div v-else-if="previewContext" class="space-y-2">
               <el-collapse class="context-preview-collapse">
                 <el-collapse-item name="1" v-if="previewContext.memoryContext">
                   <template #title>
                     <span class="text-xs text-purple-800">记忆上下文 ({{ previewContext.memoryContext.length }} chars)</span>
                   </template>
                   <div class="text-xs text-gray-600 max-h-32 overflow-y-auto whitespace-pre-wrap">
                     {{ previewContext.memoryContext }}
                   </div>
                 </el-collapse-item>
                 <el-collapse-item name="2" v-if="previewContext.worldviewContext">
                   <template #title>
                     <span class="text-xs text-purple-800">世界观上下文 ({{ previewContext.worldviewContext.length }} chars)</span>
                   </template>
                   <div class="text-xs text-gray-600 max-h-32 overflow-y-auto whitespace-pre-wrap">
                     {{ previewContext.worldviewContext }}
                   </div>
                 </el-collapse-item>
               </el-collapse>
               <div v-if="!previewContext.outlineContext && !previewContext.memoryContext" class="text-xs text-gray-400 italic">
                 无相关上下文信息
               </div>
             </div>
          </div>
        </div>

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

    <!-- 一致性检查 Diff 对话框 -->
    <el-dialog
      v-model="showConsistencyDiffDialog"
      title="一致性检查结果"
      width="900px"
      :close-on-click-modal="false"
    >
      <ConsistencyDiffViewer
        v-if="consistencyDiffResult"
        :result="consistencyDiffResult"
        :chapter-content="props.chapterContent || ''"
        @apply-changes="handleApplyConsistencyChanges"
      />
    </el-dialog>

    <!-- 润色预览对话框 -->
    <el-dialog
      v-model="showPolishDiffDialog"
      title="润色预览"
      width="900px"
      :close-on-click-modal="false"
    >
      <PolishDiffViewer
        v-if="polishDiffData"
        :original-text="polishDiffData.original"
        :polished-text="polishDiffData.polished"
        @accept="handleAcceptPolish"
        @reject="handleRejectPolish"
      />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { callChatModel } from '@/llm/client'
import { chapterSkills } from '@/llm/prompts/chapter'
import type { PromptConfigItem } from '@/llm/promptClient'
import { listPrompts, renderTemplate } from '@/llm/promptClient'
import { Brush, Calendar, Cpu, Loading, Plus, Refresh, Search, Warning, List } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, ref } from 'vue'
import ConsistencyDiffViewer from '@/components/ConsistencyDiffViewer.vue'
import PolishDiffViewer from '@/components/PolishDiffViewer.vue'

// 章节字数默认值与上限
// 统一章节目标字数，避免生成水字
  const DEFAULT_TARGET_WORDS = 1800
  const MAX_TARGET_WORDS = 2000

function normalizeTargetWords(value?: number | null) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return DEFAULT_TARGET_WORDS
  }
    // 统一收敛到 1500-2000 区间
    return Math.min(Math.max(Math.round(numeric), 1500), MAX_TARGET_WORDS)
}

onMounted(() => {
  if (props.novelId) {
    loadReIOStats()
  }
  loadPromptConfigs()
})

const props = defineProps<{
  novelId?: string
  chapterId?: string | null
  chapterTitle?: string
  chapterContent?: string
  selectedText?: string
  selectedFrom?: number
  selectedTo?: number
  editorMode?: 'rich' | 'plain'
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
const currentPlan = ref<any>(null)
const currentPlanEvents = ref<any[]>([])
const loadingPlan = ref(false)
const previewContext = ref<{
  outlineContext: string
  memoryContext: string
  worldviewContext: string
} | null>(null)
const loadingContext = ref(false)
const promptConfigs = ref<PromptConfigItem[]>([])
const promptLoading = ref(false)

// Completion Dialog
const dontShowCompletionPrompt = ref(false)

// 一致性检查 Diff 显示
const showConsistencyDiffDialog = ref(false)
const consistencyDiffResult = ref<any>(null)

// 润色预览显示
const showPolishDiffDialog = ref(false)
const polishDiffData = ref<{ original: string; polished: string } | null>(null)

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
      const { outlineContext, memoryContext, worldviewContext } = await buildGenerationContext()
      
      const result = await window.electronAPI.reio.check({
        novelId: props.novelId,
        generatedText: props.chapterContent,
        eventGoal: outlineContext || '无明确目标',
        memoryContext: memoryContext || '',
        worldviewContext: worldviewContext || '',
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
    return { outlineContext: '', memoryContext: '', worldviewContext: '' }
  }
  
  try {
    const result = await window.electronAPI.planning.buildContext(props.novelId, chapterId)
    return result
  } catch (error) {
    console.error('获取上下文失败:', error)
    return { outlineContext: '', memoryContext: '', worldviewContext: '' }
  }
}

const buildGenerationContext = async () => {
  if (!props.chapterId || !window.electronAPI?.chapter) {
    return { chapterNumber: null, outlineContext: '', memoryContext: '', worldviewContext: '' }
  }

  const chapter = await window.electronAPI.chapter.get(props.chapterId)
  const chapterNumber = chapter?.chapterNumber ?? null
  
  const { outlineContext, memoryContext, worldviewContext } = await buildContextForChapter(props.chapterId)

  return {
    chapterNumber,
    outlineContext,
    memoryContext,
    worldviewContext
  }
}

const handlePolish = () => {
  if (props.editorMode === 'rich') {
    ElMessage.warning('富文本模式下不支持润色功能,请切换到纯文本模式')
    return
  }
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
  // 检查章节内容
  if (!props.chapterContent) {
    ElMessage.warning('请先选择章节并输入内容')
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
      case 'continue': // 
        actionResult = await executeContinue()
        break
      case 'polish': // 润色
        actionResult = await executePolish()
        break
      case 'consistency': // 一致性检查
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
  const systemPrompt = getPromptText('chapter.continue.system', 'systemPrompt', chapterSkills.continue.systemPrompt)

  if (!props.novelId || !window.electronAPI?.chapter?.generateChunks) {
    ElMessage.warning('写作服务未就绪，请稍后重试')
    return null
  }

  const chapter = await window.electronAPI.chapter.get(props.chapterId)
  const chapterNumber = chapter?.chapterNumber ?? null
  let targetWords = DEFAULT_TARGET_WORDS
  if (props.novelId && chapterNumber != null && window.electronAPI?.planning) {
    const [plan, meta] = await Promise.all([
      window.electronAPI.planning.getChapterPlan(props.novelId, chapterNumber),
      window.electronAPI.planning.getMeta(props.novelId)
    ])
    targetWords = normalizeTargetWords(plan?.targetWords ?? meta?.wordsPerChapter)
  }

  const result = await window.electronAPI.chapter.generateChunks({
    novelId: props.novelId,
    chapterId: props.chapterId,
    novelTitle: props.novelTitle,
    extraPrompt: prompt,
    systemPrompt,
    targetWords
  })

  const updatedContent = result?.chapter?.content
  if (!updatedContent) {
    ElMessage.warning('未生成有效续写内容')
    return null
  }
  confirmCompletion({ novelId: props.novelId, chapterNumber: chapter.chapterNumber })
  
  // 直接应用内容，不显示流式对话框
  emit('content-updated', updatedContent)
  
  const wordCount = (result as any)?.totalWords || updatedContent.length
  const paragraphCount = (result as any)?.paragraphCount || 0
  ElMessage.success(`生成完成！共 ${paragraphCount} 段，${wordCount} 字`)
  
  return '续写完成'
}

const executePolish = async () => {
  if (!props.chapterId || !props.chapterContent) {
    ElMessage.warning('请先选择章节并输入内容')
    return null
  }

  const prompt = dialogPrompt.value.trim()
  const textToPolish = props.selectedText || props.chapterContent

  const systemPrompt = getPromptText('chapter.polish.system', 'systemPrompt', chapterSkills.polish.systemPrompt)
  const polishTemplate = getPromptText('chapter.polish.user', 'userPrompt', '')
  const userPrompt = polishTemplate
    ? renderTemplate(polishTemplate, {
      text: textToPolish,
      extraPrompt: prompt || '无'
    })
    : chapterSkills.polish.buildUserPrompt({
      text: textToPolish,
      extraPrompt: prompt
    })

  const polishedText = (await callChatModel(systemPrompt, userPrompt)).trim()
  if (!polishedText) {
    ElMessage.warning('未生成有效润色内容')
    return null
  }

  // 显示预览对话框而不是直接应用
  polishDiffData.value = {
    original: textToPolish,
    polished: polishedText
  }
  showPolishDiffDialog.value = true
  
  return '润色预览已生成'
}

const executeConsistency = async () => {
  if (!props.chapterId || !props.chapterContent) {
    ElMessage.warning('请先选择章节并输入内容')
    return null
  }

  const prompt = dialogPrompt.value.trim()
  
  try {
    const result = await window.electronAPI.chapter.checkConsistencyDiff(
      props.novelId!,
      props.chapterId,
      props.chapterContent,
      prompt
    )
    
    // 显示 Diff 对话框
    consistencyDiffResult.value = result
    showConsistencyDiffDialog.value = true
    
    return '一致性检查完成'
  } catch (error: any) {
    console.error('一致性检查失败:', error)
    ElMessage.error('一致性检查失败: ' + (error.message || '未知错误'))
    return null
  }
}

// 应用一致性检查的修改
const handleApplyConsistencyChanges = (newContent: string) => {
  // 先关闭对话框
  showConsistencyDiffDialog.value = false
  // 更新内容
  emit('content-updated', newContent)
  ElMessage.success('修改已应用,可重新检查')
  // 清空结果,确保下次使用最新内容
  consistencyDiffResult.value = null
}

// 润色预览处理函数
const handleAcceptPolish = () => {
  if (!polishDiffData.value) return
  
  // 应用润色结果
  const polishedText = polishDiffData.value.polished
  
  // 使用位置索引进行精确替换
  if (props.selectedText && props.selectedFrom !== undefined && props.selectedTo !== undefined) {
    const originalContent = props.chapterContent || ''
    const newContent = 
      originalContent.slice(0, props.selectedFrom) + 
      polishedText + 
      originalContent.slice(props.selectedTo)
    emit('content-updated', newContent)
    ElMessage.success('选中文字润色完成')
  } else {
    // 全文润色
    emit('content-updated', polishedText)
    ElMessage.success('润色完成')
  }
  
  // 关闭对话框
  showPolishDiffDialog.value = false
  polishDiffData.value = null
}

const handleRejectPolish = () => {
  showPolishDiffDialog.value = false
  polishDiffData.value = null
  ElMessage.info('已取消润色')
}

const handleGenerateNextChapter = async () => {
  if (!props.chapterId) {
    ElMessage.warning('请先选择章节')
    return
  }
  dialogType.value = 'continue'
  dialogTitle.value = '生成章节内容'
  dialogPrompt.value = ''
  showDialog.value = true

  if (!props.novelId || !window.electronAPI?.planning?.getChapterPlan) return

  // 获取章节计划
  loadingPlan.value = true
  loadingContext.value = true
  currentPlan.value = null
  previewContext.value = null
  
  try {
    const chapter = await window.electronAPI.chapter.get(props.chapterId)
    if (!chapter?.chapterNumber) {
      loadingPlan.value = false
      loadingContext.value = false
      return
    }

    const meta = await window.electronAPI.planning.getMeta(props.novelId)
    const chapterPlan = await window.electronAPI.planning.getChapterPlan(props.novelId, chapter.chapterNumber)
    if (chapterPlan?.lockWritingTarget || meta?.lockWritingTarget) {
      try {
        await ElMessageBox.confirm(
          '当前章节已锁定写作目标。是否继续使用规划目标生成？',
          '写作目标锁定',
          {
            confirmButtonText: '使用规划目标',
            cancelButtonText: '本次解锁',
            type: 'info'
          }
        )
      } catch {
        if (chapterPlan?.lockWritingTarget) {
          await window.electronAPI.planning.updateChapterStatus(props.novelId, chapter.chapterNumber, chapterPlan.status || 'pending', {
            lockWritingTarget: false
          })
        } else {
          await window.electronAPI.planning.updateMeta(props.novelId, {
            ...meta,
            lockWritingTarget: false
          })
        }
      }
    }

    // 并行获取计划和上下文
    const [plan, context, planningData] = await Promise.all([
      window.electronAPI.planning.getChapterPlan(props.novelId, chapter.chapterNumber),
      buildContextForChapter(props.chapterId),
      window.electronAPI.planning.loadData(props.novelId)
    ])
    
    if (plan) {
      currentPlan.value = plan
      if (planningData?.events && Array.isArray(plan.events)) {
        const eventMap = new Map(planningData.events.map((evt: any) => [evt.id, evt]))
        currentPlanEvents.value = plan.events
          .map((id: string) => eventMap.get(id))
          .filter(Boolean)
      } else {
        currentPlanEvents.value = []
      }
    } else {
      currentPlanEvents.value = []
    }
    previewContext.value = context

  } catch (error) {
    if (error !== 'cancel') {
      console.error('获取数据失败:', error)
    }
  } finally {
    loadingPlan.value = false
    loadingContext.value = false
  }
}

// 标记章节完成
const confirmCompletion = async (completionTargetChapter: { novelId: string; chapterNumber: number }) => {
    const { novelId, chapterNumber } = completionTargetChapter
    await window.electronAPI.planning.updateChapterStatus(novelId, chapterNumber, 'completed')
    ElMessage.success('已更新章节状态')
    
    if (dontShowCompletionPrompt.value) {
      await window.electronAPI.settings.set('writing:completionPromptDisabled', true, '不再提示章节计划完成建议')
    }
}

// 加载 Prompt 配置（用于前端提示词可配置）
async function loadPromptConfigs() {
  if (!window.electronAPI?.prompt) return
  promptLoading.value = true
  try {
    promptConfigs.value = await listPrompts()
  } catch (error) {
    console.error('加载 Prompt 配置失败:', error)
  } finally {
    promptLoading.value = false
  }
}

function getPromptText(id: string, field: 'systemPrompt' | 'userPrompt', fallback = '') {
  const item = promptConfigs.value.find(p => p.id === id)
  return item?.[field] || fallback
}

</script>
