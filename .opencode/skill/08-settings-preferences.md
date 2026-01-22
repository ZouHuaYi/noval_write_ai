---
name: 应用设置与偏好
description: 新增、读取设置项并维护默认值。
key_paths:
  - electron/settingsService.js
  - electron/ipc/settingsHandlers.js
  - src/pages/Settings.vue
tasks:
  - 新增设置项
  - 默认值与配置说明
---

# 应用设置与偏好

## 目标

保证设置项有清晰的默认值与持久化方式，前后端读写一致。

## 关键路径

- `electron/settingsService.js`
- `electron/ipc/settingsHandlers.js`
- `src/pages/Settings.vue`

## 适用任务

- 新增设置项或分组
- 调整默认值或迁移逻辑
- 优化设置页面交互

## 操作要点

- 设置项统一在 settingsService 管理，前端不直接写入文件。
- IPC 返回值保持可序列化。
- 设置页面改动需要与持久化字段对齐。
