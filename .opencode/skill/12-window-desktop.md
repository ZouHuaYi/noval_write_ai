---
name: 窗口控制与桌面行为
description: 扩展窗口控制与桌面行为。
key_paths:
  - electron/main.js
  - electron/preload.js
tasks:
  - 自定义标题栏
  - 窗口快捷键
  - 桌面行为扩展
---

# 窗口控制与桌面行为

## 目标

保证窗口控制逻辑集中在主进程，桌面行为稳定可预测。

## 关键路径

- `electron/main.js`
- `electron/preload.js`

## 适用任务

- 自定义标题栏
- 窗口控制与快捷键
- 桌面行为扩展

## 操作要点

- 窗口控制逻辑放在主进程。
- 需要渲染进程触发的操作通过 IPC 暴露。
- 避免直接操作 BrowserWindow 实例的副作用。
