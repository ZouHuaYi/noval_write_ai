---
name: 知识图谱与一致性检查
description: 扩展图谱统计、关系抽取、一致性校验能力。
key_paths:
  - electron/graph/*
  - electron/ipc/graphHandlers.js
  - src/components/KnowledgeGraphView.vue
tasks:
  - 图谱导入导出
  - 实体关系维护
  - 一致性校验
---

# 知识图谱与一致性检查

## 目标

维护知识图谱数据与可视化的一致性，确保校验结果可解释。

## 关键路径

- `electron/graph/*`
- `electron/ipc/graphHandlers.js`
- `src/components/KnowledgeGraphView.vue`

## 适用任务

- 图谱导入导出
- 实体关系维护
- 一致性校验与统计

## 操作要点

- 图谱变更优先在主进程完成，前端仅渲染。
- 校验结果包含原因说明，便于 UI 展示。
- 关系抽取与统计避免阻塞 UI 线程。
