# FlowState

A sophisticated Vue 3 productivity application combining Pomodoro timer functionality with task management across multiple views.

## Features

- **8 Task Views**: Board, Calendar, Canvas, Focus, QuickSort, AllTasks, CalendarVueCal, Performance
- **Pomodoro Timer**: Work/break sessions with browser notifications
- **Task Management**: Projects, priorities, due dates, subtasks, recurring tasks
- **Canvas Organization**: Free-form spatial task arrangement with Vue Flow
- **Cloud Sync**: Supabase (PostgreSQL) with RLS and automatic backup
- **Glass Morphism UI**: Modern design system with dark/light themes
- **PWA (Mobile Support)**: Installable on iOS/Android with offline support and screen wake lock for timers

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
# Open http://localhost:5546
```

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
- **Build**: Vite 7.3.1
- **Testing**: Vitest + Playwright

## Project Structure

```
src/
├── views/           # 8 application views
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
