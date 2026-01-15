# AGENTS

## Scope
- Repository: novel-electron (Electron + Vue 3 + Vite).
- Applies to all files in this repo.
- No Cursor or Copilot rules were found.

## Quick Start
- Install dependencies: `npm install`
- Dev (Vite + Electron): `npm run dev`
- Vite only: `npm run dev:vite`
- Electron only (requires Vite running): `npm run dev:electron`
- Preview web build: `npm run preview`
- Build desktop app: `npm run build`
- Build Windows app: `npm run build:win`
- Rebuild native module (better-sqlite3): `npm run rebuild`

## Lint / Format / Test
- No lint scripts configured.
- No formatter scripts configured.
- No test runner configured.
- Single-test command: not available (add one if tests are introduced).
- If you add tests, document how to run one test in this file.

## Architecture Notes
- Renderer: `src/` (Vue 3 + Element Plus + Pinia).
- Main process: `electron/` (CommonJS, better-sqlite3, IPC).
- Preload bridge: `electron/preload.js` exposes `window.electronAPI`.
- DB schema: `electron/database/schema.sql`.
- DB init/migrations: `electron/database/index.js`.
- IPC handlers: `electron/ipcHandlers.js`.

## Module Boundaries
- Renderer must not access Node APIs directly (context isolation on).
- Use `window.electronAPI` for main-process calls.
- Prefer DAO functions in `electron/database/*DAO.js` for DB access.
- Avoid direct SQL in renderer; use IPC or DB bridge.

## Styling & Formatting
- Indentation: 2 spaces.
- Quotes: single quotes in JS/TS/Vue scripts.
- Semicolons: generally omitted.
- Vue SFCs use `<script setup lang="ts">`.
- Template classes use Tailwind/Uno-like utility classes; keep consistent.
- Keep templates readable; prefer line breaks for long props.

## Imports
- Order imports: external libs -> internal absolute `@/` -> relative.
- Group type-only imports with `import type`.
- Keep import lists sorted and minimal.
- Prefer alias paths `@/` over deep relative paths.

## TypeScript
- `strict` is enabled in `tsconfig.json`.
- Avoid `any` where reasonable; use explicit types for data shapes.
- Use `ref<T>()`/`reactive<T>()` for state typing.
- Use `Partial<T>` for patch updates in API calls.
- Prefer type guards over unchecked casts.

## Vue Component Patterns
- Use `defineProps`/`defineEmits` with explicit typings.
- Keep state local to component when possible.
- Use `watch` with `{ immediate: true }` for initial data load patterns.
- Use `onMounted` for first-time data fetch when needed.
- Use computed values instead of watchers when possible.

## UI Conventions
- Use Element Plus components for dialogs, forms, lists, tags.
- Use `ElMessage` / `ElMessageBox` for user feedback.
- Provide empty/loading states for lists.
- Buttons should reflect `loading` and `disabled` states.

## Error Handling
- Wrap async IPC calls in `try/catch`.
- Log with `console.error('中文错误信息:', error)`.
- Show user-facing errors with `ElMessage.error`.
- Avoid swallowing errors silently unless intentional.

## IPC / Preload
- Any new IPC channel must be:
  - Registered in `electron/ipcHandlers.js`.
  - Exposed in `electron/preload.js`.
  - Typed in `src/types/global.d.ts`.
- Keep IPC channel names consistent (`namespace:action`).
- Return plain JSON-serializable values.

## Database & Migrations
- Schema lives in `electron/database/schema.sql`.
- `initDatabase()` handles migrations before schema creation.
- When adding DB columns, update:
  - `schema.sql` for new installs.
  - Migration logic in `database/index.js` for existing installs.
  - DAO parsing for JSON fields.
- Prefer adding indexes for query-heavy columns.

## DAO Patterns
- DAO functions are simple and synchronous (better-sqlite3).
- Use `randomUUID()` for primary keys where needed.
- Keep `parse*` helpers to decode JSON fields to objects/arrays.
- Always update `updatedAt` on changes.

## StoryEngine / Memory
- Memory data lives in tables: `entity`, `event`, `dependency`.
- JSON fields are stored as strings; decode before use.
- Renderer should handle empty datasets gracefully.

## StoryEngine Workflow
- Extraction runs in main process under `electron/storyEngine/`.
- Persist results via DAO calls, not direct JSON files.
- When adding new memory types, update schema + DAO + IPC.
- UI should refresh via `memory:get` and show last updated time if available.
- If migrations add columns, handle them in `initDatabase()`.
- Prefer deterministic IDs if syncing across chapters.

## File Naming
- Vue components: `PascalCase.vue`.
- Panels live in `src/panels/`.
- Pages live in `src/pages/`.
- DAOs end with `DAO.js`.

## Naming Conventions
- Functions/variables: `camelCase`.
- Types/interfaces: `PascalCase`.
- Constants: `UPPER_SNAKE_CASE` for global constants.
- IPC channels: `lowercase:verb`.

## Do/Don’t Checklist
- Do keep changes minimal and aligned with existing patterns.
- Do update typings when adding APIs.
- Do reuse UI patterns (loading/empty states).
- Don’t introduce new global styles without need.
- Don’t add new tooling unless requested.
- Don’t access Node APIs from renderer.

## Validation
- No automated tests configured; manual QA only.
- If you change DB schema, restart Electron to apply migrations.
- If you change preload IPC, restart Electron to reload preload.

## When Adding New Features
- Plan the IPC/DAO surface first.
- Add UI with clear empty/loading states.
- Update types and ensure `window.electronAPI` has the new surface.
- Add migrations for any schema changes.

## Future Test Guidance (if added later)
- Prefer a single test runner (e.g., Vitest or Jest).
- Document `npm run test` and a single-test command here.
- Keep tests close to feature modules.
