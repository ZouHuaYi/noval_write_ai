<template>
  <div class="h-full flex flex-col">
    <div class="bg-white border-b p-4 flex justify-between items-center">
      <div class="flex items-center space-x-2">
        <el-button @click="$router.back()">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <span class="ml-4 text-lg font-bold">{{ chapter?.title || '加载中...' }}</span>
      </div>
      <div class="flex gap-2">
        <el-button @click="prevChapter" :disabled="!prevChapterId">
          上一章
        </el-button>
        <el-button @click="nextChapter" :disabled="!nextChapterId">
          下一章
        </el-button>
      </div>
    </div>
    
    <div class="flex-1 overflow-auto p-8 bg-gray-50">
      <div v-if="loading" class="flex justify-center items-center h-full">
        <el-icon class="is-loading text-4xl"><Loading /></el-icon>
      </div>
      
      <div
        v-else-if="chapter"
        class="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow prose prose-lg"
        v-html="formatContent(chapter.content)"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { useNovelStore } from '@/stores/novel'
import { ArrowLeft, Loading } from '@element-plus/icons-vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const novelStore = useNovelStore()

const loading = ref(true)
const chapter = ref(null)
const chapters = ref([])

const novelId = computed(() => route.params.novelId)
const chapterId = computed(() => route.params.chapterId)

onMounted(async () => {
  await loadData()
})

const loadData = async () => {
  loading.value = true
  try {
    chapters.value = await novelStore.fetchChapters(novelId.value)
    
    if (chapterId.value) {
      chapter.value = await novelStore.fetchChapter(chapterId.value)
    } else if (chapters.value.length > 0) {
      // 如果没有指定章节，跳转到第一章
      router.replace(`/reader/${novelId.value}/${chapters.value[0].id}`)
      chapter.value = chapters.value[0]
    }
  } finally {
    loading.value = false
  }
}

const currentIndex = computed(() => {
  return chapters.value.findIndex(c => c.id === chapter.value?.id)
})

const prevChapterId = computed(() => {
  if (currentIndex.value > 0) {
    return chapters.value[currentIndex.value - 1].id
  }
  return null
})

const nextChapterId = computed(() => {
  if (currentIndex.value < chapters.value.length - 1) {
    return chapters.value[currentIndex.value + 1].id
  }
  return null
})

const prevChapter = () => {
  if (prevChapterId.value) {
    router.push(`/reader/${novelId.value}/${prevChapterId.value}`)
    loadData()
  }
}

const nextChapter = () => {
  if (nextChapterId.value) {
    router.push(`/reader/${novelId.value}/${nextChapterId.value}`)
    loadData()
  }
}

const formatContent = (content) => {
  if (!content) return ''
  return content.replace(/\n/g, '<br>')
}
</script>

<style scoped>
:deep(.prose) {
  line-height: 2;
  font-size: 18px;
  color: #333;
}
</style>
