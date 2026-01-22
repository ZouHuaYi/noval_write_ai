---
name: 富文本编辑与写作面板
description: 编辑器与写作相关面板扩展。
key_paths:
  - src/components/RichEditor.vue
  - src/panels/EditorPanel.vue
tasks:
  - 编辑功能扩展
  - 写作辅助功能
---

# 富文本编辑与写作面板

## 目标

保证编辑器功能扩展可控，写作面板与编辑器能力保持同步。

## 关键路径

- `src/components/RichEditor.vue`
- `src/panels/EditorPanel.vue`

## 适用任务

- 编辑器功能扩展或插件接入
- 写作辅助能力扩展
- 编辑器交互优化

## 操作要点

- 编辑器配置集中维护，避免多处重复。
- 功能扩展先评估性能与渲染成本。
- 面板与编辑器状态同步保持单一数据源。
