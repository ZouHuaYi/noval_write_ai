---
name: novel-electron-ui-routing
description: 新页面与路由/布局挂载规范。 适用于小说管理桌面应用项目的相关改动。
---

# UI 页面与路由导航

## 目标

确保页面入口、路由与布局挂载保持一致，避免页面丢失或导航异常。

## 关键路径

- `src/pages/*`
- `src/router/index.js`
- `src/layouts/*`

## 适用任务

- 新增页面或入口
- 调整布局与路由结构
- 新增导航逻辑

## 操作要点

- 页面命名保持语义清晰，避免重复路由。
- 路由配置与布局挂载在同一处维护。
- 新页面需要同步更新导航入口。

## 全局约束

- 遵循 `AGENTS.md` 的开发要求（中文简体注释、分段校验、`<script setup>`、IPC Handler `async` 等）。
