# PROJECT_SKILLS

面向 OpenCode 的项目技能清单（小说管理桌面应用）。

## 项目概览

- 技术栈: Electron + Vue 3 + Vite + SQLite(better-sqlite3)
- 主进程入口: electron/main.js
- 渲染进程入口: src/main.js
- IPC 桥接: electron/preload.js + electron/ipc/\*.js + electron/ipcHandlers.js

## Skills 列表

### 1) 检索项目入口与启动流程

- 目标: 定位主进程/渲染进程/preload 的启动链路
- 关键路径: electron/main.js, electron/preload.js, src/main.js, index.html
- 适用任务: 新增启动逻辑、窗口参数、preload API 调整

### 2) 新增 IPC 能力（主进程 ↔ 渲染进程）

- 目标: 扩展 window.electronAPI 命名空间与调用
- 关键路径: electron/ipc/\*.js, electron/ipcHandlers.js, electron/preload.js
- 适用任务: 新增后台能力或对外暴露新接口
- 约定: ipcMain.handle('domain:action') + ipcRenderer.invoke('domain:action')

### 3) 数据库访问与 DAO 读写

- 目标: 扩展 SQLite 的表结构与读写逻辑
- 关键路径: electron/database/\*.js, electron/database/index.js
- 适用任务: 新增字段、查询、聚合统计

### 4) LLM 相关功能接入

- 目标: 扩展生成/校验/嵌入等 AI 能力
- 关键路径: electron/llm/_.js, electron/ipc/llmHandlers.js, src/llm/_.ts
- 适用任务: 新增 prompt、扩展生成流程、接入模型调用

### 5) 规划/看板/大纲工作流

- 目标: 扩展 planning/outline 流程能力
- 关键路径: electron/ipc/planningHandlers.js, src/panels/PlanningPanel.vue
- 适用任务: 看板状态、规划生成、导入导出

### 6) 知识图谱与一致性检查

- 目标: 扩展图谱统计、关系抽取、一致性校验
- 关键路径: electron/graph/\*, electron/ipc/graphHandlers.js, src/components/KnowledgeGraphView.vue
- 适用任务: 图谱导入导出、实体关系维护

### 7) 小说/章节管理能力

- 目标: CRUD 与内容管理
- 关键路径: electron/ipc/novelHandlers.js, electron/ipc/chapterHandlers.js, src/pages/NovelList.vue, src/pages/NovelDetail.vue
- 适用任务: 新增字段、列表筛选、章节内容更新

### 8) 应用设置与偏好

- 目标: 新增/读取设置项
- 关键路径: electron/settingsService.js, electron/ipc/settingsHandlers.js, src/pages/Settings.vue
- 适用任务: 新增设置项、默认值、配置说明

### 9) UI 页面与路由导航

- 目标: 新页面与路由/布局挂载
- 关键路径: src/pages/_, src/router/index.js, src/layouts/_
- 适用任务: 新增页面入口、布局切换

### 10) 状态管理（Pinia）

- 目标: 集中管理小说/图谱等全局状态
- 关键路径: src/stores/\*
- 适用任务: 新增 store、扩展 actions

### 11) 富文本编辑与写作面板

- 目标: 编辑器与写作相关面板扩展
- 关键路径: src/components/RichEditor.vue, src/panels/EditorPanel.vue
- 适用任务: 编辑功能扩展、写作辅助

### 12) 窗口控制与桌面行为

- 目标: 窗口控制与桌面行为扩展
- 关键路径: electron/main.js, electron/preload.js
- 适用任务: 自定义标题栏、窗口快捷键

### 13) 项目文档

- 目标: 项目文档维护
- 关键路径: PROJECT_SKILLS.md, PROJECT_OVERVIEW.md, DEVELOPMENT.md
- 适用任务: 新增文档、更新文档

## 14. 代码规范与最佳实践

### 前端 (Vue)

- **Composition API**: 必须使用 `<script setup>`。
- **不使用 Class 组件**: 保持 Vue 3 原生风格。
- **布局**: 遇到布局错乱，优先检查父容器的 `flex`, `h-full`, `overflow` 属性。避免滥用 `position: absolute` 做整体布局。
- **滚动条**: 复用 `.custom-scrollbar` 类（定义在全局或面板组件中）。

### 后端 (Electron)

- **异步操作**: IPC Handler 此时应始终为 `async`，即使操作是同步的（为了未来扩展性）。
- **错误处理**: Handler 内部捕获错误并打印日志，但这会抛回给前端，前端需处理 `try-catch`。

### LLM / Agent 集成

- **调用方式**: 前端通过 `window.electronAPI.llm` 或 `window.electronAPI.planning` 调用。
- **Prompt 管理**: 提示词通常位于 `electron/llm/` 或 `electron/prompt/` 目录。修改提示词需谨慎，建议先在简单场景测试。
- **依赖**: LLM 服务封装在 `electron/llm/llmService.js`，支持兼容 OpenAI 接口的模型。

## 15. 常用命令

| 命令              | 作用             | 备注                                 |
| :---------------- | :--------------- | :----------------------------------- |
| `npm run dev`     | 启动开发环境     | 同时启动 Vite 和 Electron            |
| `npm run rebuild` | 重新编译原生依赖 | 解决 `better-sqlite3` 版本不匹配问题 |
| `npm run build`   | 打包生产版本     | 输出到 release 目录                  |

## 16. 调试技巧

- **前端调试**: 使用 Electron 窗口自带的 DevTools (自动打开或 Ctrl+Shift+I)。
- **后端调试**: `console.log` 输出在启动 Electron 的终端中。
- **数据库调试**: 数据文件位于 `AppData/Roaming/novel-electron/novels.db` (或开发时的 `userData` 路径)。

## 17. 开发要求

- 代码功能完成一定要加注释，使用中文简体
- 一段代码功能开发完成，要进行校验，而不是全部完成后再校验
- 回复使用中文简体
