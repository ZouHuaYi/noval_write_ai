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
import { HomeFilled, Document, Edit, Setting, Cpu, InfoFilled } from '@element-plus/icons-vue'

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
  } else if (normalizedPath.startsWith('/about')) {
    breadcrumbs.push({ label: '关于我们', to: '/about', icon: InfoFilled })
  } else if (normalizedPath.startsWith('/pipeline')) {
    breadcrumbs.push({ label: '小说列表', to: '/novels', icon: Document })
    if (props.novelTitle) {
      // 如果知道是哪本小说，尝试构建带有小说ID的路径（虽然pipeline页面是在query里）
      // 这里我们假设 pipeline 总是从某个小说进来的，或者用户选择了小说
      // 由于 path 是 /pipeline，我们不能直接从 path 获取 novelId，但 props.novelTitle 存在说明上下文已知
      // 我们可以让面包屑显示: 首页 > 小说列表 > [小说名] > 流水线
      // 但 link 到小说详情页比较麻烦，因为没有 ID 传入。
      // 不过 Pipeline.vue 会传 novel-title。
      // 我们可以尝试通过 route.query.novelId 获取 ID
      const novelId = route.query.novelId
      if (novelId) {
        breadcrumbs.push({ label: props.novelTitle, to: `/novel/${novelId}` })
      } else {
        breadcrumbs.push({ label: props.novelTitle }) // 只是展示名字，不可点击
      }
    }
    breadcrumbs.push({ label: '流水线生成', icon: Cpu })
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
