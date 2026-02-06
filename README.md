# FlowState

A sophisticated Vue 3 productivity application combining Pomodoro timer functionality with task management across multiple views.

**Live demo:** [in-theflow.com](https://in-theflow.com)

## Features

- **8 Task Views**: Board, Calendar, Canvas, Focus, QuickSort, AllTasks, CalendarVueCal, Performance
- **Pomodoro Timer**: Work/break sessions with browser notifications
- **Task Management**: Projects, priorities, due dates, subtasks, recurring tasks
- **Canvas Organization**: Free-form spatial task arrangement with Vue Flow
- **Cloud Sync**: Supabase (PostgreSQL) with RLS and automatic backup
- **Glass Morphism UI**: Modern design system with dark/light themes
- **PWA (Mobile Support)**: Installable on iOS/Android with offline support and screen wake lock for timers
- **Gamification**: XP, achievements, streaks, and a cosmetic shop
- **Desktop App**: Native Tauri builds for Linux, macOS, and Windows

## Quick Start

```bash
# Install dependencies
npm install

# Start local Supabase (requires Docker)
npx supabase start

# Copy environment config
cp .env.example .env.local
# Edit .env.local with values from `npx supabase status`

# Start development server
npm run dev
# Open http://localhost:5546
# Login: dev@flowstate.local / dev123
```

## Self-Hosting

Want to run FlowState on your own machine? See **[docs/SELF-HOSTING.md](docs/SELF-HOSTING.md)** for the full guide covering local Supabase, Tauri desktop builds, and AI chat setup.

## Cloud Sync (Supabase)

FlowState uses Supabase for cloud sync with Row Level Security (RLS).

### Local Development

```bash
# Start local Supabase
npx supabase start

# Generate JWT keys (if needed)
npm run generate:keys
```

See `.env.example` for configuration options.

## PWA Installation

FlowState is fully optimized for mobile devices as a Progressive Web App:

- **iOS**: Open the app in Safari, tap the **Share** button, and select **Add to Home Screen**.
- **Android**: Open the app in Chrome, tap the menu (three dots), and select **Install App** or **Add to Home Screen**.
- **Desktop**: Look for the "Install" icon in the address bar of your browser.

## Development Commands

```bash
npm run dev          # Development server (port 5546)
npm run build        # Production build
npm run test         # Run tests
npm run test:watch   # Tests with UI
npm run storybook    # Component documentation (port 6006)
npm run kill         # Kill all FlowState processes
npm run lint         # Lint code
npm run lint:fix     # Fix linting issues
```

## Technology Stack

- **Core**: Vue 3 + TypeScript + Pinia
- **UI**: Tailwind CSS + Naive UI + Lucide Icons
- **Canvas**: Vue Flow (@vue-flow/core)
- **Calendar**: vue-cal
- **Storage**: Supabase (PostgreSQL) with RLS
- **Desktop**: Tauri 2.x (Linux, macOS, Windows)
- **Build**: Vite 7.3.1
- **Testing**: Vitest + Playwright

## Project Structure

```
src/
├── views/           # 8 application views
├── components/      # Reusable UI components (22 directories)
├── stores/          # 14 Pinia stores (+canvas, tasks substores)
├── composables/     # ~130 Vue 3 composables
├── services/        # Backend services (auth, AI, sync, data)
├── assets/          # Styles and design tokens
└── utils/           # Utility functions
```

## Documentation

- **CLAUDE.md** - Development guidance and patterns
- **docs/MASTER_PLAN.md** - Project roadmap and architecture
- **docs/SELF-HOSTING.md** - Self-hosting guide

## License

MIT
