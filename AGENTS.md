# AGENTS.md

This file contains guidelines and commands for agentic coding agents working in this repository.

## Project Overview

This is a Novel Management Desktop Application built with Electron + Vue3 + TypeScript. The application provides novel writing and management capabilities with AI assistance.

**Tech Stack:**
- Electron 28.0.0 (Desktop framework)
- Vue 3.4.0 with Composition API
- TypeScript (strict mode)
- Vite 5.0.0 (Build tool)
- Pinia 2.1.7 (State management)
- Element Plus 2.5.0 (UI components)
- UnoCSS 0.58.0 (Atomic CSS)
- better-sqlite3 9.2.2 (Database)

## Development Commands

```bash
# Development
npm run dev              # Start development mode (Vite + Electron)
npm run dev:vite         # Vite dev server only
npm run dev:electron     # Electron main process only

# Building
npm run build            # Build for production and create installer
npm run build:win        # Build Windows version specifically
npm run preview          # Preview production build

# Dependencies
npm run postinstall      # Rebuild native modules (better-sqlite3)
npm run rebuild          # Manual rebuild of native modules
```

## Code Style Guidelines

### TypeScript/JavaScript
- Use ES2020+ features with strict TypeScript configuration
- Async/await pattern for asynchronous operations
- Arrow functions preferred for callbacks
- Consistent error handling with try-catch blocks
- Mixed `.js` and `.vue` files (use `lang="ts"` in Vue components for TypeScript)

### Vue.js Components
- Use Composition API with `<script setup>` syntax
- PascalCase for component names (e.g., `NovelDetail.vue`)
- Reactive refs and computed properties
- Element Plus UI components throughout
- TypeScript support in Vue components with `lang="ts"`

### CSS/Styling
- UnoCSS for atomic CSS with custom shortcuts
- Element Plus theme with dark mode support
- Consistent design tokens (border-radius, colors, transitions)
- Scoped styles in components when needed
- Global styles in `src/styles/global.css`

### Naming Conventions
- **Components**: PascalCase (`NovelDetail.vue`, `WorkbenchLayout.vue`)
- **Functions/Variables**: camelCase (`fetchNovels`, `currentNovel`)
- **Constants**: UPPER_SNAKE_CASE (when used)
- **Files**: kebab-case for utilities, PascalCase for components

### Import Style
- ES6 imports consistently used
- Path aliases configured (`@/*` maps to `src/*`)
- Third-party imports first, then local imports
- Example:
```typescript
import { ref, computed } from 'vue'
import { ElButton } from 'element-plus'
import { useNovelsStore } from '@/stores/novels'
import { fetchNovels } from '@/utils/api'
```

## Architecture Patterns

### Electron Architecture
- **Main Process**: Handles database operations and IPC
- **Renderer Process**: Runs Vue application
- **Preload Script**: Provides secure API bridge
- **Context Isolation**: Enabled for security

### Database Schema
- Novel-centric design with related entities
- Support for chapters, outlines, events, dependencies
- Settings table for application configuration
- Proper foreign key relationships
- DAO pattern for database operations

### State Management
- Pinia stores for different domains (novels, settings, etc.)
- Async actions with error handling
- Reactive state updates

## File Structure

```
novel-electron/
├── electron/              # Electron main process
│   ├── main.js           # Main process entry
│   ├── preload.js        # Preload script
│   ├── database/         # Database modules
│   └── storyEngine/      # AI story engine
├── src/                  # Frontend source code
│   ├── pages/            # Page components
│   ├── panels/           # Panel components
│   ├── layouts/          # Layout components
│   ├── stores/           # Pinia state management
│   ├── router/           # Vue Router config
│   ├── utils/            # Utility functions
│   ├── styles/           # Global styles
│   └── types/            # TypeScript definitions
├── package.json
├── vite.config.js
├── uno.config.js
└── tsconfig.json
```

## Testing

**Note**: No testing framework is currently configured. When adding tests:

- Consider using **Vitest** for unit testing (compatible with Vite)
- Use **@vue/test-utils** for Vue component testing
- Consider **Playwright** for end-to-end tests
- Database testing with in-memory SQLite

## Development Workflow

1. **Setup**: Run `npm install` then `npm run postinstall` to rebuild native modules
2. **Development**: Run `npm run dev` to start development mode
3. **Hot Reload**: Enabled for Vue components
4. **Database**: SQLite database created automatically on first run
5. **Building**: Use `npm run build:win` for Windows distribution

## Important Notes

- Native modules (better-sqlite3) require rebuilding after npm install
- Database operations are handled in the main process via IPC
- Context isolation is enabled - use preload script for secure communication
- The application supports dark mode through Element Plus theming
- AI story engine integration requires proper API key configuration

## Error Handling

- Use try-catch blocks for async operations
- Implement proper error boundaries in Vue components
- Database operations should handle SQLite errors gracefully
- IPC communication should include error handling

## Security Considerations

- Context isolation is enabled
- Use preload script for secure IPC communication
- Never expose Node.js APIs directly to renderer process
- Validate all user inputs before database operations