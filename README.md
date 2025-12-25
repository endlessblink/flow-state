# Pomo-Flow

A sophisticated Vue 3 productivity application combining Pomodoro timer functionality with task management across multiple views.

## Features

- **7 Task Views**: Board, Calendar, Canvas, Focus, QuickSort, AllTasks, CalendarVueCal
- **Pomodoro Timer**: Work/break sessions with browser notifications
- **Task Management**: Projects, priorities, due dates, subtasks, recurring tasks
- **Canvas Organization**: Free-form spatial task arrangement with Vue Flow
- **Persistent Storage**: IndexedDB via LocalForage with automatic backup
- **Glass Morphism UI**: Modern design system with dark/light themes

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
# Open http://localhost:5546
```

## Optional: Multi-Device Sync

Pomo-Flow works fully offline with local browser storage (IndexedDB). No account required!

For multi-device sync, you can self-host CouchDB:

### Quick Start (Docker)

```bash
docker run -d --name pomoflow-couchdb \
  -p 5984:5984 \
  -e COUCHDB_USER=admin \
  -e COUCHDB_PASSWORD=your-secure-password \
  couchdb:3
```

Then create a `.env` file:

```env
VITE_COUCHDB_URL=http://localhost:5984/pomoflow
VITE_COUCHDB_USERNAME=admin
VITE_COUCHDB_PASSWORD=your-secure-password
```

See `.env.example` for all configuration options.

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
- **Storage**: PouchDB (IndexedDB) + optional CouchDB sync
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
