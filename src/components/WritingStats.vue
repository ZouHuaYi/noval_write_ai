<template>
  <div 
    v-if="visible"
    class="writing-stats"
    :class="{ 'is-floating': floating, 'is-expanded': expanded }"
  >
    <!-- 紧凑模式 -->
    <div v-if="!expanded" class="stats-compact" @click="expanded = true">
      <div class="stat-item">
        <el-icon><Document /></el-icon>
        <span>{{ wordCount }}</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <el-icon><Clock /></el-icon>
        <span>{{ readingTime }}分钟</span>
      </div>
    </div>

    <!-- 展开模式 -->
    <div v-else class="stats-expanded">
      <div class="stats-header">
        <h4>写作统计</h4>
        <el-button text @click="expanded = false">
          <el-icon><Close /></el-icon>
        </el-button>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">
            <el-icon><Document /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">总字数</div>
            <div class="stat-value">{{ wordCount.toLocaleString() }}</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">
            <el-icon><Reading /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">段落数</div>
            <div class="stat-value">{{ paragraphCount }}</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">
            <el-icon><Clock /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">阅读时长</div>
            <div class="stat-value">{{ readingTime }}分钟</div>
          </div>
        </div>

        <div v-if="todayWords > 0" class="stat-card stat-today">
          <div class="stat-icon success">
            <el-icon><Edit /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">今日写作</div>
            <div class="stat-value">{{ todayWords.toLocaleString() }}</div>
            <el-progress 
              :percentage="todayProgress" 
              :show-text="false"
              :stroke-width="4"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Clock, Close, Document, Edit, Reading } from '@element-plus/icons-vue'
import { computed, ref } from 'vue'

interface Props {
  content?: string
  visible?: boolean
  floating?: boolean
  todayGoal?: number
}

const props = withDefaults(defineProps<Props>(), {
  content: '',
  visible: true,
  floating: false,
  todayGoal: 2000
})

const expanded = ref(false)

// 计算字数
const wordCount = computed(() => {
  if (!props.content) return 0
  return props.content.replace(/\s/g, '').length
})

// 计算段落数
const paragraphCount = computed(() => {
  if (!props.content) return 0
  return props.content.split('\n').filter(p => p.trim().length > 0).length
})

// 计算阅读时长（按每分钟300字计算）
const readingTime = computed(() => {
  return Math.ceil(wordCount.value / 300)
})

// 今日写作字数（示例，实际应从存储中获取）
const todayWords = ref(1250)

// 今日进度百分比
const todayProgress = computed(() => {
  return Math.min(Math.round((todayWords.value / props.todayGoal) * 100), 100)
})
</script>

<style scoped>
.writing-stats {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  box-shadow: var(--app-shadow-sm);
  transition: all var(--app-transition-base) ease;
}

.writing-stats.is-floating {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 100;
}

/* 紧凑模式 */
.stats-compact {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  cursor: pointer;
  transition: all var(--app-transition-fast) ease;
}

.stats-compact:hover {
  background: var(--app-surface-muted);
  box-shadow: var(--app-shadow);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--app-text);
}

.stat-item .el-icon {
  color: var(--app-primary);
  font-size: 16px;
}

.stat-divider {
  width: 1px;
  height: 16px;
  background: var(--app-border);
}

/* 展开模式 */
.stats-expanded {
  padding: 16px;
  min-width: 320px;
  animation: scaleIn 0.3s ease-out;
}

.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--app-border);
}

.stats-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--app-text);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.stat-card {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: var(--app-surface-muted);
  border-radius: var(--app-radius-sm);
  transition: all var(--app-transition-fast) ease;
}

.stat-card:hover {
  background: var(--app-surface-strong);
  transform: translateY(-2px);
}

.stat-card.stat-today {
  grid-column: 1 / -1;
  background: var(--app-success-soft);
  border: 1px solid var(--app-success);
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--app-primary-soft);
  color: var(--app-primary);
  flex-shrink: 0;
}

.stat-icon.success {
  background: var(--app-success-soft);
  color: var(--app-success);
}

.stat-content {
  flex: 1;
  min-width: 0;
}

.stat-label {
  font-size: 12px;
  color: var(--app-text-muted);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--app-text);
}
</style>
