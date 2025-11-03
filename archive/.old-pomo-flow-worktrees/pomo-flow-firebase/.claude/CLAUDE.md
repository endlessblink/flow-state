# CLAUDE.md - Pomo-Flow Project

## Project Overview

**Pomo-Flow** is a Vue 3 productivity application combining Pomodoro timer with task management across Board, Calendar, and Canvas views.

## Technology Stack

- **Vue 3** with Composition API, TypeScript
- **Pinia** for state management
- **Tailwind CSS** for styling
- **Vite** for development tooling
- **IndexedDB** for data persistence

## Development Commands

```bash
npm run dev          # Start development server (port 5546)
npm run build        # Production build
npm run test         # Run tests
npm run test:watch   # Tests with UI
npm run storybook   # Component documentation (port 6006)
```

## Project Architecture

### Stores (Pinia)
- **tasks.ts** - Task management with undo/redo (1786 lines)
- **canvas.ts** - Canvas state and Vue Flow integration (974 lines)
- **timer.ts** - Pomodoro timer functionality (539 lines)
- **ui.ts** - Application UI state

### Key Features
- Unified undo/redo system with VueUse
- IndexedDB persistence via LocalForage
- Canvas with Vue Flow (node-based task organization)
- Multiple task views (Board, Calendar, Canvas)
- Real-time Pomodoro sessions

## Performance Guidelines

### MCP Dashboard Performance
- **Server**: Use circular buffers for O(1) event operations
- **Client**: Virtual scrolling for large event lists
- **Caching**: Cache calculated metrics to prevent redundant operations
- **DOM Updates**: Use DocumentFragment instead of innerHTML

### Task Store Optimization
- Debounced saves (1 second) to prevent excessive writes
- Lazy loading of task instances
- Efficient computed properties for filtering

## Testing Requirements

**ALWAYS test with Playwright before claiming features work:**
- Visual confirmation required
- Automated tests insufficient
- User testing is final authority

## Common Issues

### Undo/Redo System
- Use unified system only - no separate implementations
- Test both directions thoroughly
- Visual restoration is the only metric that matters

### Canvas Performance
- Tasks can be dragged outside sections (extent: 'parent' removed)
- Section heights preserved in collapsedHeight property
- Vue Flow parent-child relationships maintained

---
**Last Updated**: October 23, 2025
**Framework**: Vue 3.4.0, Vite 7.1.10, TypeScript 5.9.3