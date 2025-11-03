# Pomo-Flow Documentation Index

## 🏗️ System Architecture & Core Documentation

| Document | Description | Path |
|----------|-------------|------|
| **Project Architecture** | Complete system architecture, tech stack, and component structure | `system/project-architecture.md` |
| **Database Schema** | IndexedDB data models, persistence patterns, and data flow | `system/database.md` |
| **Mistakes & Troubleshooting** | Common development errors and debugging procedures | `sop/mistakes-troubleshooting.md` |

## Source Code Documentation

### Core Application Files

| Document | Description | Path |
|----------|-------------|------|
| **Main Entry Point** | Vue 3 application bootstrap and plugin initialization | `src/main.ts` |
| **Root Component** | Main application layout with sidebar navigation and timer | `src/App.vue` |
| **Router Configuration** | Vue Router setup for Board, Calendar, Canvas, and Design System views | `src/router/index.ts` |

### State Management

| Document | Description | Path |
|----------|-------------|------|
| **Task Store** | Pinia store for task management with IndexedDB persistence | `src/stores/tasks.ts` |
| **Timer Store** | Pomodoro timer state management with session tracking | `src/stores/timer.ts` |
| **Theme Store** | Application theme management (light/dark mode) | `src/stores/theme.ts` |
| **Canvas Store** | Canvas-specific state management for task organization | `src/stores/canvas.ts` |

### Vue Components

| Document | Description | Path |
|----------|-------------|------|
| **Board View** | Kanban board with swimlanes, drag-drop, Done column toggle with Circle/CheckCircle icons | `src/views/BoardView.vue` |
| **Calendar View** | Calendar interface for time-based task management with project filtering and visual project indicators | `src/views/CalendarView.vue` |
| **Canvas View** | Free-form task organization canvas | `src/views/CanvasView.vue` |
| **Design System View** | Component library and design token documentation | `src/views/DesignSystemView.vue` |

#### Base Components

| Document | Description | Path |
|----------|-------------|------|
| **Button Component** | Reusable button with variants and sizes | `src/components/base/BaseButton.vue` |
| **Input Component** | Form input with validation and styling | `src/components/base/BaseInput.vue` |
| **Modal Component** | Dialog/modal component with overlay | `src/components/base/BaseModal.vue` |
| **Card Component** | Container component for content sections | `src/components/base/BaseCard.vue` |
| **Icon Component** | Icon rendering component with multiple libraries | `src/components/base/BaseIcon.vue` |
| **Badge Component** | Status and category indicators | `src/components/base/BaseBadge.vue` |

#### Feature Components

| Document | Description | Path |
|----------|-------------|------|
| **Task Card** | Individual task display with editing capabilities | `src/components/kanban/TaskCard.vue` |
| **Task Column** | Kanban column for task organization with Done column support | `src/components/kanban/TaskColumn.vue` |
| **Quick Task Create** | Rapid task creation interface | `src/components/QuickTaskCreate.vue` |
| **Quick Task Create Modal** | Modal component for canvas task creation with positioning | `src/components/QuickTaskCreateModal.vue` |
| **Task Context Menu** | Right-click menu for task actions | `src/components/TaskContextMenu.vue` |
| **Settings Modal** | Application settings with Done column toggle and bidirectional sync | `src/components/SettingsModal.vue` |
| **Project Modal** | Project management interface | `src/components/ProjectModal.vue` |
| **Confirmation Modal** | Dialog for confirming destructive actions | `src/components/ConfirmationModal.vue` |
| **Project Filter Dropdown** | Reusable dropdown for project filtering with hierarchy and task counts | `src/components/ProjectFilterDropdown.vue` |

#### Canvas Components

| Document | Description | Path |
|----------|-------------|------|
| **Canvas Container** | Main canvas area with task positioning | `src/components/canvas/CanvasContainer.vue` |
| **Canvas Task** | Individual task items on canvas | `src/components/canvas/CanvasTask.vue` |
| **Canvas Toolbar** | Canvas manipulation tools | `src/components/canvas/CanvasToolbar.vue` |
| **Canvas Grid** | Background grid for canvas alignment | `src/components/canvas/CanvasGrid.vue` |
| **Canvas Minimap** | Overview navigation for large canvases | `src/components/canvas/CanvasMinimap.vue` |
| **Canvas Selection** | Multi-select functionality | `src/components/canvas/CanvasSelection.vue` |
| **Canvas Connections** | Visual task relationships | `src/components/canvas/CanvasConnections.vue` |
| **Canvas Zoom** | Zoom controls and functionality | `src/components/canvas/CanvasZoom.vue` |

### Composables

| Document | Description | Path |
|----------|-------------|------|
| **Theme Management** | Theme switching and persistence logic | `src/composables/useTheme.ts` |
| **Database Operations** | IndexedDB abstraction layer | `src/composables/useDatabase.ts` |
| **Favicon Management** | Dynamic favicon updates for timer status | `src/composables/useFavicon.ts` |
| **Calendar Drag Create** | Drag-to-create calendar events functionality | `src/composables/useCalendarDragCreate.ts` |
| **Calendar Event Helpers** | Project color and task helper functions for calendar events | `src/composables/calendar/useCalendarEventHelpers.ts` |

### Configuration

| Document | Description | Path |
|----------|-------------|------|
| **Theme Configuration** | Theme definitions and color schemes | `src/config/themes.ts` |

## Asset & Style Documentation

| Document | Description | Path |
|----------|-------------|------|
| **Design Tokens** | CSS custom properties for consistent design system | `src/assets/design-tokens.css` |
| **Global Styles** | Base styles and utility classes | `src/assets/styles.css` |
| **Application Icon** | Favicon and application icon | `public/favicon.ico` |
| **HTML Template** | Main HTML template for the application | `index.html` |

## Build & Development Documentation

| Document | Description | Path |
|----------|-------------|------|
| **Lock File** | Exact dependency versions for reproducible builds | `package-lock.json` |
| **Node Modules** | Installed npm dependencies | `node_modules/` |
| **Distribution Build** | Production build output directory | `dist/` |

## 📚 External Documentation & Resources

### Session Context & Development History

| Document | Description | Path |
|----------|-------------|------|
| **Session Dropoff Analysis** | Recent development session with detailed accomplishments | `SESSION-DROPOFF-2025-10-06.md` |
| **Debug Screenshots** | Visual debugging references for UI issues | `docs/debug/` |
| **Test Results** | Automated test execution results | `test-results/` |
| **Playwright Screenshots** | Browser automation test screenshots | `.playwright-mcp/` |
| **Calendar Project Filter Tests** | Comprehensive Playwright test suite for calendar project filtering functionality | `tests/calendar-project-filter.spec.ts` |

### Design System Documentation

| Document | Description | Path |
|----------|-------------|------|
| **Design System Guidelines** | Comprehensive design system documentation | `docs/main-docs/design-system.md` |
| **Cohesive Design Final** | Final design system implementation summary | `docs/main-docs/COHESIVE-DESIGN-FINAL-SUMMARY.md` |
| **Design Transformation Guide** | Step-by-step design overhaul process | `docs/main-docs/DESIGN_TRANSFORMATION_GUIDE.md` |
| **Design Rules** | Core design principles and implementation rules | `docs/main-docs/DESIGN-RULES.md` |
| **Final Setup Guide** | Complete project setup and configuration guide | `docs/main-docs/final-setup.md` |

### Development Tools & Frameworks

| Document | Description | Path |
|----------|-------------|------|
| **Analysis Scripts** | JavaScript utilities for code analysis and token generation | `scripts/` |
| **External MCP Servers** | Model Context Protocol servers for enhanced development | `external-mcp-servers-bmad/` |
| **Bmad Core Configuration** | Bmad framework core settings and agent teams | `.bmad-core/` |
| **Bmad Setup** | Bmad framework configuration and setup instructions | `docs/main-docs/bmad-setup.md` |

## 🚀 Quick Start & Current Status

### Development Environment Setup
```bash
# Start main application (port 5546)
npm run dev

# Start design system documentation (port 6008)
cd design-system && npm run dev

# Run tests
npm run test

# Build for production
npm run build
```

### Current Feature Status (as of October 2025)
- ✅ **Board View**: Kanban with swimlanes, drag-drop, project grouping, Done column toggle
- ✅ **Calendar View**: Time-based scheduling with drag-create functionality and project filtering
- ✅ **Canvas View**: Free-form organization with task connections and alignment tools
- ✅ **Design System**: Custom Vue app with click-to-copy component documentation
- ✅ **Theme System**: Dark/light mode with consistent design tokens
- ✅ **Data Persistence**: IndexedDB with auto-save and migration support

### Key Architectural Decisions
- **Custom Design System** over Storybook for click-to-copy workflow
- **Task Instance System** for calendar scheduling with backward compatibility
- **Vue Flow** for canvas with custom context menus and alignment tools
- **Glass Morphism** design with consistent dark/light themes
- **Fully Offline** with client-side IndexedDB storage

### Recent Major Updates (October 2025)
- Implemented task instances system for flexible calendar scheduling
- Built custom design system app replacing Storybook
- Added canvas alignment tools and context menus
- Created board view swimlanes for project organization
- **Done Column Toggle**: Added Circle/CheckCircle toggle button in kanban header with localStorage persistence and Settings sync
- **Fixed critical canvas bugs**: Task dragging constraints, section collapse/expand, task transparency issues
- **Quick Task Create Modal**: Enhanced canvas task creation with modal workflow and proper positioning
- **Calendar Project Filtering**: Added project filter dropdown to CalendarView with visual project indicators and comprehensive testing
- Established comprehensive documentation structure

---

*Last Updated: October 17, 2025*
*Development Framework: Vue 3 + TypeScript + Vite*
*Documentation Version: 2.0*

## 🔗 System Interconnections & Architecture

### Data Flow Architecture
```
User Input → Vue Components → Pinia Stores → IndexedDB → UI Updates
     ↓              ↓              ↓           ↓         ↓
Timer Events → Timer Store → Favicon Updates → Visual Feedback
     ↓              ↓              ↓           ↓
Composables ← Reactive State ← Auto-save ← Local Storage
```

### Component Hierarchy
```
App.vue
├── Sidebar Navigation
├── Timer Display
├── Router View
│   ├── BoardView (Kanban with Swimlanes)
│   ├── CalendarView (Time-based scheduling)
│   ├── CanvasView (Free-form with connections)
│   └── DesignSystemView (Component documentation)
└── Modal Overlays
```

### Store Dependencies & Data Models
- **Task Store**: Central state with instance-based scheduling system
- **Timer Store**: Pomodoro sessions and progress tracking
- **Theme Store**: Dark/light mode with design token management
- **Canvas Store**: Node positioning and dependency connections

### Design System Architecture
- **Design Tokens**: CSS custom properties in `src/assets/design-tokens.css`
- **Custom Design System App**: Separate Vue app on port 6008 with click-to-copy
- **Component Library**: Reusable base components in `src/components/base/`
- **Glass Morphism**: Consistent visual design across all components

## 🔄 Development Workflow & Best Practices

### Standard Development Process
1. **Component Development**: Create components in appropriate feature directories
2. **State Management**: Use Pinia stores for shared state
3. **Styling**: Apply design tokens through Tailwind classes
4. **Critical Testing**: **ALWAYS verify with Playwright MCP before claiming functionality works**
5. **Documentation**: Update this index when adding new files

### Development Philosophy
- **Perfect UX trumps faster implementation** - This is a personal productivity tool
- **No compromises** - Build exactly what's needed for the specific workflow
- **Visual confirmation required** - Never claim features work without browser testing
- **Click-to-copy essential** - Custom design system built for specific user needs

### Key Rules
1. **Test with Playwright First** - Visual confirmation is mandatory
2. **Use Design Tokens** - Never hardcode colors or values
3. **Maintain Backward Compatibility** - Especially for data migrations
4. **Document Real Issues** - Update troubleshooting guide with actual problems

## 📋 Project Configuration & Development Setup

| Document | Description | Path |
|----------|-------------|------|
| **Project Configuration** | Core project metadata and dependencies | `package.json` |
| **TypeScript Configuration** | TypeScript compiler settings and path mappings | `tsconfig.json` |
| **Build Configuration** | Vite build tool configuration and plugins | `vite.config.ts` |
| **Tailwind Configuration** | Tailwind CSS customization and design tokens | `tailwind.config.js` |
| **PostCSS Configuration** | PostCSS processing configuration | `postcss.config.js` |
| **Git Ignore** | Files and directories excluded from version control | `.gitignore` |
| **Agent Configuration** | MCP server and development tool settings | `.mcp.json` |
| **Development Guidelines** | Claude AI development protocols and standards | `CLAUDE.md` |
| **Agent Instructions** | Development agent configuration and workflows | `AGENTS.md` |

### Core Technology Stack
- **Vue 3**: Composition API with `<script setup>` syntax
- **TypeScript**: Full type safety with path aliases
- **Vite**: Fast development server and optimized builds
- **Tailwind CSS**: Utility-first styling with custom design tokens
- **Pinia**: Vue 3 state management with persistence
- **IndexedDB**: Client-side data persistence for offline functionality
