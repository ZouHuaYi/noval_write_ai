---
name: 状态管理（Pinia）
description: 集中管理小说/图谱等全局状态。
key_paths:
  - src/stores/*
tasks:
  - 新增 store
  - 扩展 actions
  - 状态结构调整
---

# 状态管理（Pinia）

## 目标

保证全局状态结构可预测、可追踪，避免组件间重复请求。

## 关键路径

- `src/stores/*`

## 适用任务

- 新增 store 或模块化管理
- 扩展 actions 与 getters
- 状态结构调整或迁移

## 操作要点

- 统一 store 命名与 state 结构。
- 异步动作集中在 actions 中处理。
- 避免在组件内直接修改复杂状态。
