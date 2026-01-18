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
                <div class="text-sm font-semibold">生成章节内容</div>
                <div class="text-xs text-[var(--app-text-muted)]">基于规划生成内容</div>
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
              
              <div v-if="currentPlan.events?.length" class="flex flex-wrap gap-1">
                <el-tag 
                  v-for="evt in currentPlan.events" 
                  :key="evt" 
                  size="small" 
                  type="warning" 
                  effect="plain"
                  class="text-xs"
                >
                  {{ evt }}
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
                 <el-collapse-item name="1" v-if="previewContext.outlineContext">
                   <template #title>
                     <span class="text-xs text-purple-800">大纲上下文 ({{ previewContext.outlineContext.length }} chars)</span>
                   </template>
                   <div class="text-xs text-gray-600 max-h-32 overflow-y-auto whitespace-pre-wrap">
                     {{ previewContext.outlineContext }}
                   </div>
                 </el-collapse-item>
                 <el-collapse-item name="2" v-if="previewContext.memoryContext">
                   <template #title>
                     <span class="text-xs text-purple-800">记忆上下文 ({{ previewContext.memoryContext.length }} chars)</span>
                   </template>
                   <div class="text-xs text-gray-600 max-h-32 overflow-y-auto whitespace-pre-wrap">
                     {{ previewContext.memoryContext }}
                   </div>
                 </el-collapse-item>
                 <el-collapse-item name="3" v-if="previewContext.worldviewContext">
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

    <!-- 章节完成确认对话框 -->
    <el-dialog
      v-model="showCompletionConfirmDialog"
      title="计划完成建议"
      width="400px"
      append-to-body
    >
      <div class="flex gap-3">
        <el-icon class="text-success text-2xl mt-1"><Check /></el-icon>
        <div>
          <div class="text-base font-bold mb-2">是否标记为完成？</div>
          <div class="text-sm text-gray-600 leading-relaxed">
            AI 检测到当前情节已较好地完成了规划目标，是否将该章节计划标记为"已完成"？
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-between items-center w-full">
          <el-checkbox v-model="dontShowCompletionPrompt">不再提示</el-checkbox>
          <div class="flex gap-2">
            <el-button @click="showCompletionConfirmDialog = false">暂不标记</el-button>
            <el-button type="primary" @click="confirmCompletion">标记为完成</el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <!-- 上下文摘要对话框 -->
    <el-dialog
      v-model="showContextSummaryDialog"
      title="本次生成引用的上下文"
      width="600px"
    >
      <div v-if="contextSummaryData" class="space-y-4">
        <div v-if="contextSummaryData.outline" class="bg-blue-50 p-3 rounded-lg border border-blue-100">
          <div class="font-bold text-blue-800 mb-1 flex items-center gap-1">
            <el-icon><List /></el-icon> 引用大纲
          </div>
          <div class="text-sm text-blue-900 leading-relaxed whitespace-pre-wrap">{{ contextSummaryData.outline }}</div>
        </div>
        
        <div v-if="contextSummaryData.memory" class="bg-amber-50 p-3 rounded-lg border border-amber-100">
          <div class="font-bold text-amber-800 mb-1 flex items-center gap-1">
            <el-icon><Cpu /></el-icon> 引用记忆
          </div>
          <div class="text-sm text-amber-900 leading-relaxed whitespace-pre-wrap">{{ contextSummaryData.memory }}</div>
        </div>

        <div v-if="contextSummaryData.rules" class="bg-purple-50 p-3 rounded-lg border border-purple-100">
          <div class="font-bold text-purple-800 mb-1 flex items-center gap-1">
            <el-icon><Warning /></el-icon> 引用规则
          </div>
          <div class="text-sm text-purple-900 leading-relaxed whitespace-pre-wrap">{{ contextSummaryData.rules }}</div>
        </div>
        
        <!-- 兜底显示 -->
        <div v-if="typeof contextSummaryData === 'string'" class="bg-gray-50 p-3 rounded-lg border border-gray-100">
           <div class="text-sm text-gray-700 whitespace-pre-wrap">{{ contextSummaryData }}</div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showContextSummaryDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { callChatModel } from '@/llm/client'
import { chapterSkills } from '@/llm/prompts/chapter'
import { Brush, Calendar, Cpu, Loading, Plus, Refresh, Search, Warning, List, Check } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, ref } from 'vue'


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
const currentPlan = ref<any>(null)
const loadingPlan = ref(false)
const previewContext = ref<{
  outlineContext: string
  memoryContext: string
  worldviewContext: string
} | null>(null)
const loadingContext = ref(false)

// Completion Dialog
const showCompletionConfirmDialog = ref(false)
const dontShowCompletionPrompt = ref(false)
const completionTargetChapter = ref<{ novelId: string; chapterNumber: number } | null>(null)

// 上下文摘要显示
const showContextSummaryDialog = ref(false)
const contextSummaryData = ref<any>(null)

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
  const systemPrompt = chapterSkills.continue.systemPrompt

  if (!props.novelId || !window.electronAPI?.chapter?.generateChunks) {
    ElMessage.warning('写作服务未就绪，请稍后重试')
    return null
  }

  const result = await window.electronAPI.chapter.generateChunks({
    novelId: props.novelId,
    chapterId: props.chapterId,
    novelTitle: props.novelTitle,
    chunkSize: 1200,
    maxChunks: 1,
    extraPrompt: prompt,
    systemPrompt
  })

  // 处理上下文摘要
  if (result?.contextSummary) {
    const summary = result.contextSummary
    contextSummaryData.value = {
      outline: summary.outlineContext || '',
      memory: summary.memoryContext || summary.planningContext || '',
      rules: summary.knowledgeContext || ''
    }
    showContextSummaryDialog.value = true
  }


  const updatedContent = result?.chapter?.content
  if (!updatedContent) {
    ElMessage.warning('未生成有效续写内容')
    return null
  }

  // 建议完成计划
  if (result?.planCompletionSuggested && props.novelId) {
    // 获取章节号
    const chapter = await window.electronAPI.chapter.get(props.chapterId)
    if (chapter?.chapterNumber) {
      // 检查设置
      let promptDisabled = false
      try {
        promptDisabled = await window.electronAPI.settings.get('writing:completionPromptDisabled')
      } catch (e) {
        console.error('读取设置失败', e)
      }

      if (!promptDisabled) {
        completionTargetChapter.value = { novelId: props.novelId, chapterNumber: chapter.chapterNumber }
        showCompletionConfirmDialog.value = true
      }
    }
  }

  emit('content-updated', updatedContent)
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
    const [plan, context] = await Promise.all([
      window.electronAPI.planning.getChapterPlan(props.novelId, chapter.chapterNumber),
      buildContextForChapter(props.chapterId)
    ])
    
    if (plan) {
      currentPlan.value = plan
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

const confirmCompletion = async () => {
  showCompletionConfirmDialog.value = false
  if (completionTargetChapter.value) {
    const { novelId, chapterNumber } = completionTargetChapter.value
    await window.electronAPI.planning.updateChapterStatus(novelId, chapterNumber, 'completed')
    ElMessage.success('已更新章节状态')
    
    if (dontShowCompletionPrompt.value) {
      await window.electronAPI.settings.set('writing:completionPromptDisabled', true, '不再提示章节计划完成建议')
    }
  }
}

</script>


