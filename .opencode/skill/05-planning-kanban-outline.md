---
name: 规划/看板/大纲工作流
description: 扩展 planning/outline 相关流程能力。
key_paths:
  - electron/ipc/planningHandlers.js
  - src/panels/PlanningPanel.vue
  - src/components/KanbanBoard.vue
tasks:
  - 看板状态调整
  - 规划生成
  - 导入导出
---

# 规划/看板/大纲工作流

## 目标

保证规划能力流程可扩展、状态可追踪、UI 与 IPC 对齐。

## 关键路径

- `electron/ipc/planningHandlers.js`
- `src/panels/PlanningPanel.vue`
- `src/components/KanbanBoard.vue`

## 适用任务

- 看板状态新增或调整
- 规划/大纲生成流程改造
- 规划数据导入导出

## 操作要点

- 主进程负责数据处理与存储，前端只做展示与交互。
- 看板状态枚举统一维护，避免前后端不一致。
- 避免在 UI 内直接拼接复杂业务逻辑。
