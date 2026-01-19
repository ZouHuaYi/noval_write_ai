# Novel-Electron Project Documentation Summary

## 1. Architecture Overview
Novel-electron is a desktop application built with Electron. It uses a modern web stack for the renderer and Node.js services for the main process.

- Renderer: Vue 3 + Vite + Element Plus + Pinia
- Main process: Node.js + Electron + better-sqlite3
- Communication: IPC via preload bridge
- Storage: Local SQLite with DAO layer

## 2. Technology Stack
- Frameworks: Electron, Vue 3, Vite
- UI: Element Plus, UnoCSS-style utility classes
- State: Pinia
- Database: better-sqlite3 (SQLite)
- Validation: Zod
- AI: LLM via internal service layer

## 3. Core Modules

### Planning Module
Planning for events, chapters, and progress.
- UI: src/panels/PlanningPanel.vue
- Agents: electron/llm/planningAgent.js
- IPC: electron/ipc/planningHandlers.js
- DB: electron/database/planningDAO.js

### Chapter and Editor Module
Chapter editing and management.
- Editor UI: src/panels/EditorPanel.vue
- Tree/Navigation: src/panels/NovelTree.vue
- Services: electron/chapterService.js
- DB: electron/database/chapterDAO.js

### Agent and LLM Module
Generation, polish, consistency checks.
- UI: src/panels/AgentPanel.vue
- Generator: electron/llm/chapterGenerator.js
- LLM service: electron/llm/llmService.js
- ReIO: electron/llm/reioChecker.js

### Memory and Graph Module
Story graph and knowledge extraction.
- Graph management: electron/graph/graphManager.js
- UI: src/panels/GraphPanel.vue (if present) and graph components
- DAO: electron/database/knowledgeEntryDAO.js

### DAO and Database
Persistent storage for novels, chapters, planning, snapshots, etc.
- Schema: electron/database/schema.sql
- DAO pattern: electron/database/*DAO.js

## 4. Data Flow and IPC Boundaries
- Renderer invokes window.electronAPI.* via preload (electron/preload.js)
- Main process handles IPC in electron/ipc/*Handlers.js
- Services/DAOs execute DB or AI logic in electron/

Key IPC namespaces:
- novel:*, chapter:*, planning:*, worldview:*, llm:*, reio:*, graph:*

## 5. Key User-Facing Features
- Novel management: create, update, list novels
- Chapter writing: rich editor, status, word count
- AI writing: chapter continuation, polish, consistency checks
- Planning: event graph, chapter planning, kanban
- Knowledge graph: entity extraction and relations (when enabled)

## 6. Operational Notes

### How to Run
- Install deps: npm install
- Dev mode: npm run dev
- Vite only: npm run dev:vite
- Electron only: npm run dev:electron
- Build: npm run build
- Build Windows: npm run build:win
- Rebuild native module: npm run rebuild

### Directory Structure
- electron/: main process, IPC handlers, DB, LLM logic
- src/pages/: main pages (Workbench, Reader)
- src/panels/: side panels (Planning, Agent, Editor)
- src/components/: shared UI components
- src/stores/: Pinia stores
- src/types/: global API typings
