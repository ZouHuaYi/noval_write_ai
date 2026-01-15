<template>
  <div class="h-full p-4 overflow-auto">
    <div v-if="loading" class="flex justify-center items-center h-full">
      <el-icon class="is-loading text-4xl"><Loading /></el-icon>
    </div>
    
    <div v-else-if="novel" class="max-w-4xl mx-auto">
      <div class="mb-6 flex items-center space-x-2">
        <el-button @click="$router.back()">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
      </div>
      
      <div class="bg-white p-6 rounded-lg shadow mb-6">
        <div class="flex gap-6">
          <img
            v-if="novel.cover"
            :src="novel.cover"
            alt="封面"
            class="w-32 h-48 object-cover rounded"
          />
          <div class="flex-1">
            <h1 class="text-3xl font-bold mb-2">{{ novel?.title }}</h1>
            <p class="text-gray-700">{{ novel?.description || '暂无描述' }}</p>
          </div>
        </div>
      </div>
      
      <div class="bg-white p-6 rounded-lg shadow">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold">章节列表</h2>
        </div>
        
        <el-table :data="chapters" style="width: 100%">
          <el-table-column prop="chapterNumber" label="序号" width="80" />
          <el-table-column prop="title" label="标题" />
          <el-table-column prop="wordCount" label="字数" width="100" />
          <el-table-column label="操作" width="150">
            <template #default="{ row }">
              <el-button
                link
                type="primary"
                @click="readChapter(row.id)"
              >
                阅读
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
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
const novel = ref(null)
const chapters = ref([])
const chapterForm = ref({
  title: '',
  chapterNumber: 1,
  content: ''
})

const novelId = computed(() => route.params.id)

onMounted(async () => {
  await loadData()
})

const loadData = async () => {
  loading.value = true
  try {
    novel.value = await novelStore.fetchNovelById(novelId.value)
    chapters.value = await novelStore.fetchChapters(novelId.value)
  } finally {
    loading.value = false
  }
}

const readChapter = (chapterId) => {
  router.push(`/reader/${novelId.value}/${chapterId}`)
}


</script>
