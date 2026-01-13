# 开发规范文档

## 📋 目录

- [项目概述](#项目概述)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [代码规范](#代码规范)
- [命名规范](#命名规范)
- [Git 提交规范](#git-提交规范)
- [开发流程](#开发流程)
- [性能优化](#性能优化)
- [安全规范](#安全规范)
- [文档规范](#文档规范)

---

## 项目概述

**项目名称**: novel-electron  
**项目描述**: 基于 Electron + Vue3 + SQLite 的小说管理桌面应用  
**主要功能**: 小说管理、章节管理、AI 写作助手、阅读器

---

## 技术栈

### 前端技术
- **Vue 3** (Composition API)
- **Element Plus** (UI 组件库)
- **Pinia** (状态管理)
- **Vue Router** (路由管理)
- **UnoCSS** (原子化 CSS)
- **Vite** (构建工具)

### 后端技术
- **Electron** (桌面应用框架)
- **better-sqlite3** (SQLite 数据库)
- **Node.js** (运行时环境)

---

## 项目结构

```
novel-electron/
├── electron/                    # Electron 主进程代码
│   ├── main.js                 # 主进程入口文件
│   ├── preload.js              # 预加载脚本（IPC 桥接）
│   └── database/               # 数据库模块
│       ├── index.js            # 数据库初始化
│       ├── ipcHandlers.js      # IPC 处理器
│       ├── schema.sql          # 数据库表结构
│       ├── novelDAO.js         # 小说数据访问层
│       ├── chapterDAO.js       # 章节数据访问层
│       ├── entityDAO.js        # 实体数据访问层
│       ├── eventDAO.js         # 事件数据访问层
│       └── settingsDAO.js      # 设置数据访问层
│
├── src/                        # 前端源码目录
│   ├── main.js                # 前端入口文件
│   ├── App.vue                # 根组件
│   ├── vite-env.d.ts          # TypeScript 类型定义
│   │
│   ├── pages/                 # 页面组件（路由页面）
│   │   ├── Home.vue           # 首页
│   │   ├── NovelList.vue      # 小说列表页
│   │   ├── NovelDetail.vue    # 小说详情页
│   │   ├── Workbench.vue      # 工作台页面
│   │   ├── Reader.vue         # 阅读器页面
│   │   └── Settings.vue       # 设置页面
│   │
│   ├── panels/                # 面板组件（可复用组件）
│   │   ├── NovelTree.vue      # 章节树面板
│   │   ├── EditorPanel.vue    # 编辑器面板
│   │   └── AgentPanel.vue     # AI 助手面板
│   │
│   ├── layouts/               # 布局组件
│   │   ├── MainLayout.vue     # 主布局
│   │   └── WorkbenchLayout.vue # 工作台布局
│   │
│   ├── stores/                # Pinia 状态管理
│   │   └── novel.js           # 小说状态管理
│   │
│   ├── router/                # 路由配置
│   │   └── index.js           # 路由定义
│   │
│   └── utils/                 # 工具函数
│       └── db.js              # 数据库工具（已废弃，使用 IPC）
│
├── index.html                 # HTML 入口文件
├── vite.config.js             # Vite 配置文件
├── uno.config.js              # UnoCSS 配置文件
├── package.json               # 项目依赖配置
└── README.md                  # 项目说明文档
```

### 目录说明

- **`electron/`**: Electron 主进程代码，包含数据库操作和 IPC 通信
- **`src/pages/`**: 路由页面组件，每个文件对应一个路由
- **`src/panels/`**: 可复用的面板组件，通常用于工作台等复杂页面
- **`src/layouts/`**: 布局组件，定义页面的整体结构
- **`src/stores/`**: Pinia 状态管理，用于全局状态共享
- **`src/router/`**: Vue Router 路由配置
- **`src/utils/`**: 工具函数，纯函数，不依赖业务逻辑

---

## 代码规范

### Vue 组件规范

#### 1. 组件结构顺序

```vue
<template>
  <!-- 模板内容 -->
</template>

<script setup lang="ts">
// 1. 导入依赖
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

// 2. 类型定义
type Props = {
  novelId?: string
  chapterId?: string | null
}

// 3. Props 和 Emits 定义
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'chapter-selected', chapterId: string): void
}>()

// 4. 响应式数据
const loading = ref(false)
const chapters = ref<Chapter[]>([])

// 5. 计算属性
const totalChapters = computed(() => chapters.value.length)

// 6. 方法
function loadChapters() {
  // ...
}

// 7. 生命周期钩子
onMounted(() => {
  loadChapters()
})

// 8. 监听器
watch(() => props.novelId, (novelId) => {
  if (novelId) {
    loadChapters()
  }
})
</script>

<style scoped>
/* 组件样式 */
</style>
```

#### 2. Composition API 使用规范

- ✅ **推荐**: 使用 `<script setup>` 语法
- ✅ **推荐**: 使用 TypeScript 类型定义
- ✅ **推荐**: 使用 `ref` 和 `computed` 进行响应式处理
- ❌ **禁止**: 使用 Options API（除非必要）

```typescript
// ✅ 正确
const count = ref(0)
const doubleCount = computed(() => count.value * 2)

// ❌ 错误
const count = 0
const doubleCount = count * 2
```

#### 3. Props 和 Emits 规范

```typescript
// ✅ Props 使用 TypeScript 类型
const props = defineProps<{
  novelId?: string
  chapterId?: string | null
  required: boolean
}>()

// ✅ Emits 使用类型定义
const emit = defineEmits<{
  (e: 'chapter-selected', chapterId: string): void
  (e: 'chapter-updated', chapter: Chapter): void
}>()

// ✅ 使用 emit
emit('chapter-selected', chapterId)
```

#### 4. 响应式数据规范

```typescript
// ✅ 基本类型使用 ref
const loading = ref(false)
const count = ref(0)

// ✅ 对象和数组使用 ref
const novel = ref<Novel | null>(null)
const chapters = ref<Chapter[]>([])

// ✅ 计算属性使用 computed
const totalChapters = computed(() => chapters.value.length)
const hasChapters = computed(() => chapters.value.length > 0)

// ✅ 只读数据使用 readonly
const config = readonly({ apiUrl: 'https://api.example.com' })
```

#### 5. 生命周期钩子规范

```typescript
// ✅ 按顺序使用生命周期钩子
onMounted(() => {
  // 组件挂载后执行
  loadData()
})

onUnmounted(() => {
  // 组件卸载前清理
  clearInterval(timer)
  window.removeEventListener('event', handler)
})

// ✅ 使用 watchEffect 进行副作用处理
watchEffect(() => {
  if (props.novelId) {
    loadChapters()
  }
})
```

### TypeScript 规范

#### 1. 类型定义

```typescript
// ✅ 使用 interface 定义对象类型
interface Chapter {
  id: string
  title: string
  content: string
  wordCount: number
  status: 'draft' | 'writing' | 'completed'
  createdAt: number
  updatedAt: number
}

// ✅ 使用 type 定义联合类型或别名
type ChapterStatus = 'draft' | 'writing' | 'completed'
type NovelId = string

// ✅ 使用泛型
function getItem<T>(id: string): Promise<T | null> {
  // ...
}
```

#### 2. 函数类型定义

```typescript
// ✅ 函数参数和返回值类型
function createChapter(
  novelId: string,
  data: Partial<Chapter>
): Promise<Chapter> {
  // ...
}

// ✅ 异步函数
async function loadChapters(novelId: string): Promise<Chapter[]> {
  // ...
}

// ✅ 箭头函数类型
const handleClick = (id: string): void => {
  // ...
}
```

#### 3. 可选和必填属性

```typescript
// ✅ 使用 ? 表示可选属性
interface Props {
  novelId?: string
  chapterId?: string | null
  required: boolean  // 必填属性不加 ?
}
```

### CSS 规范

#### 1. UnoCSS 原子化 CSS

```vue
<template>
  <!-- ✅ 使用 UnoCSS 原子类 -->
  <div class="flex items-center justify-between p-4 bg-white border-b">
    <h1 class="text-lg font-bold text-gray-800">标题</h1>
  </div>
</template>
```

#### 2. 作用域样式

```vue
<style scoped>
/* ✅ 使用 scoped 避免样式污染 */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
</style>
```

#### 3. 深度选择器

```vue
<style scoped>
/* ✅ 使用 :deep() 修改子组件样式 */
:deep(.el-button) {
  padding: 8px 16px;
}
</style>
```

#### 4. 自定义滚动条样式

```css
/* ✅ 统一的自定义滚动条样式 */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
  transition: background 0.2s;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* Firefox */
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: #c1c1c1 #f1f1f1;
}
```

### Electron IPC 规范

#### 1. IPC 通信流程

```
渲染进程 (Renderer) 
  ↓ window.electronAPI
预加载脚本 (Preload)
  ↓ ipcRenderer.invoke
主进程 (Main)
  ↓ ipcMain.handle
数据库操作 (Database)
```

#### 2. API 调用规范

```typescript
// ✅ 在渲染进程中调用
if (window.electronAPI?.chapter) {
  const chapters = await window.electronAPI.chapter.list(novelId)
}

// ✅ 错误处理
try {
  const chapter = await window.electronAPI.chapter.get(chapterId)
} catch (error: any) {
  console.error('加载章节失败:', error)
  ElMessage.error('加载章节失败')
}
```

#### 3. 类型定义

```typescript
// vite-env.d.ts 中定义类型
interface Window {
  electronAPI: {
    chapter: {
      list: (novelId: string) => Promise<Chapter[]>
      get: (id: string) => Promise<Chapter | null>
      create: (novelId: string, data?: Partial<Chapter>) => Promise<Chapter>
      update: (id: string, data: Partial<Chapter>) => Promise<Chapter>
      delete: (id: string) => Promise<{ success: boolean }>
    }
  }
}
```

### 数据库操作规范

#### 1. DAO 层规范

```javascript
// ✅ 使用 prepared statements 防止 SQL 注入
function createChapter(novelId, data) {
  const db = getDatabase()
  const id = randomUUID()
  
  db.prepare(`
    INSERT INTO chapter (id, novelId, title, content, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id,
    novelId,
    data.title || '',
    data.content || '',
    Date.now(),
    Date.now()
  )
  
  return id
}

// ✅ 使用事务处理多个操作
function reorderChapters(novelId) {
  const db = getDatabase()
  const transaction = db.transaction(() => {
    const chapters = db.prepare(`
      SELECT id FROM chapter WHERE novelId = ? ORDER BY idx ASC
    `).all(novelId)
    
    chapters.forEach((chapter, index) => {
      db.prepare('UPDATE chapter SET idx = ? WHERE id = ?')
        .run(index + 1, chapter.id)
    })
  })
  
  transaction()
  return { success: true }
}
```

#### 2. 错误处理

```javascript
// ✅ 统一错误处理
function getChapter(id) {
  try {
    const db = getDatabase()
    const chapter = db.prepare('SELECT * FROM chapter WHERE id = ?').get(id)
    return chapter || null
  } catch (error) {
    console.error('获取章节失败:', error)
    throw new Error('获取章节失败: ' + error.message)
  }
}
```

---

## 命名规范

### 文件命名

- **页面组件**: 使用 PascalCase，如 `NovelList.vue`、`Workbench.vue`
- **面板组件**: 使用 PascalCase，如 `NovelTree.vue`、`EditorPanel.vue`
- **工具文件**: 使用 camelCase，如 `db.js`、`utils.js`
- **配置文件**: 使用 kebab-case，如 `vite.config.js`、`uno.config.js`

### 变量命名

```typescript
// ✅ 使用 camelCase
const novelId = ref('')
const chapterList = ref<Chapter[]>([])
const isLoading = ref(false)

// ✅ 常量使用 UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3
const DEFAULT_PAGE_SIZE = 10

// ✅ 类型和接口使用 PascalCase
interface Chapter {
  id: string
  title: string
}

type ChapterStatus = 'draft' | 'writing' | 'completed'
```

### 函数命名

```typescript
// ✅ 使用 camelCase，动词开头
function loadChapters() { }
function createChapter() { }
function handleChapterSelected() { }
function updateChapterContent() { }

// ✅ 布尔值函数使用 is/has/can 前缀
function isChapterCompleted() { }
function hasChapters() { }
function canEditChapter() { }
```

### 组件命名

```vue
<!-- ✅ 组件名使用 PascalCase -->
<NovelTree />
<EditorPanel />
<AgentPanel />

<!-- ✅ Props 使用 kebab-case -->
<NovelTree :novel-id="novelId" @chapter-selected="handleSelect" />
```

### 事件命名

```typescript
// ✅ 事件名使用 kebab-case
emit('chapter-selected', chapterId)
emit('chapter-updated', chapter)
emit('text-selected', text)

// ✅ 事件处理函数使用 handle 前缀
function handleChapterSelected(chapterId: string) { }
function handleChapterUpdated(chapter: Chapter) { }
```

### CSS 类名

```vue
<!-- ✅ 使用语义化的类名 -->
<div class="chapter-list">
  <div class="chapter-item">
    <h3 class="chapter-title">标题</h3>
  </div>
</div>

<!-- ✅ 使用 UnoCSS 原子类 -->
<div class="flex items-center justify-between p-4">
```

---

## Git 提交规范

### 提交消息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整（不影响功能）
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具链相关
- `ui`: UI 调整

### 示例

```bash
# 新功能
feat(workbench): 添加章节分页功能

# 修复 bug
fix(editor): 修复自动保存失败的问题

# UI 调整
ui(novel-tree): 优化章节列表样式和滚动条

# 重构
refactor(database): 重构章节 DAO 层代码

# 文档
docs: 更新开发规范文档
```

### 分支命名

- `main`: 主分支（生产环境）
- `develop`: 开发分支
- `feature/xxx`: 功能分支
- `fix/xxx`: 修复分支
- `hotfix/xxx`: 热修复分支

---

## 开发流程

### 1. 环境准备

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 2. 开发新功能

1. 从 `develop` 分支创建功能分支
   ```bash
   git checkout -b feature/chapter-pagination
   ```

2. 开发功能
   - 编写代码
   - 遵循代码规范
   - 添加必要的注释

3. 提交代码
   ```bash
   git add .
   git commit -m "feat(chapter): 添加章节分页功能"
   ```

4. 推送到远程
   ```bash
   git push origin feature/chapter-pagination
   ```

5. 创建 Pull Request
   - 在 GitHub/GitLab 创建 PR
   - 等待代码审查
   - 合并到 `develop` 分支

### 3. 代码审查要点

- ✅ 代码符合规范
- ✅ 功能实现正确
- ✅ 错误处理完善
- ✅ 性能考虑合理
- ✅ 注释清晰
- ✅ 无 console.log 调试代码

---

## 性能优化

### 1. Vue 性能优化

```typescript
// ✅ 使用 computed 缓存计算结果
const filteredChapters = computed(() => {
  return chapters.value.filter(chapter => 
    chapter.title.includes(searchKeyword.value)
  )
})

// ✅ 使用 v-show 代替 v-if（频繁切换）
<div v-show="isVisible">内容</div>

// ✅ 列表渲染使用 key
<div v-for="chapter in chapters" :key="chapter.id">
  {{ chapter.title }}
</div>

// ✅ 防抖处理
let saveTimer: any = null
watch(() => content.value, () => {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    autoSave()
  }, 2000)
})
```

### 2. 数据库优化

```javascript
// ✅ 使用索引
CREATE INDEX idx_chapter_novelId ON chapter(novelId);
CREATE INDEX idx_chapter_idx ON chapter(novelId, idx);

// ✅ 使用 prepared statements
const stmt = db.prepare('SELECT * FROM chapter WHERE novelId = ?')
const chapters = stmt.all(novelId)

// ✅ 批量操作使用事务
const transaction = db.transaction(() => {
  // 多个操作
})
transaction()
```

### 3. 资源优化

- ✅ 图片使用合适的格式和尺寸
- ✅ 代码分割和懒加载
- ✅ 避免不必要的重新渲染

---

## 安全规范

### 1. SQL 注入防护

```javascript
// ✅ 使用 prepared statements（已内置防护）
db.prepare('SELECT * FROM chapter WHERE id = ?').get(id)

// ❌ 禁止字符串拼接 SQL
// const sql = `SELECT * FROM chapter WHERE id = '${id}'` // 危险！
```

### 2. XSS 防护

```vue
<!-- ✅ Element Plus 组件已内置 XSS 防护 -->
<el-input v-model="content" />

<!-- ✅ 使用 v-text 而不是 v-html（除非必要） -->
<div v-text="content"></div>
```

### 3. IPC 安全

```javascript
// ✅ 在 preload.js 中限制暴露的 API
contextBridge.exposeInMainWorld('electronAPI', {
  chapter: {
    list: (novelId) => ipcRenderer.invoke('chapter:list', novelId),
    // 只暴露必要的 API
  }
})

// ❌ 禁止直接暴露 Node.js API
// contextBridge.exposeInMainWorld('fs', require('fs')) // 危险！
```

---

## 文档规范

### 1. 代码注释

```typescript
/**
 * 创建章节
 * @param novelId - 小说 ID
 * @param data - 章节数据
 * @returns 创建的章节对象
 */
async function createChapter(
  novelId: string,
  data: Partial<Chapter>
): Promise<Chapter> {
  // ...
}
```

### 2. README 更新

- 新增功能时更新 README.md
- 更新技术栈说明
- 更新项目结构说明

### 3. 变更日志

- 重大变更记录在 CHANGELOG.md
- 版本更新时更新版本号

---

## 常见问题

### 1. Electron API 未加载

**问题**: `window.electronAPI` 为 `undefined`

**解决**: 
- 检查 `preload.js` 是否正确配置
- 检查 `main.js` 中 `webPreferences.preload` 路径是否正确

### 2. 数据库操作失败

**问题**: SQLite 操作报错

**解决**:
- 检查数据库文件路径
- 检查表结构是否正确
- 检查 SQL 语句语法

### 3. 样式不生效

**问题**: UnoCSS 类名不生效

**解决**:
- 检查 `uno.config.js` 配置
- 检查类名拼写
- 重启开发服务器

---

## 参考资源

- [Vue 3 官方文档](https://cn.vuejs.org/)
- [Element Plus 文档](https://element-plus.org/zh-CN/)
- [Electron 官方文档](https://www.electronjs.org/)
- [UnoCSS 文档](https://unocss.dev/)
- [TypeScript 官方文档](https://www.typescriptlang.org/)

---

**最后更新**: 2024-12-19  
**维护者**: 开发团队
