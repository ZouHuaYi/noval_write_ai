<template>
  <el-container class="h-screen w-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
    <el-header class="h-14 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center px-4 justify-between flex-none z-10">
      <div class="flex items-center gap-3">
        <el-icon class="text-xl text-primary"><Cpu /></el-icon>
        <span class="font-bold text-lg text-gray-800 dark:text-gray-100">自动化流水线</span>
        <el-tag size="small" type="info" effect="plain">Pipeline v1.0</el-tag>
      </div>
      <div class="flex items-center gap-2">
        <!-- Placeholder for global layout actions if needed -->
      </div>
    </el-header>
    
    <el-main class="p-0 relative overflow-hidden flex flex-col">
      <router-view v-slot="{ Component }">
        <transition name="el-fade-in" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </el-main>
  </el-container>
</template>

<script setup>
import { Cpu } from '@element-plus/icons-vue'
// 独立流水线布局
</script>

<style scoped>
/* Ensure layout takes full space */
:deep(.el-main) {
  display: flex;
  flex-direction: column;
}
</style>
