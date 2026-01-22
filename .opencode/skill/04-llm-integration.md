---
name: LLM 相关功能接入
description: 扩展生成、校验、嵌入等 AI 能力与调用流程。
key_paths:
  - electron/llm/*.js
  - electron/ipc/llmHandlers.js
  - src/llm/*.ts
tasks:
  - 新增 prompt
  - 扩展生成流程
  - 接入模型调用
---

# LLM 相关功能接入

## 目标

保持 LLM 能力集中在主进程与专用模块中，前端仅通过 IPC 调用。

## 关键路径

- `electron/llm/*.js`
- `electron/ipc/llmHandlers.js`
- `src/llm/*.ts`

## 适用任务

- 新增或优化提示词
- 扩展生成、校验、嵌入能力
- 新增模型服务调用

## 操作要点

- Prompt 统一存放在 `electron/llm/` 或 `electron/prompt/`。
- 调用入口统一走 `window.electronAPI.llm`。
- 修改提示词后优先用简单场景验证。
