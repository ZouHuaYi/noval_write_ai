<template>
  <div class="polish-diff-viewer">
    <!-- 头部统计信息 -->
    <div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <el-icon class="text-blue-600"><Document /></el-icon>
          <span class="text-sm font-semibold text-blue-800">润色预览</span>
        </div>
        <div class="flex items-center gap-3 text-xs text-blue-600">
          <span>原文: {{ originalLength }} 字</span>
          <span>润色后: {{ polishedLength }} 字</span>
          <span :class="lengthDiff > 0 ? 'text-green-600' : lengthDiff < 0 ? 'text-orange-600' : ''">
            {{ lengthDiff > 0 ? '+' : '' }}{{ lengthDiff }} 字
          </span>
        </div>
      </div>
    </div>

    <!-- 对比显示 -->
    <div class="grid grid-cols-2 gap-4 mb-4">
      <!-- 原文 -->
      <div class="border border-gray-200 rounded-lg overflow-hidden">
        <div class="bg-red-50 px-3 py-2 border-b border-red-200">
          <span class="text-sm font-semibold text-red-700">原文</span>
        </div>
        <div class="p-3 bg-white max-h-96 overflow-y-auto">
          <div class="text-sm leading-relaxed whitespace-pre-wrap text-gray-700 line-through">
            {{ originalText }}
          </div>
        </div>
      </div>

      <!-- 润色后 -->
      <div class="border border-gray-200 rounded-lg overflow-hidden">
        <div class="bg-green-50 px-3 py-2 border-b border-green-200">
          <span class="text-sm font-semibold text-green-700">润色后</span>
        </div>
        <div class="p-3 bg-white max-h-96 overflow-y-auto">
          <div class="text-sm leading-relaxed whitespace-pre-wrap text-gray-900">
            {{ polishedText }}
          </div>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="flex justify-end gap-2">
      <el-button @click="handleReject">
        拒绝
      </el-button>
      <el-button type="primary" @click="handleAccept">
        <el-icon class="mr-1"><Check /></el-icon>
        应用润色
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Document, Check } from '@element-plus/icons-vue'
import { computed } from 'vue'

const props = defineProps<{
  originalText: string
  polishedText: string
}>()

const emit = defineEmits<{
  (e: 'accept'): void
  (e: 'reject'): void
}>()

const originalLength = computed(() => {
  return props.originalText.replace(/[\s\p{P}]/gu, '').length
})

const polishedLength = computed(() => {
  return props.polishedText.replace(/[\s\p{P}]/gu, '').length
})

const lengthDiff = computed(() => {
  return polishedLength.value - originalLength.value
})

function handleAccept() {
  emit('accept')
}

function handleReject() {
  emit('reject')
}
</script>

