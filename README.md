# Pomo-Flow

A sophisticated Vue 3 productivity application combining Pomodoro timer functionality with task management across multiple views (Board, Calendar, Canvas, Focus, etc.).

## Features

- **7 Task Views**:
    - **Board**: Kanban-style drag-and-drop management.
    - **Calendar**: Time-blocking and scheduling (via `vue-cal`).
    - **Canvas**: Infinite whiteboard for spatial organization (via `Vue Flow`).
    - **Focus**: Distraction-free single-task execution.
    - **AllTasks**: Comprehensive list view.
    - **QuickSort**: Rapid task categorization.
    - **CalendarVueCal**: Alternative calendar view.
- **Pomodoro Timer**: Integrated work/break sessions with browser notifications.
- **Task Management**: Projects, priorities, due dates, subtasks, and recurring tasks.
- **Offline-First Storage**:
    - **Primary**: PowerSync (SQLite/WASM) for robust local storage and sync.
    - **Cloud Sync**: Seamless synchronization with Supabase/PostgreSQL.
    - **Legacy Support**: Migration utilities for PouchDB (IndexedDB).
- **Glass Morphism UI**: Modern, responsive design using Tailwind CSS and Naive UI.

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5546` in your browser.

## Architecture & Tech Stack

- **Frontend Framework**: Vue 3 (Composition API) + TypeScript + Vite
- **State Management**: Pinia
- **Styling**: Tailwind CSS + Naive UI
- **Database**:
    - **Local**: PowerSync (SQLite/WASM)
    - **Remote**: Supabase (PostgreSQL)
- **Key Libraries**:
    - `@vue-flow/core`: For the Canvas view.
    - `vue-cal`: For the Calendar view.
    - `lucide-vue-next`: For icons.

## Developer Tools

### Agentic Workflow (`dev-manager`)

Pomo-Flow includes a specialized backend for AI agents to interact with the codebase and runtime.

- **Start Manager**: `npm run dev:manager`
- **Features**:
    - Terminal emulation for executing local commands.
    - File context injection for agents.
    - "Review Changes" workflow.
    - **Note**: Requires local Node.js environment.

### Testing

- **Unit/Component Tests**: `npm run test` (Vitest)
- **E2E Tests**: `npm run test:e2e` (Playwright)
- **Safety Tests**: `npm run test:safety`

## Documentation

- **`AGENTS.md`**: Critical rules for AI agents (e.g., **NO DEMO DATA**).
- **`docs/MASTER_PLAN.md`**: Comprehensive project roadmap and status.
- **`CLAUDE.md`**: Coding guidelines and patterns.

## License

MIT
