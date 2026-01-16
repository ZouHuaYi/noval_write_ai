<template>
  <div class="h-full flex flex-col app-shell">
    <div class="h-14 app-header flex items-center px-6 flex-shrink-0">
      <div class="flex items-center space-x-3">
        <div class="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
          <span class="text-emerald-700 font-semibold">文</span>
        </div>
        <div>
          <div class="text-sm app-muted">创作工作台</div>
          <h1 class="text-lg font-semibold">小说管理</h1>
        </div>
      </div>
    </div>
    <div class="flex-1 overflow-hidden">
      <router-view />
    </div>
  </div>
</template>


<script setup>
// 简化的布局，只显示小说管理内容
</script>
