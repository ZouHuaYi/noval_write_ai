<template>
  <div class="empty-state" :class="size">
    <div class="empty-icon" v-if="!customIcon">
      <slot name="icon">
        <el-icon :size="iconSize">
          <component :is="defaultIcon" />
        </el-icon>
      </slot>
    </div>
    <slot name="custom-icon" v-else></slot>

    <div class="empty-content">
      <h3 class="empty-title">{{ title || '暂无内容' }}</h3>
      <p class="empty-description" v-if="description">{{ description }}</p>
    </div>

    <div class="empty-action" v-if="$slots.action || actionText">
      <slot name="action">
        <el-button 
          v-if="actionText"
          type="primary" 
          @click="$emit('action')"
        >
          {{ actionText }}
        </el-button>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Document } from '@element-plus/icons-vue'
import { computed } from 'vue'

interface Props {
  title?: string
  description?: string
  icon?: any
  actionText?: string
  size?: 'small' | 'medium' | 'large'
  customIcon?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  customIcon: false
})

defineEmits<{
  action: []
}>()

const defaultIcon = computed(() => props.icon || Document)

const iconSize = computed(() => {
  const sizeMap = {
    small: 40,
    medium: 64,
    large: 80
  }
  return sizeMap[props.size]
})
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  animation: fadeIn 0.4s ease-out;
}

.empty-state.small {
  padding: 24px 16px;
}

.empty-state.large {
  padding: 80px 32px;
}

.empty-icon {
  margin-bottom: 24px;
  color: var(--app-text-muted);
  opacity: 0.5;
  animation: scaleIn 0.5s ease-out;
}

.empty-state.small .empty-icon {
  margin-bottom: 16px;
}

.empty-content {
  margin-bottom: 24px;
  max-width: 400px;
}

.empty-state.small .empty-content {
  margin-bottom: 16px;
  max-width: 300px;
}

.empty-title {
  margin: 0 0 12px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--app-text);
}

.empty-state.small .empty-title {
  font-size: 16px;
  margin-bottom: 8px;
}

.empty-state.large .empty-title {
  font-size: 24px;
  margin-bottom: 16px;
}

.empty-description {
  margin: 0;
  font-size: 14px;
  color: var(--app-text-muted);
  line-height: 1.6;
}

.empty-state.small .empty-description {
  font-size: 13px;
}

.empty-state.large .empty-description {
  font-size: 16px;
}

.empty-action {
  animation: fadeSlideIn 0.6s ease-out;
}
</style>
