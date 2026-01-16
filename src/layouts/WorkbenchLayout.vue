<template>
  <div class="h-screen flex app-shell text-sm overflow-hidden p-4 gap-4">
    <div class="w-[320px] max-w-[280px] app-panel flex flex-col overflow-y-auto minimal-scrollbar">
      <slot name="left" />
    </div>

    <div class="flex-1 flex flex-col overflow-auto min-w-0 app-panel">
      <slot name="center" />
    </div>

    <div class="w-80 min-w-[280px] max-w-[400px] app-panel flex flex-col overflow-y-auto minimal-scrollbar">
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
