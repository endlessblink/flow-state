# Pomo-Flow

A sophisticated Vue 3 productivity application combining Pomodoro timer functionality with comprehensive task management across multiple synchronized views. Designed for developers and power users who need flexible ways to visualize and manage their work.

## Features

### 🖥️ Multi-View Task Management
- **Canvas View**: Free-form spatial task arrangement using Vue Flow. Organize tasks visually with groups and connectors.
- **Board View**: Classic Kanban-style columns for stage-based workflow management.
- **Calendar View**: Time-based planning with drag-and-drop scheduling (featuring standard and VueCal implementations).
- **Focus View**: Distraction-free interface for the current active task, integrated with the timer.
- **Quick Sort**: A specialized view for rapidly processing and categorizing inbox tasks.
- **All Tasks**: A comprehensive list view with advanced filtering and sorting.

### 🍅 Productivity Tools
- **Pomodoro Timer**: Integrated work/break sessions with browser notifications and audio cues.
- **Smart Organization**: Nestable projects, priority levels, tags, and duration estimates.
- **Unified Task Service**: Centralized coordination connecting the Pomo-Flow app with external tools like the Markdown Task Manager and GitHub issues.

### 🔄 Data & Sync
- **Local-First Architecture**: Built on **PowerSync** (SQLite/WASM) for robust offline capability and instant local updates.
- **Seamless Synchronization**: Background syncing with Supabase/Postgres (configurable).
- **Data Persistence**: Automatic local backup and conflict resolution.

## Technology Stack

- **Core**: Vue 3 (Composition API) + TypeScript
- **State Management**: Pinia
- **UI Framework**: Tailwind CSS + Naive UI
- **Icons**: Lucide Vue Next
- **Visualizations**: @vue-flow/core (Canvas), vue-cal (Calendar)
- **Database**: PowerSync (SQLite via WASM) + Supabase
- **Testing**: Vitest (Unit) + Playwright (E2E)
- **Build Tool**: Vite 7

## Quick Start

### Prerequisites
- Node.js >= 20.19.0
- npm >= 10.0.0

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd pomo-flow

# Install dependencies (legacy-peer-deps may be required due to Storybook/Vite 7 conflicts)
npm install
```

### Running the App

```bash
# Start the development server
npm run dev
# The app will be available at http://localhost:5546
```

## Development Tools

### Standalone Dev Manager
The project includes a standalone Kanban board tool for managing the project's own roadmap, parsing `docs/MASTER_PLAN.md`.

```bash
# Start the dev manager
npm run dev:manager
```

### Testing & Quality

```bash
# Run unit tests
npm run test

# Run tests with UI
npm run test:watch

# Run end-to-end tests
npm run test:task-flows

# Linting
npm run lint
```

### Component Library
Explore the UI components in isolation:

```bash
npm run storybook
# Opens Storybook at http://localhost:6006
```

## Project Structure

```
src/
├── views/           # Application views (Canvas, Board, Calendar, etc.)
├── components/      # Reusable Vue components
├── stores/          # Pinia state stores (Tasks, UI, Auth)
├── services/        # Core logic (UnifiedTaskService, PowerSync)
├── composables/     # Shared logic (Vue 3 hooks)
├── layouts/         # App shells (Sidebar, Header)
├── assets/          # Styles and static assets
└── types/           # TypeScript interfaces
```

## Documentation

- **docs/MASTER_PLAN.md**: Comprehensive project roadmap and architecture.
- **CLAUDE.md**: Developer guidelines and common commands.
- **AGENTS.md**: Instructions for AI agents working on the codebase.

## License

MIT
