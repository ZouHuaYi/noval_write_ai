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
            <div>• 点击卡片可输入你的需求，AI 将根据提示生成建议（当前为占位逻辑）</div>
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
import { Brush, Cpu, InfoFilled, List, Loading, Warning } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { ref, watch } from 'vue';

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
// 获取大纲内容
const getOutlineContent = async () => {
  if (!props.outlineId) return ''
  try { 
    if (window.electronAPI?.outline) {
      const outline = await window.electronAPI.outline.get(props.outlineId)
      console.log('outline', outline)
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
  try {
    const systemPrompt = `
你是【小说章节阶段大纲 Agent】。

你的职责是：
为“指定章节区间”生成【写作指导型大纲】，用于后续章节创作与剧情一致性维护。

你不是：
- 全书大纲设计者
- 世界观创造者
- 具体章节作者

==============================
【核心约束（必须遵守）】
1. 你只对给定的章节范围负责
2. 不得提前解决长期主线或终极矛盾
3. 不得输出正文、对白、具体场景描写
4. 不得引入当前阶段无法验证的新世界规则

==============================
【你允许做的事】
- 规划阶段性剧情目标
- 拆解关键剧情节点（事件级）
- 指导人物关系与状态变化方向
- 设计伏笔，但不回收长期伏笔

==============================
【输出定位】
你的输出将被下游 Agent 用于：
- 章节拆分
- 事件抽取
- 角色状态管理
- 一致性校验

因此，输出必须：
- 结构清晰
- 因果明确
- 可被程序解析和再利用

==============================
【默认输出结构（Markdown）】

## 一、阶段目标
- 主线目标：
- 主角状态变化（起点 → 终点）：

## 二、核心冲突
- 主冲突：
- 次级冲突（可选）：

## 三、关键剧情节点（有序）
- 节点 1：
  - 触发：
  - 概述：
  - 影响：
- 节点 2：
  ...

## 四、人物变化
- 角色名：
  - 变化方向：

## 五、伏笔与信息控制
- 新伏笔：
- 延迟揭示的信息：

## 六、节奏与情绪
- 节奏建议：
- 情绪曲线：

==============================
如果输入信息不足，请在不发散世界观的前提下，做最小合理补全。
`;

const userPrompt = `
【任务类型】
章节区间大纲规划

【小说标题】
${outlineInfo.value.title}

【章节范围】
第 ${outlineInfo.value.startChapter} 章 ～ 第 ${outlineInfo.value.endChapter} 章

【作者提示】
${dialogPrompt.value.trim() || "（无写作要求提示）"}

请基于以上信息，
仅针对【本章节范围】生成写作指导型大纲。
`;

/** 传给AI的提示 */

  } catch (e) {}
}

const handlePolishOutline = async () => {
  if (!ensureOutlineSelected()) return
  try {
    const prompt = dialogPrompt.value.trim()
    ElMessage.info(
      prompt
        ? `按照要求优化大纲（示例）：${prompt}`
        : '正在整体优化大纲结构和文案（示例）'
    )
    await new Promise(resolve => setTimeout(resolve, 1500))
    ElMessage.success('大纲优化建议已生成（示例）')
  } catch (e) {}
}

const handleCheckLogic = async () => {
  if (!ensureOutlineSelected()) return
  try {
    const prompt = dialogPrompt.value.trim()
    ElMessage.info(
      prompt
        ? `按重点检查大纲逻辑（示例）：${prompt}`
        : '正在进行大纲逻辑与设定检查（示例）'
    )
    await new Promise(resolve => setTimeout(resolve, 1500))
    ElMessage.success('逻辑检查完成（示例）')
  } catch (e) {}
}
</script>

<style scoped>
@media (max-width: 640px) {
  .grid-cols-2 {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
}
</style>

