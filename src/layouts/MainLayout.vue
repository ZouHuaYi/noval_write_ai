<template>
  <div class="h-full flex flex-col app-shell overflow-hidden">
    <!-- 自定义标题栏 - 精致版 -->
    <header class="h-9 app-header flex items-center justify-between px-4 flex-shrink-0 select-none bg-gradient-to-r from-emerald-50 to-white">
      <!-- 左侧：应用名称 -->
      <div class="flex items-center space-x-2 no-drag">
        <div class="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm">
          <span class="text-white text-xs font-bold">墨</span>
        </div>
        <h1 class="text-sm font-bold bg-gradient-to-r from-emerald-700 to-emerald-600 bg-clip-text text-transparent">墨写</h1>
      </div>

      <!-- 中间：拖拽区域 -->
      <div class="flex-1 h-full"></div>

      <!-- 右侧：窗口控制按钮 -->
      <div class="flex items-center gap-1 no-drag">
        <button 
          @click="minimizeWindow" 
          class="w-9 h-7 flex items-center justify-center rounded-md hover:bg-emerald-100 transition-all duration-200 text-gray-500 hover:text-emerald-700 group !border-none"
          title="最小化"
        >
          <svg class="w-3.5 h-3.5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" stroke-linecap="round">
            <path d="M5 12h14"/>
          </svg>
        </button>
        <button 
          @click="maximizeWindow" 
          class="w-9 h-7 flex items-center justify-center rounded-md hover:bg-emerald-100 transition-all duration-200 text-gray-500 hover:text-emerald-700 group !border-none"
          title="最大化"
        >
          <svg class="w-3.5 h-3.5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
            <rect x="7" y="7" width="10" height="10" rx="1.5"/>
          </svg>
        </button>
        <button 
          @click="closeWindow" 
          class="w-9 h-7 flex items-center justify-center rounded-md hover:bg-red-500 transition-all duration-200 text-gray-500 hover:text-white group !border-none"
          title="关闭"
        >
          <svg class="w-3.5 h-3.5 transition-transform group-hover:scale-110 group-hover:rotate-90" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" stroke-linecap="round">
            <path d="M6 6l12 12M18 6L6 18"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="flex-1 overflow-hidden bg-gray-50">
      <router-view />
    </main>
  </div>
</template>

<script setup>
const minimizeWindow = () => {
  window.electronAPI.window.minimize()
}

const maximizeWindow = () => {
  window.electronAPI.window.maximize()
}

const closeWindow = () => {
  window.electronAPI.window.close()
}
</script>

<style scoped>
.app-shell {
  background-color: #ffffff;
}

.app-header {
  /* 允许拖拽整个标题栏 */
  -webkit-app-region: drag;
}

.no-drag {
  /* 禁止拖拽，用于按钮等交互元素 */
  -webkit-app-region: no-drag;
}
</style>
