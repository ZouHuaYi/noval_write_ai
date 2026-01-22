---
name: 小说/章节管理能力
description: 扩展 CRUD 与内容管理能力。
key_paths:
  - electron/ipc/novelHandlers.js
  - electron/ipc/chapterHandlers.js
  - src/pages/NovelList.vue
  - src/pages/NovelDetail.vue
tasks:
  - 新增字段
  - 列表筛选
  - 章节内容更新
---

# 小说/章节管理能力

## 目标

保证小说与章节的 CRUD 操作一致性，避免前后端字段偏差。

## 关键路径

- `electron/ipc/novelHandlers.js`
- `electron/ipc/chapterHandlers.js`
- `src/pages/NovelList.vue`
- `src/pages/NovelDetail.vue`

## 适用任务

- 新增小说/章节字段
- 列表筛选或排序能力
- 章节内容与元数据更新

## 操作要点

- 字段变更同步更新数据库与 IPC 结构。
- 列表筛选在主进程完成，前端只传筛选条件。
- 章节编辑流程保持自动保存或显式保存的一致性。
