# Pomo-Flow

A sophisticated Vue 3 productivity application combining Pomodoro timer functionality with task management across multiple views.

## Features

- **7 Task Views**:
    - **All Tasks**: Comprehensive list view.
    - **Board**: Kanban-style board.
    - **Calendar**: Month/week/day views.
    - **Canvas**: Free-form spatial task arrangement with Vue Flow.
    - **Focus**: Distraction-free single task view.
    - **QuickSort**: Rapidly categorize inbox tasks.
    - **CalendarVueCal**: Alternative calendar implementation.
- **Pomodoro Timer**: Work/break sessions with browser notifications and comprehensive timer management.
- **Task Management**: Projects, priorities, due dates, subtasks, recurring tasks.
- **Dev Manager**: Integrated agentic development dashboard for tracking project progress via `MASTER_PLAN.md`.
- **Persistent Storage**: Robust offline-first storage using PowerSync (SQLite/WASM) with Supabase synchronization.
- **Glass Morphism UI**: Modern design system with dark/light themes using Tailwind CSS and Naive UI.

## Quick Start

### Prerequisites
- Node.js >= 20.19.0
- npm >= 10.0.0

### Installation

```bash
# Install dependencies (requires legacy-peer-deps due to Storybook/Vite conflicts)
npm install --legacy-peer-deps
```

### Development

```bash
# Start development server
npm run dev
# Open http://localhost:5546

# Start Dev Manager (Agent Dashboard)
npm run dev:manager
# Open http://localhost:6010
```

## Storage & Sync

Pomo-Flow uses an offline-first architecture:
- **Local**: SQLite via PowerSync (WASM) for robust local storage.
- **Remote**: Supabase (PostgreSQL) for cloud synchronization.

Configuration files:
- `powersync-config.yaml`
- `sync-rules.yaml`

## Development Commands

```bash
npm run dev          # Development server (port 5546)
npm run dev:manager  # Dev Manager dashboard (port 6010)
npm run build        # Production build
npm run test         # Run unit tests (Vitest)
npm run test:watch   # Tests with UI
npm run storybook    # Component documentation (port 6006)
npm run lint         # Lint code
npm run type-check:watch # TypeScript type checking
```

## Technology Stack

- **Core**: Vue 3 + TypeScript + Pinia
- **UI**: Tailwind CSS + Naive UI + Lucide Icons
- **Canvas**: Vue Flow (@vue-flow/core)
- **Calendar**: vue-cal
- **Storage**: PowerSync (SQLite/WASM) + Supabase
- **Build**: Vite 7.2.4
- **Testing**: Vitest + Playwright

## Project Structure

```
src/
├── views/           # Application views (AllTasks, Board, Canvas, etc.)
├── components/      # Reusable UI components
├── stores/          # Pinia state management
├── services/        # Business logic and storage services (PowerSync, etc.)
├── composables/     # Vue 3 composables
├── assets/          # Styles and design tokens
└── utils/           # Utility functions

dev-manager/         # Standalone agentic development dashboard
```

## Documentation

- **CLAUDE.md** - Development guidance and patterns
- **docs/MASTER_PLAN.md** - Project roadmap and architecture
- **AGENTS.md** - Instructions for AI agents working on the codebase

## License

MIT
