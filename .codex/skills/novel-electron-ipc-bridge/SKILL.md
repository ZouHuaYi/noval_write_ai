---
name: novel-electron-ipc-bridge
description: 扩展 window.electronAPI 命名空间与 IPC 调用能力。 适用于小说管理桌面应用项目的相关改动。
---

# 新增 IPC 能力（主进程 ↔ 渲染进程）

## 目标

通过统一的 IPC 约定扩展主进程能力，并安全暴露给渲染进程。

## 关键路径

- `electron/ipc/*.js`
- `electron/ipcHandlers.js`
- `electron/preload.js`

## 适用任务

- 新增主进程能力（文件、数据库、LLM、系统能力）
- 对外提供新的桥接 API

## 操作要点

- Handler 统一在 `electron/ipc/` 下维护并在 `electron/ipcHandlers.js` 注册。
- preload 只暴露必要 API，避免直接引入主进程依赖。
- Handler 必须使用 `async` 并在内部处理错误。

## 全局约束

- 遵循 `AGENTS.md` 的开发要求（中文简体注释、分段校验、`<script setup>`、IPC Handler `async` 等）。
