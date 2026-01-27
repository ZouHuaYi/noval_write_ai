---
name: novel-electron-database-dao
description: 扩展 SQLite 表结构、查询与聚合逻辑。 适用于小说管理桌面应用项目的相关改动。
---

# 数据库访问与 DAO 读写

## 目标

通过 DAO 层实现稳定的数据库读写与迁移，避免直接在渲染进程操作数据库。

## 关键路径

- `electron/database/*.js`
- `electron/database/index.js`

## 适用任务

- 新增字段或表结构
- 新增查询、统计、聚合能力
- 修复数据库迁移逻辑

## 操作要点

- 新表在 `schema.sql` 中维护，旧表变更走迁移逻辑。
- 迁移时先检查字段是否存在，再执行 `ALTER TABLE`。
- DAO 层保持单一职责，避免混入业务流程。

## 全局约束

- 遵循 `AGENTS.md` 的开发要求（中文简体注释、分段校验、`<script setup>`、IPC Handler `async` 等）。
