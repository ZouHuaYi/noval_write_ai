<template>
  <div class="breadcrumb-nav">
    <div class="breadcrumb-container">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item 
          v-for="(item, index) in items" 
          :key="index"
          :to="item.to"
          :class="{ 'is-active': index === items.length - 1 }"
        >
          <el-icon v-if="item.icon" class="breadcrumb-icon">
            <component :is="item.icon" />
          </el-icon>
          <span>{{ item.label }}</span>
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { HomeFilled, Document, Edit, Setting } from '@element-plus/icons-vue'

interface BreadcrumbItem {
  label: string
  to?: string
  icon?: any
}

interface Props {
  items?: BreadcrumbItem[]
  novelTitle?: string
  chapterTitle?: string
}

const props = defineProps<Props>()
const route = useRoute()

// 自动生成面包屑
const items = computed(() => {
  if (props.items) {
    return props.items
  }

  const breadcrumbs: BreadcrumbItem[] = [
    { label: '首页', to: '/', icon: HomeFilled }
  ]

  const path = route.path
  
  // 处理可能存在的 /layout 前缀
  const normalizedPath = path.startsWith('/layout') ? path.replace('/layout', '') : path

  if (normalizedPath.startsWith('/novels')) {
    breadcrumbs.push({ label: '小说列表', to: '/novels', icon: Document })
  } else if (normalizedPath.startsWith('/novel/')) {
    breadcrumbs.push({ label: '小说列表', to: '/novels', icon: Document })
    if (props.novelTitle) {
      breadcrumbs.push({ label: props.novelTitle, to: path })
    }
  } else if (normalizedPath.startsWith('/workbench/')) {
    breadcrumbs.push({ label: '小说列表', to: '/novels', icon: Document })
    if (props.novelTitle) {
      breadcrumbs.push({ label: props.novelTitle, to: `/novel/${route.params.novelId}` })
    }
    breadcrumbs.push({ label: '工作台', icon: Edit })
    if (props.chapterTitle) {
      breadcrumbs.push({ label: props.chapterTitle })
    }
  } else if (normalizedPath.startsWith('/reader/')) {
    breadcrumbs.push({ label: '小说列表', to: '/novels', icon: Document })
    if (props.novelTitle) {
      breadcrumbs.push({ label: props.novelTitle, to: `/novel/${route.params.novelId}` })
    }
    breadcrumbs.push({ label: '阅读器' })
  } else if (normalizedPath.startsWith('/settings')) {
    breadcrumbs.push({ label: '设置', to: '/settings', icon: Setting })
  }

  return breadcrumbs
})
</script>

<style scoped>
.breadcrumb-nav {
  padding: 8px 16px;
  background: var(--app-surface);
  border-bottom: 1px solid var(--app-border);
  animation: fadeSlideIn 0.3s ease-out;
}

.breadcrumb-container {
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}

.breadcrumb-container::-webkit-scrollbar {
  height: 4px;
}

.breadcrumb-icon {
  margin-right: 4px;
  font-size: 14px;
  vertical-align: middle;
}

:deep(.el-breadcrumb__item) {
  display: inline-flex;
  align-items: center;
}

:deep(.el-breadcrumb__inner) {
  display: inline-flex;
  align-items: center;
  color: var(--app-text-muted);
  font-size: 13px;
  transition: color var(--app-transition-fast) ease;
}

:deep(.el-breadcrumb__inner:hover) {
  color: var(--app-primary);
}

:deep(.el-breadcrumb__item.is-active .el-breadcrumb__inner) {
  color: var(--app-text);
  font-weight: 600;
}

:deep(.el-breadcrumb__separator) {
  margin: 0 8px;
  color: var(--app-border-strong);
}
</style>
