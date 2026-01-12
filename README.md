# Pomo-Flow

A sophisticated Vue 3 productivity application combining Pomodoro timer functionality with task management across multiple views.

## Features

- **7 Task Views**: Board, Calendar, Canvas, Focus, QuickSort, AllTasks, CalendarVueCal
- **Pomodoro Timer**: Work/break sessions with browser notifications
- **Task Management**: Projects, priorities, due dates, subtasks, recurring tasks
- **Canvas Organization**: Free-form spatial task arrangement with Vue Flow
- **Cloud Sync**: Supabase (PostgreSQL) with RLS and automatic backup
- **Glass Morphism UI**: Modern design system with dark/light themes

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
# Open http://localhost:5546
```

## Cloud Sync (Supabase)

Pomo-Flow uses Supabase for cloud sync with Row Level Security (RLS).

### Local Development

```bash
# Start local Supabase
npx supabase start

# Generate JWT keys (if needed)
npm run generate:keys
```

See `.env.example` for configuration options.

## Development Commands

```bash
npm run dev          # Development server (port 5546)
npm run build        # Production build
npm run test         # Run tests
npm run test:watch   # Tests with UI
npm run storybook    # Component documentation (port 6006)
npm run kill         # Kill all PomoFlow processes
npm run lint         # Lint code
npm run lint:fix     # Fix linting issues
```

## Technology Stack

- **Core**: Vue 3 + TypeScript + Pinia
- **UI**: Tailwind CSS + Naive UI + Lucide Icons
- **Canvas**: Vue Flow (@vue-flow/core)
- **Calendar**: vue-cal
- **Storage**: Supabase (PostgreSQL) with RLS
- **Build**: Vite 7.2.4
- **Testing**: Vitest + Playwright

## Project Structure

```
src/
├── views/           # 7 application views
├── components/      # Reusable UI components (10 directories)
├── stores/          # 12 Pinia stores
├── composables/     # 56 Vue 3 composables
├── assets/          # Styles and design tokens
└── utils/           # Utility functions
```

## Documentation

- **CLAUDE.md** - Development guidance and patterns
- **docs/MASTER_PLAN.md** - Project roadmap and architecture

## License

MIT
