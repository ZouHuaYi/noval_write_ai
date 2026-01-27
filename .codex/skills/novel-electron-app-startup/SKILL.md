---
name: novel-electron-app-startup
description: 定位主进程、渲染进程与 preload 的启动链路与入口文件。 适用于小说管理桌面应用项目的相关改动。
---

# 检索项目入口与启动流程

## 目标

快速定位主进程、渲染进程与 preload 的启动链路，保证启动逻辑改动可追踪。

## 关键路径

- `electron/main.js`
- `electron/preload.js`
- `src/main.js`
- `index.html`

## 适用任务

- 新增启动逻辑或启动参数
- 调整窗口行为或初始化流程
- 扩展 preload 暴露的 API

## 操作要点

- 主进程逻辑集中在 `electron/main.js`，保持初始化顺序清晰。
- 预加载脚本仅做桥接，不放业务逻辑。
- 渲染进程入口确保路由与全局状态初始化完成。

## 全局约束

- 遵循 `AGENTS.md` 的开发要求（中文简体注释、分段校验、`<script setup>`、IPC Handler `async` 等）。
