---
name: 新增 IPC 能力（主进程 ↔ 渲染进程）
description: 扩展 window.electronAPI 命名空间与 IPC 调用能力。
key_paths:
  - electron/ipc/*.js
  - electron/ipcHandlers.js
  - electron/preload.js
tasks:
  - 新增后台能力
  - 对外暴露新接口
convention:
  - ipcMain.handle('domain:action')
  - ipcRenderer.invoke('domain:action')
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
