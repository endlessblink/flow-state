# Pomo-Flow Project Architecture

## Project Overview

**Pomo-Flow** is a personal productivity tool built for a single user's workflow. It combines task management, Pomodoro timer functionality, and multiple visualization modes to create a comprehensive productivity system.

### Core Philosophy
- **Perfect UX trumps faster implementation** - This is a personal tool, not a commercial product
- **No compromises** - Build exactly what's needed for the user's specific workflow
- **Visual-first design** - Multiple views (Board, Calendar, Canvas) for different productivity styles

## Technology Stack

### Frontend Framework
- **Vue 3** with Composition API (`<script setup>` syntax)
- **TypeScript** for full type safety
- **Vite** as build tool and development server
- **Port**: 5546 (development)

### UI & Styling
- **Tailwind CSS** with custom design tokens
- **Glass morphism design system** with dark/light themes
- **CSS custom properties** for consistent theming
- **Lucide Vue Next** for icons
- **Headless UI** for accessible components

### State Management
- **Pinia** for Vue 3 state management
- **IndexedDB** via **LocalForage** for client-side persistence
- **Reactive computed properties** for filtered views

### Routing & Navigation
- **Vue Router 4** for SPA navigation
- **Programmatic navigation** between Board, Calendar, Canvas views
- **Active state indicators** in sidebar

### Data Visualization
- **Vue Flow** (@vue-flow/core) for Canvas view with task nodes
- **Vue Cal** for Calendar view integration
- **Drag and drop** via **Vue Draggable** for Kanban board
- **@vueuse/gesture** for enhanced interactions

### Build & Development Tools
- **ESLint** with Vue and TypeScript configurations
- **Vitest** for unit testing
- **Playwright** for E2E testing (critical validation requirement)
- **PostCSS** with Tailwind processing

## Project Structure

```
pomo-flow/
├── src/                          # Main application source
│   ├── components/               # Vue components
│   │   ├── base/                # Reusable base components
│   │   ├── kanban/              # Board view components
│   │   ├── canvas/              # Canvas view components
│   │   └── *.vue                # Feature components
│   ├── composables/             # Vue composition functions
│   ├── stores/                  # Pinia stores
│   ├── views/                   # Main view components
│   ├── router/                  # Vue Router configuration
│   ├── config/                  # App configuration
│   └── assets/                  # Static assets and styles
├── design-system/               # Custom design system app
│   ├── src/pages/              # Component documentation
│   └── src/components/         # Showcase utilities
├── docs/                       # Project documentation
├── scripts/                    # Build and utility scripts
└── .agent/                     # Development documentation
```

## Core Architecture Patterns

### 1. Component Architecture

**Base Components** (`src/components/base/`)
- Reusable UI primitives (Button, Input, Modal, Card, etc.)
- Consistent styling with design tokens
- props/events interface for flexibility

**Feature Components**
- **Kanban**: TaskCard, TaskColumn, KanbanSwimlane
- **Canvas**: CanvasTask, CanvasConnections, CanvasSelection
- **Calendar**: Calendar event components and time grid

### 2. State Management Architecture

**Task Store** (`src/stores/tasks.ts`)
- Central task data with IndexedDB persistence
- Computed filtered views (by project, date, smart views)
- Task instance system for calendar scheduling
- Subtask and project management

**Theme Store** (`src/stores/theme.ts`)
- Dark/light mode switching
- CSS custom property management
- Persistent theme preferences

**Timer Store** (`src/stores/timer.ts`)
- Pomodoro session management
- Task progress tracking
- Favicon status updates

**Canvas Store** (`src/stores/canvas.ts`)
- Canvas-specific positioning data
- Task connections and dependencies
- Selection and viewport state

### 3. Data Flow Architecture

```
User Interaction → Vue Component → Pinia Store → IndexedDB
      ↓                ↓              ↓           ↓
Composables ← Reactive State → Auto-save ← Local Storage
      ↓                ↓              ↓
UI Updates ← Computed Properties ← Store Getters
```

**Key Patterns:**
- **Debounced auto-save** (1 second) to prevent excessive DB writes
- **Reactive computed properties** for filtered task views
- **Composable functions** for reusable logic (useTheme, useDatabase, etc.)
- **Event-driven updates** between components and stores

### 4. View Architecture

**Multi-View System**
- **Board View**: Kanban-style task organization with swimlanes
- **Calendar View**: Time-based task scheduling with drag-and-drop
- **Canvas View**: Free-form task organization with connections
- **Design System**: Component documentation and showcase

**Navigation Pattern**
- Sidebar navigation with active state indicators
- Keyboard shortcuts for quick view switching
- Persistent view state across sessions

## Database Architecture

### IndexedDB Schema

**Primary Stores** (via LocalForage)
- `tasks`: Complete task objects with instances and metadata
- `projects`: Project definitions with view preferences
- `canvas`: Canvas-specific layout and connection data
- `timer`: Timer session history and preferences
- `settings`: Application configuration and user preferences

### Task Data Model

```typescript
interface Task {
  id: string                    // Unique identifier
  title: string                 // Task title
  description: string           // Detailed description
  status: TaskStatus           // planned | in_progress | done | backlog | on_hold
  priority: TaskPriority       // low | medium | high | null
  progress: number             // 0-100 completion percentage
  completedPomodoros: number   // Completed pomodoro sessions
  subtasks: Subtask[]          // Nested subtask structure
  dueDate: string              // ISO date string
  instances: TaskInstance[]    // Calendar occurrences (NEW)
  projectId: string            // Project association
  createdAt: Date              // Creation timestamp
  updatedAt: Date              // Last modification
  
  // Canvas-specific fields
  canvasPosition?: { x: number; y: number }
  isInInbox?: boolean          // Unpositioned tasks
  dependsOn?: string[]         // Task dependencies
  connectionTypes?: { [taskId: string]: ConnectionType }
}
```

**Task Instance System**
- Tasks can have multiple calendar instances (reuse functionality)
- Backward compatibility with legacy scheduledDate/scheduledTime fields
- Instance-specific duration and pomodoro tracking
- Special "Later" instances for future planning

## Integration Points

### 1. Design System Integration
- **CSS custom properties** for consistent theming
- **Component library** with click-to-copy documentation
- **Design tokens** centralized in `src/assets/design-tokens.css`
- **Hot reload** design system app on port 6008

### 2. External Services
- **No external API dependencies** (fully offline-capable)
- **Local storage only** for data privacy and persistence
- **Browser APIs** for clipboard, notifications, favicon updates

### 3. Development Tools
- **MCP Server integration** for enhanced development workflow
- **Playwright testing** for visual validation
- **Custom scripts** for design token generation and analysis

## Performance Considerations

### 1. State Management
- **Debounced persistence** to prevent excessive IndexedDB writes
- **Computed properties** for efficient filtering and sorting
- **Lazy loading** of large data sets

### 2. Rendering Optimization
- **Vue 3 Composition API** for better reactivity performance
- **Virtual scrolling** for large task lists (where applicable)
- **Efficient drag-and-drop** with optimized event handlers

### 3. Bundle Optimization
- **Vite tree-shaking** for minimal bundle size
- **Dynamic imports** for code splitting
- **Optimized dependencies** via package.json

## Security & Privacy

### Data Privacy
- **Client-side only** data storage (no server transmission)
- **IndexedDB encryption** via browser security
- **No third-party analytics** or tracking

### Application Security
- **Content Security Policy** considerations
- **XSS prevention** via Vue's built-in protections
- **Secure clipboard handling** for design system

## Deployment Architecture

### Development Environment
- **Local development server** on port 5546
- **Design system server** on port 6008
- **Hot module replacement** for rapid iteration

### Production Build
- **Static site generation** via Vite build
- **Optimized assets** with compression
- **Progressive Web App** capabilities (future enhancement)

## Extensibility Points

### 1. Plugin Architecture
- **Composable pattern** for feature extensions
- **Component registration** system
- **Store module** addition capability

### 2. Theme System
- **CSS custom properties** for easy theme creation
- **Dynamic theme loading** capability
- **Component-level theme overrides**

### 3. Data Export/Import
- **JSON export** functionality for backup
- **Import capabilities** for data migration
- **API abstraction** for future cloud sync

## Known Limitations

### Current Constraints
- **Single-user design** (no multi-user features)
- **Browser-dependent** (requires modern browser support)
- **Local storage limits** (IndexedDB quota)

### Future Considerations
- **Cloud synchronization** options
- **Mobile app** development path
- **Team collaboration** features (if needed)

---

*Last Updated: October 9, 2025*
*Architecture Version: 1.0*
*Framework: Vue 3 + TypeScript + Vite*