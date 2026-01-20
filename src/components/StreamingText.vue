<template>
  <div class="streaming-text-container">
    <div class="streaming-content" :class="{ 'is-streaming': isStreaming }">
      <span v-html="displayedHtml"></span>
      <span v-if="isStreaming" class="typing-cursor"></span>
    </div>
    
    <div v-if="isStreaming" class="streaming-controls">
      <el-button 
        size="small" 
        type="danger" 
        text
        @click="stopStreaming"
        class="stop-button"
      >
        <el-icon><CircleClose /></el-icon>
        停止生成
      </el-button>
      <div class="streaming-stats">
        <span class="stat-item">
          <el-icon><Document /></el-icon>
          {{ displayedText.length }} 字
        </span>
        <span class="stat-item">
          <el-icon><Clock /></el-icon>
          {{ elapsedTime }}s
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CircleClose, Clock, Document } from '@element-plus/icons-vue'
import { computed, onUnmounted, ref, watch } from 'vue'

interface Props {
  text: string
  speed?: number // 每个字符的延迟时间（毫秒）
  autoStart?: boolean
  enableHtml?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  speed: 30,
  autoStart: true,
  enableHtml: false
})

const emit = defineEmits<{
  complete: []
  stop: []
}>()

const displayedText = ref('')
const isStreaming = ref(false)
const currentIndex = ref(0)
const intervalId = ref<number | null>(null)
const startTime = ref(0)
const elapsedTime = ref(0)
const elapsedInterval = ref<number | null>(null)

// HTML 转义（如果不启用 HTML）
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// 显示的 HTML 内容
const displayedHtml = computed(() => {
  if (props.enableHtml) {
    return displayedText.value
  }
  return escapeHtml(displayedText.value).replace(/\n/g, '<br>')
})

// 开始流式输出
function startStreaming() {
  if (isStreaming.value) return
  
  isStreaming.value = true
  currentIndex.value = 0
  displayedText.value = ''
  startTime.value = Date.now()
  elapsedTime.value = 0
  
  // 更新计时器
  elapsedInterval.value = window.setInterval(() => {
    elapsedTime.value = Math.floor((Date.now() - startTime.value) / 1000)
  }, 1000)
  
  // 流式输出
  intervalId.value = window.setInterval(() => {
    if (currentIndex.value < props.text.length) {
      displayedText.value += props.text[currentIndex.value]
      currentIndex.value++
    } else {
      stopStreaming(true)
    }
  }, props.speed)
}

// 停止流式输出
function stopStreaming(completed = false) {
  if (intervalId.value) {
    clearInterval(intervalId.value)
    intervalId.value = null
  }
  
  if (elapsedInterval.value) {
    clearInterval(elapsedInterval.value)
    elapsedInterval.value = null
  }
  
  isStreaming.value = false
  
  if (!completed) {
    // 用户手动停止，显示全部内容
    displayedText.value = props.text
    emit('stop')
  } else {
    emit('complete')
  }
}

// 监听文本变化
watch(() => props.text, (newText) => {
  if (props.autoStart && newText) {
    startStreaming()
  }
}, { immediate: props.autoStart })

// 清理
onUnmounted(() => {
  stopStreaming()
})

// 暴露方法
defineExpose({
  start: startStreaming,
  stop: stopStreaming
})
</script>

<style scoped>
.streaming-text-container {
  position: relative;
}

.streaming-content {
  line-height: 1.8;
  color: var(--app-text);
  white-space: pre-wrap;
  word-wrap: break-word;
}

.streaming-content.is-streaming {
  animation: fadeIn 0.3s ease-out;
}

.typing-cursor {
  display: inline-block;
  width: 2px;
  height: 1.2em;
  background: var(--app-primary);
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: blink 1s step-start infinite;
}

.streaming-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding: 12px;
  background: var(--app-surface-muted);
  border-radius: var(--app-radius);
  border: 1px solid var(--app-border);
  animation: fadeSlideIn 0.4s ease-out;
}

.stop-button {
  color: var(--app-danger);
  transition: all var(--app-transition-fast) ease;
}

.stop-button:hover {
  background: rgba(212, 91, 91, 0.1);
  transform: scale(1.05);
}

.streaming-stats {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--app-text-muted);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stat-item .el-icon {
  font-size: 14px;
}
</style>
