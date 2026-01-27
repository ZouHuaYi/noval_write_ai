---
name: novel-electron-standards
description: 小说管理桌面应用项目通用开发规范、调试方式与常用命令。用于任何代码改动前后确认约束、命令、调试位置与校验节奏。
---

# 通用开发规范与调试

## 必遵约束

- 代码功能完成必须加注释，使用中文简体。
- 一段代码功能完成先做局部校验，再进入下一段。
- 前端仅用 `<script setup>`，不使用 Class 组件。
- 布局问题优先检查父容器 `flex`、`h-full`、`overflow`，避免滥用 `position: absolute`。
- 滚动条复用 `.custom-scrollbar`。
- IPC Handler 必须 `async`，内部 `try/catch` 并记录日志，错误抛回前端处理。

## 入口与路径

- 主进程入口：`electron/main.js`
- 预加载脚本：`electron/preload.js`
- 渲染进程入口：`src/main.js`
- IPC 汇总：`electron/ipcHandlers.js`

## LLM 相关约定

- 前端通过 `window.electronAPI.llm` 或 `window.electronAPI.planning` 调用。
- 提示词位于 `electron/llm/` 或 `electron/prompt/`。
- 服务封装在 `electron/llm/llmService.js`。

## 常用命令

- `npm run dev`：启动开发环境（Vite + Electron）。
- `npm run rebuild`：重编原生依赖，解决 `better-sqlite3` 不匹配。
- `npm run build`：打包生产版本，输出到 `release`。

## 调试定位

- 前端：Electron DevTools（自动打开或 `Ctrl+Shift+I`）。
- 后端：启动 Electron 的终端输出。
- 数据库：`AppData/Roaming/novel-electron/novels.db` 或开发时 `userData`。

## 检索建议

- 优先使用 `rg` 搜索关键字/文件。
- 需要具体领域细节时，读取对应技能：
- `novel-electron-app-startup`
- `novel-electron-ipc-bridge`
- `novel-electron-database-dao`
- `novel-electron-llm-integration`
- `novel-electron-planning-kanban-outline`
- `novel-electron-knowledge-graph`
- `novel-electron-novel-chapter`
- `novel-electron-settings-preferences`
- `novel-electron-ui-routing`
- `novel-electron-state-pinia`
- `novel-electron-editor-panel`
- `novel-electron-window-desktop`
- `novel-electron-project-docs`
