<template>
  <teleport to="body">
    <transition name="tour-fade">
      <div v-if="isActive && !dismissed" class="tour-guide-overlay" @click="handleOverlayClick">
        <!-- 高亮区域遮罩 -->
        <div class="tour-spotlight" :style="spotlightStyle"></div>

        <!-- 提示卡片 -->
        <div 
          class="tour-card" 
          :style="cardStyle"
          @click.stop
        >
          <div class="tour-header">
            <div class="tour-step">步骤 {{ currentStep + 1 }} / {{ steps.length }}</div>
            <el-button text @click="skipTour">
              <el-icon><Close /></el-icon>
            </el-button>
          </div>

          <div class="tour-content">
            <h3 class="tour-title">{{ currentStepData.title }}</h3>
            <p class="tour-description">{{ currentStepData.description }}</p>
          </div>

          <div class="tour-footer">
            <el-button 
              v-if="currentStep > 0"
              text 
              @click="prevStep"
            >
              上一步
            </el-button>
            <div class="tour-indicators">
              <span 
                v-for="(_, index) in steps" 
                :key="index"
                class="indicator"
                :class="{ active: index === currentStep }"
              ></span>
            </div>
            <el-button 
              type="primary"
              @click="nextStep"
            >
              {{ isLastStep ? '完成' : '下一步' }}
            </el-button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { Close } from '@element-plus/icons-vue'
import { computed, onMounted, ref, watch } from 'vue'

interface TourStep {
  title: string
  description: string
  target?: string // CSS选择器
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'
}

interface Props {
  steps: TourStep[]
  storageKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  storageKey: 'novel-app-tour-completed'
})

const emit = defineEmits<{
  complete: []
  skip: []
}>()

const isActive = ref(false)
const dismissed = ref(false)
const currentStep = ref(0)

const currentStepData = computed(() => props.steps[currentStep.value])
const isLastStep = computed(() => currentStep.value === props.steps.length - 1)

// 计算高亮位置
const spotlightStyle = ref({})
const cardStyle = ref({})

function updatePositions() {
  const step = currentStepData.value
  
  if (!step.target) {
    // 居中显示
    cardStyle.value = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)'
    }
    spotlightStyle.value = {}
    return
  }

  const element = document.querySelector(step.target)
  if (!element) return

  const rect = element.getBoundingClientRect()
  
  // 高亮区域
  spotlightStyle.value = {
    top: `${rect.top - 8}px`,
    left: `${rect.left - 8}px`,
    width: `${rect.width + 16}px`,
    height: `${rect.height + 16}px`
  }

  // 提示卡片位置
  const cardWidth = 360
  const cardHeight = 200
  const padding = 20

  let top = 0
  let left = 0

  switch (step.position || 'bottom') {
    case 'top':
      top = rect.top - cardHeight - padding
      left = rect.left + rect.width / 2 - cardWidth / 2
      break
    case 'bottom':
      top = rect.bottom + padding
      left = rect.left + rect.width / 2 - cardWidth / 2
      break
    case 'left':
      top = rect.top + rect.height / 2 - cardHeight / 2
      left = rect.left - cardWidth - padding
      break
    case 'right':
      top = rect.top + rect.height / 2 - cardHeight / 2
      left = rect.right + padding
      break
    case 'center':
      top = window.innerHeight / 2 - cardHeight / 2
      left = window.innerWidth / 2 - cardWidth / 2
      break
  }

  // 边界检查
  top = Math.max(padding, Math.min(top, window.innerHeight - cardHeight - padding))
  left = Math.max(padding, Math.min(left, window.innerWidth - cardWidth - padding))

  cardStyle.value = {
    top: `${top}px`,
    left: `${left}px`
  }
}

function nextStep() {
  if (isLastStep.value) {
    completeTour()
  } else {
    currentStep.value++
  }
}

function prevStep() {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

function skipTour() {
  dismissed.value = true
  emit('skip')
  saveTourCompleted()
}

function completeTour() {
  dismissed.value = true
  emit('complete')
  saveTourCompleted()
}

function handleOverlayClick() {
  // 点击遮罩层也跳过引导
  skipTour()
}

function saveTourCompleted() {
  if (props.storageKey) {
    localStorage.setItem(props.storageKey, 'true')
  }
}

function checkShouldShow() {
  if (props.storageKey) {
    const completed = localStorage.getItem(props.storageKey)
    isActive.value = !completed
  } else {
    isActive.value = true
  }
}

watch(currentStep, () => {
  setTimeout(updatePositions, 50)
})

onMounted(() => {
  checkShouldShow()
  if (isActive.value) {
    setTimeout(updatePositions, 100)
  }
})

// 暴露方法供外部调用
defineExpose({
  start() {
    isActive.value = true
    currentStep.value = 0
    dismissed.value = false
    setTimeout(updatePositions, 100)
  },
  reset() {
    if (props.storageKey) {
      localStorage.removeItem(props.storageKey)
    }
    checkShouldShow()
  }
})
</script>

<style scoped>
.tour-guide-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px);
  z-index: 9999;
}

.tour-spotlight {
  position: absolute;
  border-radius: var(--app-radius);
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6);
  pointer-events: none;
  transition: all var(--app-transition-base) ease;
  animation: breathe 2s ease-in-out infinite;
}

.tour-card {
  position: absolute;
  width: 360px;
  background: var(--app-surface);
  border-radius: var(--app-radius-lg);
  box-shadow: var(--app-shadow-lg);
  padding: 24px;
  transition: all var(--app-transition-base) ease;
  animation: scaleIn 0.4s ease-out;
}

.tour-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.tour-step {
  font-size: 12px;
  font-weight: 600;
  color: var(--app-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tour-content {
  margin-bottom: 24px;
}

.tour-title {
  margin: 0 0 12px 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--app-text);
}

.tour-description {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--app-text-muted);
}

.tour-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.tour-indicators {
  display: flex;
  gap: 6px;
  flex: 1;
  justify-content: center;
}

.indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--app-border-strong);
  transition: all var(--app-transition-fast) ease;
}

.indicator.active {
  width: 24px;
  border-radius: 4px;
  background: var(--app-primary);
}

/* 过渡动画 */
.tour-fade-enter-active,
.tour-fade-leave-active {
  transition: opacity var(--app-transition-slow) ease;
}

.tour-fade-enter-from,
.tour-fade-leave-to {
  opacity: 0;
}
</style>
