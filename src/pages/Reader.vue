<template>
  <div class="h-full flex flex-col app-shell">
    <!-- 面包屑导航 -->
    <Breadcrumb :novel-title="novel?.title" />

    <div class="app-header p-4 flex justify-between items-center">
      <div class="flex items-center space-x-2">
        <span class="text-lg font-bold">
          {{`第${chapter?.chapterNumber}章`}}-{{ chapter?.title || '加载中...' }}</span>
          <!-- 复制按钮 -->
           <el-icon class="cursor-pointer" @click="copyChapterTitle"><CopyDocument/></el-icon>
      </div>
      <div class="flex items-center gap-3">
         <el-button size="small" type="success"  @click="copyChapterContent">
          <el-icon><CopyDocument/></el-icon>
        </el-button>
        <el-button size="small" type="primary"  @click="refresh">
          <el-icon><Refresh/></el-icon>
        </el-button>
        <div class="flex items-center gap-2 app-section px-3 py-1">
          <span class="text-xs app-muted">字体</span>
          <el-button size="small" text @click="decreaseFont">A-</el-button>
          <span class="text-xs">{{ fontSize }}px</span>
          <el-button size="small" text @click="increaseFont">A+</el-button>
        </div>

        <el-select v-model="chapterId" class="w-24" placeholder="选择章节" clearable filterable>
          <el-option v-for="chapter in chapters" :key="chapter.id" :label="chapter.chapterNumber" :value="chapter.id" />
        </el-select>
        
        <el-button-group>
          <el-button @click="prevChapter" :disabled="!prevChapterId">
            上一章
          </el-button>
          <el-button @click="nextChapter" :disabled="!nextChapterId">
            下一章
          </el-button>
        </el-button-group>
      </div>
    </div>

    <div class="flex-1 overflow-auto p-8">
      <div v-if="loading" class="flex justify-center items-center h-full">
        <el-icon class="is-loading text-4xl"><Loading /></el-icon>
      </div>

      <div
        v-else-if="chapter"
        class="max-w-4xl mx-auto app-card p-8 prose prose-lg"
        :style="{ fontSize: fontSize + 'px' }"
        v-html="formatContent(chapter.content)"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { useNovelStore } from '@/stores/novel'
import Breadcrumb from '@/components/Breadcrumb.vue'
import { CopyDocument, Loading, Refresh } from '@element-plus/icons-vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const novelStore = useNovelStore()

const loading = ref(true)
const novel = ref(null)
const chapter = ref(null)
const chapters = ref([])
const fontSize = ref(18)

const novelId = computed(() => route.params.novelId)
const chapterId = computed({
  get: () => route.params.chapterId,
  set: (value) => {
    router.replace(`/reader/${novelId.value}/${value}`)
  }
})

// 监听路由变化，重新加载数据
watch(() => route.params.chapterId, () => {
  loadData()
})

onMounted(async () => {
  await loadNovelInfo()
  await loadData()
})

const refresh = () => {
  loadData()
}

const copyChapterTitle = () => {
  navigator.clipboard.writeText(chapter.value.title)
  ElMessage.success('复制成功')
}

const copyChapterContent = () => {
  navigator.clipboard.writeText(chapter.value.content)
  ElMessage.success('复制成功')
}

const loadNovelInfo = async () => {
  try {
    novel.value = await novelStore.fetchNovelById(novelId.value)
  } catch (e) {
    console.error('加载小说信息失败:', e)
  }
}

const loadData = async () => {
  loading.value = true
  try {
    chapters.value = await novelStore.fetchChapters(novelId.value)
    
    if (chapterId.value) {
      chapter.value = await novelStore.fetchChapter(chapterId.value)
    } else if (chapters.value.length > 0) {
      router.replace(`/reader/${novelId.value}/${chapters.value[0].id}`)
    }
  } catch (e) {
    console.error('加载章节数据失败:', e)
  } finally {
    loading.value = false
  }
}

const currentIndex = computed(() => {
  return chapters.value.findIndex(c => c.id === chapter.value?.id)
})

const currentIndexDisplay = computed(() => {
  return currentIndex.value >= 0 ? currentIndex.value + 1 : 0
})

const readingProgress = computed(() => {
  if (chapters.value.length === 0) return 0
  return Math.round((currentIndexDisplay.value / chapters.value.length) * 100)
})

const prevChapterId = computed(() => {
  if (currentIndex.value < chapters.value.length - 1) {
    return chapters.value[currentIndex.value + 1].id
  }
  return null
})

const nextChapterId = computed(() => {
  if (currentIndex.value > 0) {
    return chapters.value[currentIndex.value - 1].id
  }
  return null
})

const prevChapter = () => {
  if (prevChapterId.value) {
    router.push(`/reader/${novelId.value}/${prevChapterId.value}`)
  }
}

const nextChapter = () => {
  if (nextChapterId.value) {
    router.push(`/reader/${novelId.value}/${nextChapterId.value}`)
  }
}

const increaseFont = () => {
  fontSize.value = Math.min(24, fontSize.value + 1)
}

const decreaseFont = () => {
  fontSize.value = Math.max(14, fontSize.value - 1)
}

const increaseLineHeight = () => {
  lineHeight.value = Math.min(3, Number((lineHeight.value + 0.1).toFixed(1)))
}

const decreaseLineHeight = () => {
  lineHeight.value = Math.max(1.6, Number((lineHeight.value - 0.1).toFixed(1)))
}

const formatContent = (content) => {
  if (!content) return ''
  return content.replace(/\n/g, '<br>')
}
</script>

<style scoped>
:deep(.prose) {
  color: var(--app-text);
  letter-spacing: 0.01em;
}

:deep(.prose br) {
  display: block;
  margin-bottom: 12px;
}
</style>
