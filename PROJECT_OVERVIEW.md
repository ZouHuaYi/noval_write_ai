# Novel-Electron 项目文档概览

## 1. 架构概览

Novel-electron 是一个基于 Electron 构建的桌面应用程序。它采用现代 Web 技术栈作为渲染层，使用 Node.js 服务作为主进程。

- **渲染层 (Renderer)**: Vue 3 + Vite + Element Plus + Pinia
- **主进程 (Main Process)**: Node.js + Electron + better-sqlite3
- **通信机制**: 通过 preload 桥接进行 IPC 通信
- **存储方案**: 本地 SQLite 数据库（带 DAO 层）

## 2. 技术栈

- **框架**: Electron, Vue 3, Vite
- **UI 组件库**: Element Plus, UnoCSS 风格的原子类
- **状态管理**: Pinia
- **数据库**: better-sqlite3 (SQLite)
- **数据验证**: Zod
- **AI 能力**: 通过内部服务层集成 LLM

## 3. 核心模块

### 规划模块 (Planning Module)

负责事件、章节和进度的规划。

- **UI**: `src/panels/PlanningPanel.vue`
- **智能体**: `electron/llm/planningAgent.js`
- **IPC**: `electron/ipc/planningHandlers.js`
- **数据库**: `electron/database/planningDAO.js`

### 章节与编辑器模块 (Chapter and Editor Module)

负责章节的编辑和管理。

- **编辑器 UI**: `src/panels/EditorPanel.vue`
- **目录树/导航**: `src/panels/NovelTree.vue`
- **服务层**: `electron/chapterService.js`
- **数据库**: `electron/database/chapterDAO.js`

### 智能体与 LLM 模块 (Agent and LLM Module)

负责内容生成、润色和一致性检查。

- **UI**: `src/panels/AgentPanel.vue`
- **生成器**: `electron/llm/chapterGenerator.js`
- **LLM 服务**: `electron/llm/llmService.js`
- **ReIO**: `electron/llm/reioChecker.js` (输入输出检查)

### 记忆与图谱模块 (Memory and Graph Module)

负责故事图谱和知识提取。

- **图谱管理**: `electron/graph/graphManager.js`
- **UI**: `src/panels/GraphPanel.vue` (如果存在) 及图谱组件
- **DAO**: `electron/database/knowledgeEntryDAO.js`

### DAO 与数据库 (DAO and Database)

负责小说、章节、规划、快照等数据的持久化存储。

- **Schema**: `electron/database/schema.sql`
- **DAO 模式**: `electron/database/*DAO.js`

## 4. 数据流与 IPC 边界

- **渲染进程**: 通过 preload (`electron/preload.js`) 调用 `window.electronAPI.*`
- **主进程**: 在 `electron/ipc/*Handlers.js` 中处理 IPC 请求
- **业务逻辑**: 服务层/DAO 在 `electron/` 目录下执行数据库或 AI 逻辑

**主要 IPC 命名空间**:

- `novel:*`, `chapter:*`, `planning:*`, `worldview:*`, `llm:*`, `reio:*`, `graph:*`

## 5. 核心用户功能

- **小说管理**: 创建、更新、列出小说
- **章节写作**: 富文本编辑器、状态管理、字数统计
- **AI 辅助写作**: 章节续写、润色、一致性检查
- **规划功能**: 事件图谱、章节规划、看板视图
- **知识图谱**: 实体提取和关系管理（启用时）

## 6. 操作说明

### 如何运行

- **安装依赖**: `npm install`
- **开发模式**: `npm run dev`
- **仅与 Vite 运行**: `npm run dev:vite`
- **仅运行 Electron**: `npm run dev:electron`
- **生产打包**: `npm run build`
- **打包 Windows 版本**: `npm run build:win`
- **重新编译原生模块**: `npm run rebuild`

### 目录结构

- `electron/`: 主进程、IPC 处理器、数据库、LLM 逻辑
- `src/pages/`: 主要页面 (Workbench, Reader)
- `src/panels/`: 侧边栏面板 (Planning, Agent, Editor)
- `src/components/`: 共享 UI 组件
- `src/stores/`: Pinia 状态库
- `src/types/`: 全局 API 类型定义
