<template>
  <div class="consistency-diff-viewer">
    <!-- 总结 -->
    <div v-if="result.summary" class="summary-section">
      <el-alert type="info" :closable="false" show-icon>
        <template #title>检查摘要</template>
        {{ result.summary }}
      </el-alert>
    </div>

    <!-- 操作按钮 -->
    <div class="actions-bar">
      <div class="stats">
        <el-tag type="info">共 {{ suggestions.length }} 条建议</el-tag>
        <el-tag type="success">已同意 {{ acceptedCount }}</el-tag>
        <el-tag type="warning">已拒绝 {{ rejectedCount }}</el-tag>
      </div>
      <div class="buttons">
        <el-button @click="acceptAll" type="primary" size="small">全部同意</el-button>
        <el-button @click="rejectAll" size="small">全部拒绝</el-button>
        <el-button 
          @click="applyChanges" 
          type="success" 
          size="small"
          :disabled="acceptedCount === 0"
        >
          应用修改 ({{ acceptedCount }})
        </el-button>
      </div>
    </div>

    <!-- 冲突警告 -->
    <el-alert 
      v-if="conflicts.length > 0" 
      type="warning" 
      :closable="false"
      class="conflict-alert"
    >
      <template #title>检测到 {{ conflicts.length }} 个冲突</template>
      <div v-for="(conflict, index) in conflicts" :key="index" class="conflict-item">
        <span>{{ conflict.description }}</span>
        <el-button size="small" text type="primary" @click="resolveConflict(conflict)">
          解决冲突
        </el-button>
      </div>
    </el-alert>

    <!-- Diff 列表 -->
    <div class="diff-list">
      <div 
        v-for="(item, index) in suggestions" 
        :key="item.id" 
        class="diff-item"
        :class="{ 
          'accepted': item.status === 'accepted',
          'rejected': item.status === 'rejected',
          'has-conflict': itemHasConflict(item)
        }"
      >
        <!-- 头部 -->
        <div class="diff-header">
          <div class="header-left">
            <el-tag size="small" type="warning">{{ index + 1 }}</el-tag>
            <span class="category">{{ item.category }}</span>
          </div>
          <div class="header-right">
            <el-tag 
              v-if="item.status === 'accepted'" 
              type="success" 
              size="small"
            >
              已同意
            </el-tag>
            <el-tag 
              v-else-if="item.status === 'rejected'" 
              type="info" 
              size="small"
            >
              已拒绝
            </el-tag>
          </div>
        </div>

        <!-- 问题描述 -->
        <div class="issue-description">
          <el-icon><Warning /></el-icon>
          <span>{{ item.issue }}</span>
        </div>

        <!-- Diff 对比 -->
        <div class="diff-container">
          <div class="diff-side diff-original">
            <div class="diff-label">
              <el-icon><Remove /></el-icon>
              原文
            </div>
            <div class="diff-content">{{ item.originalText }}</div>
          </div>
          <div class="diff-divider">
            <el-icon><Right /></el-icon>
          </div>
          <div class="diff-side diff-suggested">
            <div class="diff-label">
              <el-icon><CirclePlus /></el-icon>
              建议修改
            </div>
            <div class="diff-content">{{ item.suggestedText }}</div>
          </div>
        </div>

        <!-- 修改理由 -->
        <div class="reason">
          <el-icon><InfoFilled /></el-icon>
          <span>{{ item.reason }}</span>
        </div>

        <!-- 操作按钮 -->
        <div class="item-actions">
          <el-button 
            @click="accept(item)" 
            type="success" 
            size="small"
            :disabled="item.status === 'accepted'"
          >
            <el-icon><Check /></el-icon>
            同意
          </el-button>
          <el-button 
            @click="reject(item)" 
            size="small"
            :disabled="item.status === 'rejected'"
          >
            <el-icon><Close /></el-icon>
            拒绝
          </el-button>
          <el-button 
            v-if="item.status !== 'pending'"
            @click="reset(item)" 
            size="small"
            text
          >
            重置
          </el-button>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <el-empty 
      v-if="suggestions.length === 0" 
      description="未发现一致性问题"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Warning, Remove, Right, CirclePlus, InfoFilled, Check, Close 
} from '@element-plus/icons-vue'

interface DiffItem {
  id: string
  category: string
  issue: string
  originalText: string
  suggestedText: string
  reason: string
  startIndex?: number
  endIndex?: number
  status: 'pending' | 'accepted' | 'rejected'
  hasConflict?: boolean
}

const props = defineProps<{
  result: {
    summary: string
    suggestions: Array<{
      id: string
      category: string
      issue: string
      originalText: string
      suggestedText: string
      reason: string
      startIndex?: number
      endIndex?: number
    }>
  }
  chapterContent: string
}>()

const emit = defineEmits<{
  (e: 'apply-changes', content: string): void
}>()

const suggestions = ref<DiffItem[]>(
  props.result.suggestions.map(s => ({
    ...s,
    status: 'pending' as const
  }))
)

const acceptedCount = computed(() => 
  suggestions.value.filter(s => s.status === 'accepted').length
)

const rejectedCount = computed(() => 
  suggestions.value.filter(s => s.status === 'rejected').length
)

// 冲突检测
interface Conflict {
  items: DiffItem[]
  type: 'overlap' | 'adjacent'
  description: string
}

const conflicts = computed<Conflict[]>(() => {
  const accepted = suggestions.value.filter(s => s.status === 'accepted')
  const detected: Conflict[] = []
  
  for (let i = 0; i < accepted.length; i++) {
    for (let j = i + 1; j < accepted.length; j++) {
      const item1 = accepted[i]
      const item2 = accepted[j]
      
      // 如果都有位置索引,检查是否重叠
      if (item1.startIndex !== undefined && item2.startIndex !== undefined &&
          item1.endIndex !== undefined && item2.endIndex !== undefined) {
        const overlap = checkOverlap(
          item1.startIndex, item1.endIndex,
          item2.startIndex, item2.endIndex
        )
        
        if (overlap) {
          detected.push({
            items: [item1, item2],
            type: 'overlap',
            description: `"${item1.category}" 和 "${item2.category}" 的修改范围重叠`
          })
          // 标记冲突
          item1.hasConflict = true
          item2.hasConflict = true
        }
      }
    }
  }
  
  return detected
})

function checkOverlap(
  start1: number, end1: number,
  start2: number, end2: number
): boolean {
  return !(end1 <= start2 || end2 <= start1)
}

function itemHasConflict(item: DiffItem): boolean {
  return item.hasConflict === true
}

function resolveConflict(conflict: Conflict) {
  ElMessageBox.confirm(
    '检测到修改范围重叠,请选择保留哪个建议:',
    '冲突解决',
    {
      distinguishCancelAndClose: true,
      confirmButtonText: `保留 "${conflict.items[0].category}"`,
      cancelButtonText: `保留 "${conflict.items[1].category}"`,
      type: 'warning'
    }
  ).then(() => {
    // 保留第一个,拒绝第二个
    conflict.items[1].status = 'rejected'
    conflict.items[1].hasConflict = false
    ElMessage.success('已解决冲突')
  }).catch((action) => {
    if (action === 'cancel') {
      // 保留第二个,拒绝第一个
      conflict.items[0].status = 'rejected'
      conflict.items[0].hasConflict = false
      ElMessage.success('已解决冲突')
    }
  })
}

function accept(item: DiffItem) {
  item.status = 'accepted'
}

function reject(item: DiffItem) {
  item.status = 'rejected'
}

function reset(item: DiffItem) {
  item.status = 'pending'
}

function acceptAll() {
  suggestions.value.forEach(s => s.status = 'accepted')
  ElMessage.success('已全部同意')
}

function rejectAll() {
  suggestions.value.forEach(s => s.status = 'rejected')
  ElMessage.success('已全部拒绝')
}

// 规范化文本,用于匹配
function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')  // 将多个空格/换行符替换为单个空格
    .trim()                 // 去除首尾空格
}

// 查找文本在内容中的位置(支持模糊匹配)
function findTextPosition(content: string, searchText: string): { start: number; end: number } | null {
  // 1. 尝试精确匹配
  const exactIndex = content.indexOf(searchText)
  if (exactIndex !== -1) {
    return { start: exactIndex, end: exactIndex + searchText.length }
  }

  // 2. 尝试规范化后匹配
  const normalizedSearch = normalizeText(searchText)
  const normalizedContent = normalizeText(content)
  const normalizedIndex = normalizedContent.indexOf(normalizedSearch)
  
  if (normalizedIndex !== -1) {
    // 找到规范化后的位置,需要映射回原文位置
    // 这是一个简化实现,在大多数情况下有效
    let charCount = 0
    let normalizedCount = 0
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i]
      const isWhitespace = /\s/.test(char)
      
      if (!isWhitespace || (i > 0 && !/\s/.test(content[i - 1]))) {
        if (normalizedCount === normalizedIndex) {
          const start = i
          // 找到结束位置
          let end = start
          let matchedLength = 0
          for (let j = start; j < content.length && matchedLength < normalizedSearch.length; j++) {
            const c = content[j]
            if (!/\s/.test(c) || (j > start && !/\s/.test(content[j - 1]))) {
              matchedLength++
            }
            end = j + 1
          }
          return { start, end }
        }
        normalizedCount++
      }
      charCount++
    }
  }

  return null
}

function applyChanges() {
  let newContent = props.chapterContent
  
  // 获取所有已同意的建议
  const accepted = suggestions.value.filter(s => s.status === 'accepted')
  
  if (accepted.length === 0) {
    ElMessage.warning('没有需要应用的修改')
    return
  }

  // 收集所有替换位置(从后往前排序,避免位置偏移)
  const replacements: Array<{
    start: number
    end: number
    newText: string
    item: DiffItem
  }> = []

  accepted.forEach(item => {
    let position: { start: number; end: number } | null = null
    
    // 优先使用位置索引
    if (item.startIndex !== undefined && item.endIndex !== undefined) {
      position = { start: item.startIndex, end: item.endIndex }
      
      // 验证位置的准确性
      const extractedText = newContent.substring(position.start, position.end)
      if (normalizeText(extractedText) !== normalizeText(item.originalText)) {
        console.warn('位置索引已失效,回退到文本匹配:', {
          expected: item.originalText.substring(0, 50),
          actual: extractedText.substring(0, 50)
        })
        position = findTextPosition(newContent, item.originalText)
      } else {
        console.log('使用位置索引进行替换:', { start: position.start, end: position.end })
      }
    } else {
      // 回退到文本匹配
      console.log('使用文本匹配进行替换')
      position = findTextPosition(newContent, item.originalText)
    }
    
    if (position) {
      replacements.push({
        start: position.start,
        end: position.end,
        newText: item.suggestedText,
        item
      })
    } else {
      console.warn(`未找到原文片段: ${item.originalText.substring(0, 50)}...`)
      console.warn('章节内容前100字:', newContent.substring(0, 100))
    }
  })

  if (replacements.length === 0) {
    ElMessage.warning('未能应用任何修改,请检查原文是否已变更')
    return
  }

  // 按位置倒序排序,从后往前替换,避免位置偏移
  replacements.sort((a, b) => b.start - a.start)

  // 应用替换
  replacements.forEach(({ start, end, newText }) => {
    newContent = newContent.substring(0, start) + newText + newContent.substring(end)
  })

  emit('apply-changes', newContent)
  ElMessage.success(`已应用 ${replacements.length} 条修改`)
}
</script>

<style scoped>
.consistency-diff-viewer {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 70vh;
  overflow-y: auto;
}

.summary-section {
  margin-bottom: 0.5rem;
}

.actions-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: var(--app-surface-muted);
  border-radius: var(--app-radius);
  border: 1px solid var(--app-border);
}

.stats {
  display: flex;
  gap: 0.5rem;
}

.conflict-alert {
  margin-bottom: 1rem;
}

.conflict-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  font-size: 0.9rem;
}

.conflict-item:not(:last-child) {
  border-bottom: 1px solid var(--el-color-warning-light-5);
}

.buttons {
  display: flex;
  gap: 0.5rem;
}

.diff-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.diff-item {
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  padding: 1rem;
  background: var(--app-surface);
  transition: all 0.2s;
}

.diff-item.accepted {
  border-color: #67c23a;
  background: #f0f9ff;
}

.diff-item.has-conflict {
  border-color: #e6a23c;
  background: #fdf6ec;
}

.diff-item.rejected {
  border-color: #909399;
  background: #f5f5f5;
  opacity: 0.7;
}

.diff-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.category {
  font-weight: 600;
  color: var(--app-text);
}

.issue-description {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #fff7e6;
  border-left: 3px solid #faad14;
  border-radius: 4px;
  margin-bottom: 1rem;
  color: #ad6800;
  font-size: 0.9rem;
}

.diff-container {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.diff-side {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.diff-label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--app-text-muted);
}

.diff-content {
  padding: 0.75rem;
  border-radius: 4px;
  font-size: 0.9rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.diff-original .diff-content {
  background: #fee;
  border-left: 3px solid #f56c6c;
  color: #c03;
}

.diff-suggested .diff-content {
  background: #efe;
  border-left: 3px solid #67c23a;
  color: #060;
}

.diff-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-text-muted);
}

.reason {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--app-surface-muted);
  border-radius: 4px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  color: var(--app-text-muted);
}

.item-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
</style>
