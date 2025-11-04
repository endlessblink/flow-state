# Pomo-Flow - Complete Folder Structure Mapping

## Root Directory Structure

```
pomo-flow/
├── docs/                           # Documentation directory
│   ├── mapping/                    # Project structure documentation (THIS DOC)
│   └── mapping_2.11.25/           # Versioned backup documentation
├── public/                        # Static assets served directly
├── src/                          # Main source code directory
├── tests/                        # Test files and configurations
├── .claude/                      # Claude Code configuration
├── .git/                         # Git version control
├── .vscode/                      # VS Code settings and extensions
├── node_modules/                 # NPM dependencies
├── dist/                         # Build output directory
├── .gitignore                    # Git ignore patterns
├── CLAUDE.md                     # Claude Code development instructions
├── README.md                     # Project overview and setup
├── index.html                    # HTML entry point
├── package.json                  # Dependencies and scripts
├── plan.md                       # Product roadmap and phases
├── playwright.config.ts          # E2E testing configuration
├── tsconfig.json                 # TypeScript configuration
├── vite.config.ts                # Vite build configuration
└── vitest.config.ts              # Unit testing configuration
```

## Source Code Structure (src/)

```
src/
├── assets/                       # Static assets and global styles
│   ├── main.css                  # Global styles and CSS variables
│   ├── design-tokens.css         # Design system tokens
│   └── styles/                   # Additional style files
│       ├── fonts.css            # Font definitions
│       ├── glass.css            # Glass morphism styles
│       └── themes.css           # Theme-specific styles
├── components/                   # Reusable Vue components
│   ├── base/                    # Base UI components
│   ├── canvas/                  # Canvas-specific components
│   ├── kanban/                  # Kanban board components
│   ├── settings/                # Settings and configuration components
│   ├── auth/                    # Authentication components
│   └── mobile/                  # Mobile-specific components
├── i18n/                         # Internationalization
│   ├── locales/                 # Translation files
│   │   ├── en.json              # English translations
│   │   └── he.json              # Hebrew translations (NEW)
│   └── index.ts                  # i18n configuration
├── composables/                 # Vue 3 composables (reusable logic)
├── data/                        # Static data and schemas
├── router/                      # Vue Router configuration
├── stores/                      # Pinia state management stores
├── types/                       # TypeScript type definitions
├── utils/                       # Utility functions and helpers
├── views/                       # Main application views/pages
├── App.vue                      # Root Vue component
├── main.ts                      # Application entry point
└── vite-env.d.ts               # Vite-specific TypeScript types
```

## Views Directory (src/views/)

```
src/views/
├── BoardView.vue                 # Kanban board with project swimlanes
├── CalendarView.vue              # Calendar scheduling with day/week/month views
├── CalendarViewVueCal.vue        # Alternative calendar implementation
├── CanvasView.vue               # Free-form visual task organization
├── CatalogView.vue              # Master task catalog with table/list views (RENAMED from AllTasksView)
├── FocusView.vue                # Pomodoro-focused deep work sessions
└── QuickSortView.vue            # Rapid task categorization interface
```

## Components Directory Structure

### Base Components (src/components/base/)

```
src/components/base/
├── BaseButton.vue               # Universal button component with variants
├── BaseCard.vue                 # Card container component
├── BaseDropdown.vue             # Dropdown selector component
├── BaseInput.vue                # Form input component
├── BaseModal.vue                # Modal dialog component
├── BaseNavItem.vue              # Navigation item with drag-and-drop support (UPDATED)
├── BasePopover.vue              # Popover component
└── index.ts                     # Component exports
```

### Canvas Components (src/components/canvas/)

```
src/components/canvas/
├── CanvasSection.vue            # Visual section container
├── InboxPanel.vue               # Canvas inbox for unpositioned tasks
├── MultiSelectionOverlay.vue    # Selection rectangle/lasso tool
├── SectionManager.vue           # Section CRUD operations
├── SectionNodeSimple.vue        # Simplified section representation
├── TaskContextMenu.vue          # Right-click context menu for tasks
├── TaskNode.vue                 # Individual task node on canvas
├── index.ts                     # Component exports
└── types/                       # Canvas-specific type definitions
```

### Kanban Components (src/components/kanban/)

```
src/components/kanban/
├── KanbanColumn.vue             # Status column for board view
├── KanbanSwimlane.vue           # Project-based swimlane container
├── TaskCard.vue                 # Individual task card component
├── TaskRow.vue                  # Task list item component
└── index.ts                     # Component exports
```

### Authentication Components (src/components/auth/)

```
src/components/auth/
├── AuthModal.vue                # Authentication interface modal
├── ForgotPasswordForm.vue       # Password recovery form
├── GoogleSignInButton.vue       # OAuth Google sign-in
├── LoginForm.vue                # User login form
├── SignupForm.vue               # User registration form
├── UserProfile.vue              # User profile management
└── index.ts                     # Component exports
```

### Mobile Components (src/components/mobile/)

```
src/components/mobile/
├── MobileBottomNav.vue          # Mobile bottom navigation
├── MobileHeader.vue             # Mobile-optimized header
└── index.ts                     # Component exports
```

## Shared Components (src/components/)

```
src/components/
├── CalendarGrid.vue             # Calendar grid component
├── CategorySelector.vue         # Quick task categorization
├── ConfirmationModal.vue        # Delete confirmation dialog
├── ProjectModal.vue             # Project creation/management
├── SessionControls.vue          # Timer session controls
├── TaskEditModal.vue            # Task editing interface
├── TaskRow.vue                  # Reusable task row component
├── ThemeToggle.vue              # Theme switching control
├── ViewControls.vue             # View switching controls
└── index.ts                     # Component exports
```

## Stores Directory (src/stores/)

```
src/stores/
├── auth.ts                      # User authentication and session management
├── canvas.ts                    # Canvas state and Vue Flow integration
├── quickSort.ts                 # Session management for rapid sorting
├── taskCanvas.ts                # Task-canvas interaction management
├── tasks.ts                     # Central task management with undo/redo
├── theme.ts                     # Theme switching and preferences
├── timer.ts                     # Pomodoro timer functionality
└── ui.ts                        # Application UI state management
```

## Composables Directory (src/composables/)

```
src/composables/
├── adapters/                    # External service adapters
│   └── FirebaseAdapter.ts        # Firebase integration adapter
├── calendar/                     # Calendar-specific composables
│   ├── useCalendarDayView.ts     # Day view logic and state
│   ├── useCalendarEventHelpers.ts # Calendar event utilities (NEW)
│   ├── useCalendarMonthView.ts   # Month view logic and state
│   └── useCalendarWeekView.ts    # Week view logic and state
├── useAuth.ts                    # Authentication logic
├── useBackupScheduler.ts         # Automated data backup management
├── useBrowserTab.ts              # Browser tab visibility management
├── useBulletproofPersistence.ts  # Enhanced data persistence with error recovery
├── useCalendarDragCreate.ts      # Calendar drag-and-drop scheduling
├── useCloudSync.ts               # Data synchronization capabilities
├── useCopy.ts                    # Clipboard functionality
├── useDatabase.ts                # IndexedDB abstraction layer
├── useDatabaseAdapter.ts         # Database interface abstraction
├── useDeepMerge.ts               # Object deep merging utilities
└── useDragAndDrop.ts             # Generic drag-and-drop functionality
├── useFavicon.ts                 # Dynamic favicon management
├── useFocusManagement.ts         # Focus management utilities
├── useFocusMode.ts               # Focus mode session management
├── useFirestore.ts              # Firestore database integration
├── useHorizontalDragScroll.ts    # Horizontal scroll with drag physics (NEW)
├── useKeyboardShortcuts.ts       # Keyboard shortcut handling
├── useNotification.ts            # Browser notification management
├── usePerformanceMonitor.ts      # Application performance tracking
├── usePersistentStorage.ts       # localStorage management with fallbacks
├── useProgressiveDisclosure.ts   # Progressive disclosure UI pattern
├── useQuickSort.ts               # Session management for rapid categorization
├── useSidebarToggle.ts           # Sidebar visibility management
├── useTabVisibility.ts           # Browser tab visibility detection
├── useTheme.ts                   # Theme switching and preferences
├── useTimer.ts                   # Timer-specific functionality
├── useUncategorizedTasks.ts      # Uncategorized task filtering system (NEW)
├── useUnifiedUndoRedo.ts         # Centralized undo/redo system
├── useVirtualList.ts             # Virtual scrolling for large lists
├── useYjsSync.ts                 # YJS collaborative editing synchronization
├── undoSingleton.ts              # Undo system singleton implementation
└── index.ts                      # Composable exports
```

## Types Directory (src/types/)

```
src/types/
├── api.ts                       # API-related type definitions
├── auth.ts                      # Authentication type definitions
├── canvas.ts                    # Canvas-specific type definitions
├── database.ts                  # Database schema types
├── index.ts                     # Type exports
└── task.ts                      # Task and project type definitions
```

## Utils Directory (src/utils/)

```
src/utils/
├── api.ts                       # API communication utilities
├ ├── cloud.ts                   # Cloud service utilities
├ ├── database.ts                # Database operation utilities
├ └── local.ts                   # Local storage utilities
├ ├── validation.ts              # Data validation utilities
├ ├── helpers.ts                 # General helper functions
├ ├── keyboard.ts                # Keyboard shortcut utilities
├ ├── persistence.ts             # Data persistence utilities
├ ├── performance.ts             # Performance monitoring utilities
├ ├── sync.ts                    # Data synchronization utilities
├ ├── theme.ts                   # Theme-related utilities
├ ├── timer.ts                   # Timer calculation utilities
├ ├── undoRedo.ts                # Undo/redo system utilities
├ ├── validation.ts              # Input validation utilities
├ ├── virtualList.ts             # Virtual scrolling utilities
└── index.ts                     # Utility exports
```

## Assets Directory (src/assets/)

```
src/assets/
├── main.css                     # Global styles and CSS variables
├── design-tokens.css            # Design system tokens
├── styles/                      # Additional style files
│   ├── fonts.css               # Font definitions
│   ├── glass.css               # Glass morphism styles
│   ├── themes.css              # Theme-specific styles
│   └── animations.css          # Animation definitions
├── icons/                       # Icon files and imports
├── images/                      # Static image assets
└── fonts/                       # Font files
```

## Router Directory (src/router/)

```
src/router/
├── index.ts                     # Vue Router configuration
├── guards.ts                    # Navigation guards
├ └── routes.ts                  # Route definitions
```

## Data Directory (src/data/)

```
src/data/
├── categories.json              # Default task categories
├ ├── presets.json               # Default presets and settings
└ ├── schema.json                # Database schema definitions
```

## Test Directory Structure

```
tests/
├── e2e/                         # End-to-end tests
│   ├── auth.spec.ts             # Authentication tests
│   ├── board.spec.ts            # Kanban board tests
│   ├── calendar.spec.ts         # Calendar functionality tests
│   ├── canvas.spec.ts           # Canvas interaction tests
│   ├── tasks.spec.ts            # Task management tests
│   └── timer.spec.ts            # Timer functionality tests
├── unit/                        # Unit tests
│   ├── stores/                  # Store tests
│   ├── composables/             # Composable tests
│   ├── components/              # Component tests
│   └── utils/                   # Utility function tests
├── fixtures/                    # Test data and mocks
├── setup.ts                     # Test configuration
└── tsconfig.json                # TypeScript test configuration
```

## Configuration Files

### Root Configuration Files
- **package.json**: NPM dependencies, scripts, and project metadata
- **tsconfig.json**: TypeScript compiler configuration
- **vite.config.ts**: Vite build tool configuration
- **vitest.config.ts**: Vitest testing framework configuration
- **playwright.config.ts**: Playwright E2E testing configuration
- **.gitignore**: Git ignore patterns
- **.eslintrc.js**: ESLint linting configuration
- **tailwind.config.js**: Tailwind CSS configuration
- **postcss.config.js**: PostCSS configuration

### Development Configuration
- **.vscode/settings.json**: VS Code editor settings
- **.vscode/extensions.json**: Recommended VS Code extensions
- **.claude/**: Claude Code configuration and instructions

## Key Directory Purposes

### /src/views/
**Main Application Views** - Each `.vue` file represents a major application screen with distinct functionality:
- Productivity workflows (Board, Calendar, Canvas)
- Task management interfaces (All Tasks, Quick Sort)
- Specialized modes (Focus, Timer integration)

### /src/components/
**Reusable UI Components** - Organized by feature area:
- **base/**: Generic UI elements used throughout the app
- **canvas/**: Vue Flow and canvas-specific components
- **kanban/**: Board view specific components
- **auth/**: User authentication interface components
- **mobile/**: Mobile-optimized components

### /src/stores/
**State Management** - Pinia stores organized by domain:
- **tasks.ts**: Largest store, central task management
- **canvas.ts**: Canvas state and Vue Flow integration
- **timer.ts**: Pomodoro timer functionality
- **ui.ts**: Application UI state

### /src/composables/
**Reusable Logic** - Vue 3 composables for cross-component functionality:
- Database operations, authentication, theme management
- Drag-and-drop, undo/redo, performance monitoring
- Feature-specific logic (calendar, canvas, quick sort)

### /src/utils/
**Utility Functions** - Pure functions and helpers:
- API communication, data validation, persistence
- Performance monitoring, synchronization, theme utilities

## File Naming Conventions

### Vue Components
- **PascalCase**: `TaskCard.vue`, `BoardView.vue`, `BaseButton.vue`
- **Descriptive names** that indicate purpose and scope

### TypeScript Files
- **camelCase**: `useTaskManager.ts`, `apiHelpers.ts`, `validation.ts`
- **Descriptive names** that indicate functionality

### Directory Organization
- **Feature-based**: Components grouped by functionality
- **Shared resources**: Base components and utilities separated
- **Type safety**: Type definitions co-located with implementation

## Import/Export Patterns

### Component Exports
- **index.ts files** in each component directory for clean imports
- **Named exports** for composables and utilities
- **Default exports** for main Vue components

### Store Organization
- **Individual store files** for each domain
- **Consistent patterns** across all stores
- **Type-safe exports** with TypeScript interfaces

This folder structure supports a scalable, maintainable Vue.js application with clear separation of concerns, type safety, and comprehensive testing coverage.

## Recent Structure Changes (November 2025)

### New Composables Added
- **useHorizontalDragScroll.ts**: Horizontal scrolling with drag physics and conflict resolution
- **useUncategorizedTasks.ts**: Centralized uncategorized task filtering and smart view integration
- **useCalendarEventHelpers.ts**: Calendar event utilities (newly organized in calendar/ subdirectory)

### Enhanced Directory Organization
- **calendar/ subdirectory**: Organized calendar-specific composables
  - useCalendarDayView.ts, useCalendarWeekView.ts, useCalendarMonthView.ts
  - useCalendarEventHelpers.ts (NEW)
- **adapters/ subdirectory**: External service adapters
  - FirebaseAdapter.ts for Firebase integration

### Updated Components
- **BaseNavItem.vue**: Enhanced with drag-and-drop support and visual feedback
- **TaskList.vue**: Improved error handling and hierarchical task display
- **ProjectFilterDropdown.vue**: Enhanced uncategorized task filtering support

### Recent View Changes (November 2025)
- **CatalogView.vue**: Renamed from AllTasksView.vue with enhanced catalog functionality
  - Master task catalog with table/list views
  - Enhanced smart view filtering and counter consistency
  - Added "above_my_tasks" smart view for task organization
  - Integrated hide/show done tasks functionality
- **Routing Updates**: Updated routing structure to reflect new view naming and enhanced filtering

### Additional Composables Discovered
The structure update also revealed additional composables not previously documented:
- useBulletproofPersistence.ts: Enhanced data persistence
- useCopy.ts: Clipboard functionality
- useFavicon.ts: Dynamic favicon management
- useProgressiveDisclosure.ts: UI progressive disclosure pattern
- useSidebarToggle.ts: Sidebar visibility management
- useTabVisibility.ts: Browser tab visibility detection
- useYjsSync.ts: Collaborative editing synchronization

### Recent Structure Changes (November 2025)

#### **Internationalization and RTL Support**
- **i18n Directory**: Complete internationalization system
  - **English Support** (en.json): Full English translation keys
  - **Hebrew Support** (he.json): Complete Hebrew translation keys (NEW)
  - **Vue I18n Integration**: Composer-based translation system with lifecycle fixes
- **Settings Components**: New settings and configuration components
  - **LanguageSettings.vue**: Language and direction control with RTL support
  - **RTL State Management**: Direction-aware UI with persistent preferences
- **Base Components**: Enhanced with RTL/Hebrew support
  - **BaseModal.vue**: RTL-aware layouts and proper text direction handling
  - **BaseInput.vue**: Improved input handling with RTL text support

#### **Task Linking and Connection Enhancements**
- **TaskNode.vue**: Enhanced for proper task connections
  - **Connection Visualization**: SVG arrow markers and smoothstep curves
  - **Drag Prevention**: HTML5 drag prevention during Vue Flow connections
  - **Visual Clarity**: Tasks remain visible (opacity: 1) during connections
- **CanvasView.vue**: Improved connection handling
  - **Connection Display**: Enhanced edge creation with proper styling
  - **Edit Modal Conflicts**: Fixed modal opening during task connections

#### **Calendar-Aware Task Filtering**
- **Task Store Enhancement**: New calendarFilteredTasks computed property
  - **Calendar-Specific Filtering**: Includes both scheduled and unscheduled tasks
  - **Enhanced "Today" Filter**: Includes unscheduled inbox tasks
  - **Improved "This Week" Filter**: Proper date range handling
- **Calendar Composables**: Enhanced day/week/month view filtering
  - **Error Handling**: Better validation and fallback mechanisms
  - **Date Handling**: Improved date handling and validation

#### **Performance and Reliability**
- **Vue Lifecycle Management**: Fixed component lifecycle errors
  - **nextTick Usage**: Replaced setTimeout with proper Vue lifecycle management
  - **Error Boundaries**: Added defensive fallbacks for dynamic components
- **Input Field Fixes**: Resolved letter 'f' not working in input fields
  - **Character Handling**: Fixed character input and validation issues

**Last Updated**: November 4, 2025
**Architecture Version**: Vue 3.4.0, TypeScript 5.9.3
**Recent Updates**: RTL/Hebrew support foundation, task linking enhancements, calendar-aware filtering, performance improvements