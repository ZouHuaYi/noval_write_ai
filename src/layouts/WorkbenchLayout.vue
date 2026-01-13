<template>
  <div class="h-screen flex bg-gray-50 text-sm overflow-hidden">
    <!-- 左侧：资料区 -->
    <div class="w-64 min-w-[240px] max-w-[320px] border-r border-gray-200/60 bg-white flex flex-col overflow-hidden shadow-sm">
      <slot name="left" />
    </div>

    <!-- 中间：写作区 -->
    <div class="flex-1 flex flex-col overflow-hidden min-w-0">
      <slot name="center" />
    </div>

    <!-- 右侧：AI / Agent -->
    <div class="w-80 min-w-[280px] max-w-[400px] border-l border-gray-200/60 bg-white flex flex-col overflow-hidden shadow-sm">
      <slot name="right" />
    </div>
  </div>
</template>

<script setup lang="ts">
// 三栏布局容器
</script>

<style scoped>
/* 使用 UnoCSS，这里可以留空 */
</style>
