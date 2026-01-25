# Draft: Pipeline Resume Bug

## Requirements (confirmed)
- 在流水线生成页面，点击流水线暂停后关闭应用，重新打开应用点击继续无法继续执行
- 继续执行应从暂停点恢复（用户选择）

## Technical Decisions
- 暂无（待确认恢复逻辑与持久化策略）

## Research Findings
- 已定位相关文件：`src/pages/Pipeline.vue`、`src/pipeline/client.ts`、`electron/ipc/pipelineHandlers.js`、`electron/pipeline/pipelineService.js`、`electron/pipeline/pipelineSteps.js`、`electron/database/pipelineDAO.js`
- 持久化位置：SQLite 的 `pipeline_run` 与 `pipeline_step` 表；运行时状态在 `pipelineService.js` 的 `runningPipelines` Map
- 启动时未发现自动恢复逻辑；恢复依赖用户点击“继续”触发 `resumePipeline`
- 当前测试基础设施缺失（无测试脚本/配置/用例）
- UI 端“暂停/继续”按钮在 `Pipeline.vue` 中基于 `currentRun.status` 条件渲染
- `resumePipeline` 会更新 `pipeline_run.status` 并重新调用 `runPipeline`，执行流通过数据库 checkpoint 继续
- `runPipeline` 通过 `currentStage/currentBatch` 计算 resume 起点，并在多个 checkpoint 检查 `paused` 以中断循环
- `runningPipelines` Map 防止同一 runId 并发执行，`pause` 时保留状态、`completed` 时清理
- `pipeline_run.status` 值：`running/paused/completed/failed`；`pipeline_step.status` 值：`pending/running/completed/failed`
- `Pipeline.vue` 会在启动/切换小说时调用 `listPipelinesByNovel` 选择最新 run，并通过 `refreshStatus` 拉取状态与步骤
- 运行态每 4 秒轮询刷新状态；按钮显示依赖 `currentRun.status`
- 数据表定义在 `electron/database/schema.sql`，包含 `currentStage/currentBatch` 字段与索引
- 启动时未做“running”状态清理，重启后可能出现 DB 仍为 running 但后端无执行实例的“卡住”状态

## Open Questions
- 是否有任何报错日志或前端提示？
- 该问题是否只出现在特定类型的流水线任务？
- 应用重启后当前界面是否仍显示“暂停/继续”按钮为可用状态？

## Scope Boundaries
- INCLUDE: 应用重启后流水线继续执行的恢复机制与状态持久化
- EXCLUDE: 与流水线暂停/继续无关的功能改造
