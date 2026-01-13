<template>
  <div class="h-full flex flex-col">
    <!-- 简单的标题栏 -->
    <div class="h-12 border-b border-gray-200 bg-white flex items-center px-4 flex-shrink-0">
      <h1 class="text-lg font-bold">小说管理</h1>
    </div>
    <!-- 内容区域 -->
    <div class="flex-1 overflow-hidden">
      <router-view />
    </div>
  </div>
</template>

<script setup>
// 简化的布局，只显示小说管理内容
</script>
