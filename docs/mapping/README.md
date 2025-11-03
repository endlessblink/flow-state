# Pomo-Flow - Project Structure Mapping Documentation

## Overview

This directory contains comprehensive documentation of the Pomo-Flow Vue.js application architecture, component structure, and development patterns. The documentation provides a complete understanding of the codebase for developers working on this sophisticated productivity application.

## Documentation Structure

### 📋 Core Architecture Documents

| Document | Description | Last Updated |
|----------|-------------|--------------|
| [**PROJECT_STRUCTURE_OVERVIEW.md**](./PROJECT_STRUCTURE_OVERVIEW.md) | High-level architecture overview with statistics and key insights | Nov 2, 2025 |
| [**FOLDER_STRUCTURE_MAPPING.md**](./FOLDER_STRUCTURE_MAPPING.md) | Complete directory tree with detailed descriptions | Nov 2, 2025 |
| [**VIEWS_COMPONENTS_ANALYSIS.md**](./VIEWS_COMPONENTS_ANALYSIS.md) | All 8 main views with their components and relationships | Nov 2, 2025 |
| [**STORE_ARCHITECTURE.md**](./STORE_ARCHITECTURE.md) | All Pinia stores analysis and data flow patterns | Nov 2, 2025 |
| [**COMPOSABLES_CATALOG.md**](./COMPOSABLES_CATALOG.md) | All 25+ composables with purposes and usage patterns | Nov 2, 2025 |
| [**COMPONENT_RELATIONSHIP_MAP.md**](./COMPONENT_RELATIONSHIP_MAP.md) | Visual dependency relationships and hierarchies | Nov 2, 2025 |

### 🏗️ Specialized Architecture Documents

| Document | Description | Last Updated |
|----------|-------------|--------------|
| [**CANVAS_SYSTEM_ARCHITECTURE.md**](./CANVAS_SYSTEM_ARCHITECTURE.md) | Vue Flow integration and canvas-specific patterns | Nov 2, 2025 |
| [**UNDO_REDO_SYSTEM.md**](./UNDO_REDO_SYSTEM.md) | Unified undo/redo implementation details | Nov 2, 2025 |
| [**DATA_PERSISTENCE_STRATEGY.md**](./DATA_PERSISTENCE_STRATEGY.md) | IndexedDB and cloud sync architecture | Nov 2, 2025 |
| [**DEVELOPMENT_PATTERNS.md**](./DEVELOPMENT_PATTERNS.md) | Vue 3 patterns and TypeScript usage | Nov 2, 2025 |
| [**PERFORMANCE_OPTIMIZATIONS.md**](./PERFORMANCE_OPTIMIZATIONS.md) | Performance patterns and optimizations | Nov 2, 2025 |

## Quick Navigation

### 🔍 For New Developers

1. **Start Here**: [PROJECT_STRUCTURE_OVERVIEW.md](./PROJECT_STRUCTURE_OVERVIEW.md)
2. **Understand the Codebase**: [FOLDER_STRUCTURE_MAPPING.md](./FOLDER_STRUCTURE_MAPPING.md)
3. **Learn the Views**: [VIEWS_COMPONENTS_ANALYSIS.md](./VIEWS_COMPONENTS_ANALYSIS.md)
4. **Master State Management**: [STORE_ARCHITECTURE.md](./STORE_ARCHITECTURE.md)

### 🛠️ For Feature Development

1. **Component Patterns**: [DEVELOPMENT_PATTERNS.md](./DEVELOPMENT_PATTERNS.md)
2. **Composable Usage**: [COMPOSABLES_CATALOG.md](./COMPOSABLES_CATALOG.md)
3. **Component Relationships**: [COMPONENT_RELATIONSHIP_MAP.md](./COMPONENT_RELATIONSHIP_MAP.md)
4. **Performance Considerations**: [PERFORMANCE_OPTIMIZATIONS.md](./PERFORMANCE_OPTIMIZATIONS.md)

### 🔧 For System Architecture

1. **Canvas System**: [CANVAS_SYSTEM_ARCHITECTURE.md](./CANVAS_SYSTEM_ARCHITECTURE.md)
2. **Undo/Redo System**: [UNDO_REDO_SYSTEM.md](./UNDO_REDO_SYSTEM.md)
3. **Data Persistence**: [DATA_PERSISTENCE_STRATEGY.md](./DATA_PERSISTENCE_STRATEGY.md)
4. **Store Architecture**: [STORE_ARCHITECTURE.md](./STORE_ARCHITECTURE.md)

## Project Statistics

### Application Scale
- **Total Files**: 200+ source files
- **Vue Components**: 83 components organized in logical directories
- **TypeScript/JavaScript Files**: 113 files including stores, composables, and utilities
- **Main Views**: 8 specialized views
- **Pinia Stores**: 10+ stores for state management
- **Composables**: 25+ reusable composables

### Store Complexity
- **Largest Store**: `tasks.ts` (1,786 lines) - Central task management
- **Second Largest**: `canvas.ts` (974 lines) - Canvas state and Vue Flow
- **Third Largest**: `timer.ts` (539 lines) - Pomodoro functionality

### Technology Stack
- **Vue 3.4.0** with Composition API and `<script setup>` syntax
- **TypeScript 5.9.3** for full type safety
- **Vite 7.1.10** for development and builds
- **Pinia** for centralized state management

## Key Architecture Highlights

### 🎯 Multi-View SPA Architecture
- **BoardView** - Kanban board with project swimlanes
- **CalendarView** - Time-based task scheduling
- **CanvasView** - Free-form visual organization
- **CatalogView** - Master task catalog (RENAMED from AllTasksView)
- **FocusView** - Pomodoro-focused sessions
- **QuickSortView** - Rapid task categorization

### 🔄 Unified State Management
- **Centralized Pinia stores** for all application state
- **Unified undo/redo system** with 50-entry capacity
- **Debounced persistence** to prevent excessive database writes
- **Real-time synchronization** capabilities

### 🎨 Advanced Task Management
- **Task Instance System** for flexible calendar scheduling
- **Hierarchical task relationships** (parent-child nesting)
- **Multi-criteria filtering** (status, priority, project, date)
- **Visual dependency management** on canvas

### ⚡ Performance Optimizations
- **Virtual scrolling** for large lists
- **Computed properties** for efficient reactive calculations
- **Lazy loading** of components and data
- **GPU acceleration** helpers in CSS

## Development Workflow

### Essential Commands
```bash
# Development server (port 5546)
npm run dev

# Process cleanup (CRITICAL - do not remove)
npm run kill

# Production build
npm run build

# Testing
npm run test

# Component documentation
npm run storybook
```

### Testing Strategy
- **Playwright Testing** mandatory for visual verification
- **Vitest Unit Testing** for logic verification
- **Manual Testing** required before claiming features work
- **Performance Monitoring** with built-in tools

## Documentation Versions

- **Current Version**: November 3, 2025
- **Framework Version**: Vue 3.4.0, Vite 7.1.10, TypeScript 5.9.3
- **Latest Version**: Available in `./3.11.25/` directory (updated with CatalogView and smart filtering)
- **Previous Archive**: Available in `./2.11.25/` directory

## Contributing to Documentation

When making changes to the codebase:

1. **Update relevant documentation** to reflect architectural changes
2. **Maintain consistency** across all documentation files
3. **Update timestamps** when documents are modified
4. **Create backup** in versioned directory before major changes
5. **Validate links** and references between documents

## Document Templates

### Component Documentation Template
```markdown
## ComponentName.vue
**Purpose**: Brief description of component's role
**Props**: List of props with types and descriptions
**Emits**: Events emitted by the component
**Store Dependencies**: Which stores this component uses
**Composables**: Which composables are used
**Child Components**: List of child components
```

### Store Documentation Template
```markdown
## StoreName
**Purpose**: Primary role of this store
**State**: List of state variables with types
**Getters**: Computed properties and their purposes
**Actions**: Available actions and their effects
**Persistence**: How data is persisted
**Integration**: How it integrates with other stores
```

## Support and Questions

For questions about the architecture:

1. **Check the documentation** first - most answers are here
2. **Search the codebase** for specific implementations
3. **Review related components** for usage patterns
4. **Consult the development patterns** document for best practices

## Architecture Philosophy

Pomo-Flow follows these core principles:

- **Type Safety First** - Comprehensive TypeScript usage
- **Performance Conscious** - Optimized for large datasets
- **User Experience Focused** - Smooth interactions and visual feedback
- **Maintainable Code** - Clear patterns and documentation
- **Scalable Architecture** - Built for growth and new features

This documentation serves as the definitive guide to understanding and working with the Pomo-Flow codebase.

**Last Updated**: November 3, 2025
**Documentation Version**: 3.11.25
**Architecture Version**: Vue 3.4.0, Composition API
**Recent Updates**: AllTasksView renamed to CatalogView, enhanced smart filtering system, counter consistency fixes