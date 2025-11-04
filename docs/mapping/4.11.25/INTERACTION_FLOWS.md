# Pomo-Flow Interaction Flows Reference

## Overview

This consolidated interaction flows reference combines visual flow diagrams, route analysis, drag-and-drop system architecture, and event system analysis into a comprehensive guide for understanding user interactions and system behaviors in the Pomo-Flow Vue.js productivity application.

## Table of Contents

- [Application Navigation Flows](#application-navigation-flows)
- [Drag & Drop Interaction Flows](#drag--drop-interaction-flows)
- [User Interface Interaction Patterns](#user-interface-interaction-patterns)
- [Event System Architecture](#event-system-architecture)
- [Cross-View Interaction Consistency](#cross-view-interaction-consistency)
- [Mobile vs Desktop Interactions](#mobile-vs-desktop-interactions)
- [Authentication & Access Control](#authentication--access-control)
- [Performance & Error Flows](#performance--error-flows)

---

## Application Navigation Flows

### Router Configuration Overview

Pomo-Flow uses Vue Router with hash-based routing for navigation between different views and features.

**Router Setup**:
- **Router Mode**: Hash-based routing (`createWebHashHistory`)
- **Authentication Guard**: Global `beforeEach` guard with modal-based authentication
- **Lazy Loading**: Used for mobile views and test components
- **Route Guards**: Authentication-based access control

### Main Application Routes

| Route | Path | Name | Component | Auth Required | Purpose |
|-------|------|------|-----------|---------------|---------|
| **Board View** | `/` | `board` | `BoardView.vue` | ❌ No | Kanban board with project swimlanes |
| **Calendar View** | `/calendar` | `calendar` | `CalendarView.vue` | ✅ Yes | Calendar scheduling interface |
| **Canvas View** | `/canvas` | `canvas` | `CanvasView.vue` | ❌ No | Visual task organization |
| **Catalog View** | `/tasks` | `catalog` | `CatalogView.vue` | ✅ Yes | Master task catalog (RENAMED from AllTasksView) |
| **Quick Sort View** | `/quick-sort` | `quick-sort` | `QuickSortView.vue` | ✅ Yes | Rapid task categorization |
| **Focus View** | `/focus/:taskId` | `focus` | `FocusView.vue` | ✅ Yes | Pomodoro focus sessions |

### Mobile Routes

| Route | Path | Name | Component | Auth Required | Purpose |
|-------|------|------|-----------|---------------|---------|
| **Today View** | `/today` | `today` | `TodayView.vue` (lazy) | ✅ Yes | Mobile-optimized today view |
| **Mobile Redirect** | `/mobile` | - | Redirect to `/today` | - | Mobile entry point |

### External Integration Routes

| Route | Path | Name | Action | Purpose |
|-------|------|------|--------|---------|
| **Design System** | `/design-system` | `design-system` | Opens Storybook | External design system documentation |

### Navigation Flow Diagrams

#### Standard Navigation Flow
```
User Clicks Navigation Link
    ↓
Router.beforeEach() Executes
    ↓
Check Route Authentication Required?
    ↓
┌─────────────────────────┐    ┌─────────────────────────┐
│ Yes - Authentication     │    │ No - Direct Navigation   │
│ Required                 │    │ Allowed                   │
└─────────────────────────┘    └─────────────────────────┘
    ↓                                   ↓
Check User Auth Status              Navigate to Route
    ↓                                   ↓
┌─────────────────────────┐    ┌─────────────────────────┐
│ Authenticated?          │    │ Load Component          │
└─────────────────────────┘    └─────────────────────────�
    ↓                                   ↓
┌─────────────────────────┐    ┌─────────────────────────┐
│ Yes - Navigate Route     │    │ Component Mounted        │
│ No - Open Auth Modal      │    │ User Sees Content        │
└─────────────────────────┘    └─────────────────────────┘
```

#### Modal Authentication Flow
```
User Accesses Protected Route
    ↓
Auth Store Check
    ↓
┌─────────────────────────┐
│ User Not Authenticated   │
└─────────────────────────┘
    ↓
Open Auth Modal
    ↓
User Completes Login
    ↓
┌─────────────────────────┐
│ Authentication Success    │
└─────────────────────────┘
    ↓
Redirect to Intended Route
```

---

## Drag & Drop Interaction Flows

### Current Broken Drag System

The drag-and-drop system has critical issues that prevent it from working properly.

#### High-Level System Architecture Flow

**Current Broken Architecture**:
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Action   │───▶│  Event Blocking  │───▶│  No Visual      │
│   (mousedown)   │    │ Layer            │    │  Feedback       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ TaskCard.vue    │───▶│useHorizontal    │───▶│ Drag Never      │
│ @dragstart      │    │DragScroll.ts    │    │ Starts          │
│ (NEVER FIRED)   │    │(INTERCEPTS)     │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

**Intended Working Architecture**:
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Action   │───▶│  Smart Event     │───▶│  Drag Operation  │
│   (mousedown)   │    │  Detection       │    │  Starts         │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ TaskCard.vue    │───▶│useDragAndDrop   │───▶│ Visual Feedback │
│ @dragstart      │    │.startDrag()     │    │  Shows          │
│ (FIRES)         │    │(CALLED)         │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Detailed Event Flow Analysis

#### Current Broken Event Flow
```
USER INTERACTION
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ MouseDown Event on TaskCard                                │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ useHorizontalDragScroll.handleMouseDown() FIRES FIRST     │
│ Location: src/composables/useHorizontalDragScroll.ts:202   │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ ❌ e.preventDefault()                                      │
│ ❌ e.stopPropagation()                                   │
│ ❌ HTML5 dragstart CANCELLED                              │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ Drag Detection Logic Runs (TOO LATE)                      │
│ detectDragIntent() finds draggable element                 │
│ But drag already cancelled                                 │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ TaskCard.vue @dragstart NEVER FIRES                        │
│ useDragAndDrop.startDrag() NEVER CALLED                   │
│ Global drag state NEVER UPDATED                            │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ ❌ NO VISUAL FEEDBACK                                      │
│ ❌ NO DRAG PREVIEW                                         │
│ ❌ NO DROP ZONE ACTIVATION                                │
│ ❌ TASK APPEARS "STUCK"                                    │
└─────────────────────────────────────────────────────────────┘
```

### Intended Working Event Flow
```
USER INTERACTION
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ MouseDown Event on TaskCard                                │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ useHorizontalDragScroll.handleMouseDown()                  │
│ ✅ Checks for draggable elements FIRST                     │
│ detectDragIntent() returns true for task cards             │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ ✅ Event allowed to proceed (no preventDefault)           │
│ ✅ Event propagation continues (no stopPropagation)       │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ TaskCard.vue @dragstart FIRES SUCCESSFULLY                 │
│ Location: src/components/kanban/TaskCard.vue:296          │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ useDragAndDrop.startDrag() CALLED                         │
│ Global drag state updated                                  │
│ document.body.classList.add('dragging-active')             │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ ✅ VISUAL FEEDBACK APPEARS                                 │
│ ✅ DRAG PREVIEW FOLLOWS CURSOR                            │
│ ✅ CURSOR CHANGES TO DRAGGING STATE                       │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ Drop zones receive dragenter/dragover events              │
│ Visual highlighting of valid drop targets                  │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ User drops task → Drop event fires                         │
│ Task status updated → State persisted                      │
│ Undo/redo records change → UI updated                      │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

#### Current Broken Component Interaction
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   TaskCard.vue  │    │useHorizontal    │    │  KanbanSwimlane │
│                 │    │DragScroll.ts    │    │      .vue       │
│ @dragstart      │───▶│                 │───▶│                 │
│ (BLOCKED)       │    │ Event Interceptor│    │ Drop Zones      │
│                 │    │                 │    │ (NO EVENTS)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│useDragAndDrop   │    │   CSS Rules     │    │  VueDraggable   │
│.startDrag()     │    │ overflow:hidden │    │ Library         │
│(NEVER CALLED)   │    │ Contains drag   │    │ (BLOCKED)       │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

#### Intended Working Component Interaction
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   TaskCard.vue  │    │useHorizontal    │    │  KanbanSwimlane │
│                 │    │DragScroll.ts    │    │      .vue       │
│ @dragstart      │───▶│                 │───▶│                 │
│ (FIRES)         │    │ Smart Detection │    │ Drop Zones      │
│                 │    │                 │    │(RECEIVE EVENTS)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│useDragAndDrop   │    │   CSS Rules     │    │  VueDraggable   │
│.startDrag()     │    │ overflow:auto   │    │ Library         │
│(CALLED)         │    │ Allows drag     │    │ (WORKS)         │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────�
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Task Store     │    │   Undo/Redo     │    │   Visual UI     │
│  Updates        │    │   System        │    │   Updates       │
│ (PERSISTED)     │    │ (RECORDS)       │    │ (FEEDBACK)      │
└─────────────────┘    └─────────────────�    └─────────────────┘
```

### CSS Impact on Drag Operations

#### Current CSS Constraint Flow
```
┌─────────────────────────────────────────────────────────────┐
│ GLOBAL CSS RULES                                            │
├─────────────────────────────────────────────────────────────┤
│ design-tokens.css:736-754                                  │
│ html, body { overflow-x: hidden; }                         │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ APP-LEVEL CONSTRAINTS                                       │
├─────────────────────────────────────────────────────────────┤
│ App.vue:1150, 1753                                          │
│ .app, .main-content { overflow-x: hidden; }                │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ BODY STYLE MANIPULATION                                     │
├─────────────────────────────────────────────────────────────┤
│ useHorizontalDragScroll.ts:165-166                          │
│ document.body.style.overflowX = 'hidden'                    │
│ document.body.style.touchAction = 'pan-y'                   │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ ❌ DRAG PREVIEW CONTAINED                                   │
│ ❌ CROSS-ELEMENT DRAGGING BLOCKED                           │
│ ❌ VISUAL FEEDBACK CLIPPED                                  │
│ ❌ TOUCH DRAG LIMITED TO VERTICAL                           │
└─────────────────────────────────────────────────────────────┘
```

#### Intended CSS Permission Flow
```
┌─────────────────────────────────────────────────────────────┐
│ TARGETED CSS RULES                                          │
├─────────────────────────────────────────────────────────────┤
│ design-tokens.css:MODIFIED                                  │
│ html, body { overflow-x: auto; }                           │
│ .horizontal-scroll-container { overflow-x: auto; }          │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ CONTAINER-LEVEL CONSTRAINTS                                 │
├─────────────────────────────────────────────────────────────┤
│ App.vue:MODIFIED                                            │
│ .app, .main-content { overflow-x: visible; }               │
│ Only specific scroll containers constrained                 │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ NO BODY STYLE MANIPULATION                                  │
├─────────────────────────────────────────────────────────────┤
│ useHorizontalDragScroll.ts:REMOVED                          │
│ No global body style changes                                │
│ CSS classes used instead of direct style manipulation       │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ ✅ DRAG PREVIEW FREE TO MOVE                               │
│ ✅ CROSS-ELEMENT DRAGGING ENABLED                          │
│ ✅ VISUAL FEEDBACK FULLY VISIBLE                           │
│ ✅ TOUCH DRAG WORKS IN ALL DIRECTIONS                      │
└─────────────────────────────────────────────────────────────┘
```

---

## User Interface Interaction Patterns

### Modal Systems & Dialogs

#### Modal Stack Management
```
User Opens Modal
    ↓
UI Store Updates activeModal
    ↓
Modal Component Renders
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Modal Options                                                   │
│ ┌─────────────────┐ ┌─────────────────┐                         │
│ │ Single Modal    │ │ Nested Modal    │                         │
│ │ Open           │ │ Stack Supported  │                         │
│ └─────────────────┘ └─────────────────┘                         │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
User Interacts with Modal
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Interaction Patterns                                           │
│ ┌─────────────────┐ ┌─────────────────┐                         │
│ │ Form Input     │ │ Button Click    │                         │
│ │ Dropdown Select │ │ Keyboard Nav   │                         │
│ │ File Upload     │ │ Drag & Drop    │                         │
│ └─────────────────┘ └─────────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

#### Confirmation Dialog Pattern
```
User Performs Destructive Action
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Show Confirmation Modal                                       │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ⚠️  Warning Icon                                       │ │
│ │ Delete "Task Title"?                                 │ │
│ │                                                     │ │
│ │ Details:                                           │ │
│ │ • This action cannot be undone                    │ │
│ │ • Task and all subtasks will be removed            │ │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
User Decision
    ↓
┌─────────────────────────────────────────────────────────────┐
│ ┌─────────────────┐ ┌─────────────────┐                         │
│ │ Cancel Action    │ │ Confirm Action  │                         │
│ └─────────────────┘ └─────────┬─────────┘                         │
│                       │         │                         │
│                       ▼         ▼                         │
│                 No Change   │   Execute Action │                         │
└─────────────────────────┴─────────┴─────────────────────┘
```

### Form Interaction Patterns

#### Progressive Disclosure Pattern
```
User Opens Task Edit Modal
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Basic Task Information (Always Visible)                        │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ • Title Input                                               │ │
│ │ • Description Textarea                                     │ │
│ │ • Status Dropdown                                         │ │
│ │ • Priority Dropdown                                        │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
User Clicks "Advanced Options"
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Expanded Sections (Progressive Disclosure)                       │
│ ┌─────────────────┐ ┌─────────────────┐ ┌───────────────┐ │
│ │ Subtasks      │ │ Dependencies  │ │ Pomodoros    │ │
│ │ ▼ Expand      │ │ ▼ Expand      │ │ ▼ Expand    │ │
│ │ • Add/Edit     │ │ • Add/Edit    │ │ • Session Log │ │
│ │ • Reorder     │ │ • Visual Map  │ │ • Settings   │ │
│ └─────────────────┴─┴─────────────────┴─┴───────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Real-time Validation Patterns

#### Form Validation Flow
```
User Enters Data
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Client-Side Validation (Immediate Feedback)                      │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Email Input:                                                 │ │
│ │ ✅ Valid Format                                           │ │
│ │ ❌ Invalid Format                                        │ │
│ │                                                     │ │
│ │ Password Input:                                            │ │
│ │ ✅ Strong (8+ chars, mixed types)                            │ │
│ │ ⚠️  Weak (under 8 chars)                                   │ │
│ │ ❌ Too Short                                            │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
User Submits Form
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Server-Side Validation (Final Authority)                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ✅ Validation Successful                                    │ │
│ │ ❌ Validation Failed                                     │ │
│ │   • Show server error messages                            │ │
│ │   • Highlight specific fields                             │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### New User Workflows (November 2025)

#### Uncategorized Task Filtering Workflow ("My Tasks" Smart Filter)

```
User Activates "My Tasks" Smart Filter
    ↓
UI Store Updates activeSmartView to 'uncategorized'
    ↓
┌─────────────────────────────────────────────────────────────┐
│ useUncategorizedTasks Composable Executes                     │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ isTaskUncategorized(task) Check                       │ │
│ │ • Primary: task.isUncategorized === true             │ │
│ │ • Fallback: !task.projectId || invalid projectId    │ │
│ │ • Legacy: projectId === '1' or empty                 │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ View-Specific Filtering Applied                              │
│ ┌─────────────────┐ ┌─────────────────┐ ┌───────────────┐ │
│ │ BoardView       │ │ CalendarView    │ │ CanvasView    │ │
│ │ Filter Kanban   │ │ Filter Calendar │ │ Filter Canvas │ │
│ │ Swimlanes        │ │ Events          │ │ Nodes         │ │
│ └─────────────────┴─┴─────────────────┴─┴───────────────┘ │
└─────────────────────────────────────────────────────────────┘
    ↓
UI Updates: Only Uncategorized Tasks Visible
    ↓
User Interaction: Task Operations Available
    ↓
State Persistence: Smart filter state saved to UI Store
```

#### Done Task Visibility Toggle Workflow

```
User Toggles "Hide Done Tasks" in Kanban Board
    ↓
UI Store Updates hideDoneTasks Boolean
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Kanban View Reactively Updates                               │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Task Filtering Logic                                     │ │
│ │ if (hideDoneTasks && task.status === 'done') {        │ │
│ │   exclude from render                                  │ │
│ │ }                                                       │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
    ↓
Visual Update: Done Tasks Disappear from Columns
    ↓
State Persistence: hideDoneTasks saved to localStorage
    ↓
Cross-View Sync: Setting applies to CatalogView and BoardView
```

#### Enhanced Error Recovery Workflow

```
Error Occurs in Component Operation
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Error Boundary Pattern Activated                             │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ try {                                                  │ │
│ │   await criticalOperation()                           │ │
│ │ } catch (error) {                                     │ │
│ │   console.error('Operation failed:', error)           │ │
│ │   uiStore.showNotification(                           │ │
│ │     'Operation failed. Please try again.',             │ │
│ │     'error'                                           │ │
│ │   )                                                    │ │
│ │   return fallbackValue                                │ │
│ │ }                                                      │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ User-Friendly Error Display                                │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Error Notification with Action Buttons                 │ │
│ │ • "Retry" Button: Re-attempt failed operation        │ │
│ │ • "Dismiss" Button: Close notification                │ │
│ │ • Auto-hide after 5 seconds                           │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
    ↓
State Recovery: Application state remains consistent
    ↓
User Can Continue: Other functionality unaffected
```

#### Horizontal Drag Scroll Interaction Workflow

```
User Initiates Drag on Kanban Board Horizontal Area
    ↓
┌─────────────────────────────────────────────────────────────┐
│ useHorizontalDragScroll Composable Analyzes Intent             │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Smart Drag Intent Detection                            │ │
│ │ • Check for draggable elements (task cards, etc.)    │ │
│ │ • Identify interactive elements (buttons, inputs)    │ │
│ │ • Detect Vue Flow canvas interactions                │ │
│ │ • Determine scroll vs drag intent                    │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Interaction Decision                                          │
│ ┌─────────────────┐ ┌─────────────────┐                     │
│ │ Drag Intent     │ │ Scroll Intent   │                     │
│ │ Detected?       │ │ Detected?       │                     │
│ │ • Allow task    │ │ • Activate      │                     │
│ │   drag-and-drop │ │   horizontal    │                     │
│ │ • Don't         │ │   scroll        │                     │
│ │   interfere     │ │ • Apply         │                     │
│ └─────────────────┴─┴─────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
    ↓
[Scroll Intent Path]
useHorizontalDragScroll Activates
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Physics-Based Scrolling                                      │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ • Track mouse/touch movement                          │ │
│ │ • Calculate velocity for momentum                     │ │
│ │ • Apply configurable friction (0.95)                  │ │
│ │ • Smooth 60fps scrolling with requestAnimationFrame  │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
    ↓
Visual Feedback: Cursor changes to 'grabbing'
    ↓
User Releases: Momentum scrolling continues with friction
    ↓
State Restoration: Cursor and touch-action properties reset
```

#### Smart State Persistence Workflow

```
User Performs Any UI State Change
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Automatic State Persistence                                   │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ debounceSave(1000ms) Triggered                       │ │
│ │ • activeSmartView saved                               │ │
│ │ • hideDoneTasks saved                                 │ │
│ │ • expandedProjects saved                              │ │
│ │ • sidebarStates saved                                 │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
    ↓
IndexedDB Storage via LocalForage
    ↓
Cross-Session Recovery: State restored on page reload
    ↓
Consistent UX: User preferences maintained across sessions
```

#### Enhanced CatalogView Workflow (November 2025)

```
User Accesses CatalogView (/tasks route)
    ↓
UI Store and Task Store Initialize
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Smart View and Counter Consistency System                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ above_my_tasks Smart View Implementation                 │ │
│ │ • Filters tasks above current task in hierarchy         │ │
│ │ • Integrates with parent-child task relationships      │ │
│ │ • Provides focused task organization                    │ │
│ │                                                         │ │
│ │ Counter vs Display Consistency Fix                     │ │
│ │ • Real-time counter updates across all views           │ │
│ │ • Synchronizes display count with filtered results    │ │
│ │ • Prevents counter/display mismatch errors            │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Enhanced Filtering and Display Options                        │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Hide/Show Done Tasks Toggle                              │ │
│ │ • Eye/EyeOff icon toggle in header                     │ │
│ │ • Persists preference in localStorage                │ │
│ │ • Updates reactively across all task displays          │ │
│ │                                                         │
│ │ Dual Display Modes                                     │ │
│ │ • List view: Hierarchical task display                │ │
│ │ • Table view: Tabular task organization               │ │
│ │ • Mode switching with maintained filter state         │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Advanced Task Operations                                    │
│ • Bulk selection and operations                            │
│ • Inline editing with immediate persistence               │
│ • Hierarchical task expansion/collapse                     │
│ • Multi-criteria sorting and filtering                       │
│ • Export functionality for task data                        │
└─────────────────────────────────────────────────────────────┘
    ↓
State Synchronization: Changes immediately reflect in:
- Task Store (global state)
- UI Store (view preferences)
- IndexedDB (persistence)
- Other Views (real-time sync)
```

#### Calendar-Aware Task Filtering Workflow (November 2025)

```
User Interacts with CalendarInboxPanel Filter Options
    ↓
Calendar Event Detection System Executes
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Enhanced Instance-Based Task Filtering                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Task Instance Awareness                                      │ │
│ │ • Check for task.instances array with calendar events    │ │
│ │ • Detect legacy scheduledDate/scheduledTime fields      │ │
│ │ • Respect isInInbox flag for explicit inbox exclusion  │ │
│ │ • Canvas position awareness for scheduling context     │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Multi-Mode Filter Logic (5 Filter Options)                    │
│ ┌─────────────────┐ ┌─────────────────┐ ┌───────────────┐ │
│ │ Today Filter    │ │ Unscheduled     │ │ Not on Canvas  │ │
│ │ • dueDate ==    │ │ • No instances  │ │ • canvasPos   │ │
│ │   today         │ │ • No legacy     │ │   is null      │ │
│ │ • Not scheduled │ │   schedule      │ │ • Inbox tasks  │ │
│ │                 │ │ • Active tasks  │ │   only         │ │
│ └─────────────────┴─┴─────────────────┴─┴───────────────┘ │
│                                                                 │
│ ┌─────────────────┐ ┌─────────────────┐                         │
│ │ Incomplete      │ │ All Tasks       │                         │
│ │ • status !==    │ │ • All inbox     │                         │
│ │   'done'        │ │   tasks visible │                         │
│ │ • Active items  │ │ • No filtering  │                         │
│ └─────────────────┴─┴─────────────────┘                         │
└─────────────────────────────────────────────────────────────┘
    ↓
Real-time Task Filtering Applied:
- Tasks without calendar instances appear in Unscheduled
- Today's due tasks filter by current date
- Canvas-located tasks excluded from Not on Canvas
- Done tasks hidden from Incomplete view
- All tasks respect isInInbox flag and canvas positioning
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Visual Feedback and Counter Updates                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Base Counter (Total Inbox Tasks)                        │ │
│ │ • Shows all tasks regardless of active filter          │ │
│ │ • Fixed number for consistency                        │ │
│ │                                                         │ │
│ │ Filtered Counter (Current Filter Results)               │ │
│ │ • Dynamic count updates with filter selection          │ │
│ │ • Real-time visual feedback                            │ │
│ │ • Dual-badge display in collapsed state               │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
    ↓
Smart Drag-and-Drop Integration:
- Filtered tasks maintain drag compatibility
- Calendar instance creation on drop
- Inbox task removal and rescheduling
- Visual distinction during calendar drop operations
    ↓
Debug and Monitoring System:
console.log(`🔍 [${filter}] Task "${title}":`, {
  passesFilter, hasInstances, hasLegacySchedule,
  status, canvasPosition, isInInbox
})
```

---

## Event System Architecture

### Event Handler Priority and Registration

#### Current Event Handler Priority Chain
```
1. useHorizontalDragScroll.handleMouseDown()     [HIGHEST PRIORITY]
   ↓
2. Global document listeners                    [HIGH PRIORITY]
   ↓
3. App.vue level listeners                     [MEDIUM PRIORITY]
   ↓
4. Component-level listeners                   [LOW PRIORITY - BLOCKED]
   ↓
5. Vue event system                           [NEVER REACHED]
```

#### Event Handler Registration Analysis

**useHorizontalDragScroll.ts Event Binding**:
```typescript
// Lines 190-230: Event listener setup
onMounted(() => {
  const container = scrollContainer.value
  if (container) {
    // ❌ PROBLEM: Captures events before component handlers
    container.addEventListener('mousedown', handleMouseDown, { passive: false })
    container.addEventListener('mousemove', handleMouseMove, { passive: false })
    container.addEventListener('mouseup', handleMouseUp, { passive: false })

    // ❌ PROBLEM: Touch events also intercepted
    if (touchEnabled) {
      container.addEventListener('touchstart', handleTouchStart, { passive: false })
      container.addEventListener('touchmove', handleTouchMove, { passive: false })
    }
  }
})
```

**TaskCard.vue Event Binding**:
```vue
<!-- Lines 18-26: Component-level event handlers -->
<template>
  <article
    @dragstart="handleDragStart"    <!-- ❌ NEVER CALLED -->
    @dragend="endDrag"              <!-- ❌ NEVER CALLED -->
    @click="handleCardClick"        <!-- ✅ Works (different event) -->
  >
```

### Event Propagation and Cancellation

#### Event Propagation Flow (Current Broken State)
```
mousedown event fires on TaskCard
    ↓
useHorizontalDragScroll.handleMouseDown() receives event
    ↓
❌ e.preventDefault()  → Cancels default drag behavior
    ↓
❌ e.stopPropagation() → Stops event bubbling
    ↓
❌ TaskCard.dragstart event never fires
    ↓
❌ HTML5 drag operation never initiates
```

#### Event Propagation Flow (Intended Working State)
```
mousedown event fires on TaskCard
    ↓
useHorizontalDragScroll checks for draggable elements
    ↓
✅ If draggable: return early, don't preventDefault()
    ↓
✅ Event continues to TaskCard
    ↓
✅ TaskCard.dragstart event fires
    ↓
✅ HTML5 drag operation initiates successfully
```

### Mouse vs Touch Event Handling

#### Mouse Event Chain
```typescript
// useHorizontalDragScroll.ts: Mouse event handling
const handleMouseDown = (e: MouseEvent) => {
  // ❌ PROBLEM: Unconditional preventDefault()
  e.preventDefault()
  e.stopPropagation()

  // ❌ PROBLEM: Drag detection happens AFTER cancellation
  const isDraggable = detectDragIntent(e.target as HTMLElement, e.clientX, e.clientY)
  if (isDraggable) {
    // Logic to allow drag, but too late - drag already cancelled
    return
  }

  handleStart(e.clientX, e.clientY, e.target as HTMLElement)
}
```

#### Touch Event Chain
```typescript
// useHorizontalDragScroll.ts: Touch event handling
const handleTouchStart = (e: TouchEvent) => {
  // ❌ PROBLEM: Same issue with touch events
  e.preventDefault()
  e.stopPropagation()

  // Touch-specific drag detection
  const touch = e.touches[0]
  const isDraggable = detectDragIntent(e.target as HTMLElement, touch.clientX, touch.clientY)
  // Same timing problem
}
```

### Event Target Detection Logic

#### Current Drag Detection Implementation
```typescript
// Lines 79-103: detectDragIntent function
const detectDragIntent = (target: HTMLElement, clientX: number, clientY: number): boolean => {
  // ✅ GOOD: Comprehensive draggable element detection
  const draggableElement = target.closest<HTMLElement>(
    '.draggable, [data-draggable="true"], [draggable="true"], .task-card, .inbox-task-card, ' +
    '[data-inbox-task="true"], .vuedraggable, .vue-flow__node, .vue-flow__handle'
  )

  if (draggableElement) {
    console.log('🎯 [HorizontalDragScroll] Detected drag intent, allowing drag-and-drop')
    return true
  }

  // ✅ GOOD: Interactive element detection
  const interactiveElement = target.closest<HTMLElement>(
    'button, input, textarea, select, [role="button"], .draggable-handle, ' +
    '.status-icon-button, .task-title, .card-header, .metadata-badges, .card-actions, .task-item-mini'
  )

  if (interactiveElement) {
    console.log('🔘 [HorizontalDragScroll] Detected interactive element, allowing interaction')
    return true
  }

  return false
}
```

**Event Detection Issues**:
- **Logic is Correct**: The detection logic properly identifies draggable elements
- **Timing is Wrong**: Detection happens AFTER `preventDefault()` already called
- **Order Dependency**: Detection must happen BEFORE any event cancellation

---

## Cross-View Interaction Consistency

### Current Inconsistent State

#### Cross-View Drag Functionality
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Board View    │    │  Calendar View  │    │   Canvas View   │
│                 │    │                 │    │                 │
│ ❌ Drag & Drop  │    │ ❌ Drag & Drop  │    │ ✅ Drag & Drop  │
│   BROKEN        │    │   BROKEN        │    │   WORKING       │
│                 │    │                 │    │ (Vue Flow)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────┐
│ ❌ INCONSISTENT USER EXPERIENCE                            │
│ Users confused why dragging works in canvas but not board  │
│ Different interaction patterns across views                │
└─────────────────────────────────────────────────────────────┘
```

#### Intended Consistent State
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Board View    │    │  Calendar View  │    │   Canvas View   │
│                 │    │                 │    │                 │
│ ✅ Drag & Drop  │    │ ✅ Drag & Drop  │    │ ✅ Drag & Drop  │
│   WORKING       │    │   WORKING       │    │   WORKING       │
│                 │    │                 │    │ (Vue Flow)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────┐
│ ✅ CONSISTENT USER EXPERIENCE                              │
│ Dragging works the same way across all views               │
│ Unified interaction patterns throughout application        │
└─────────────────────────────────────────────────────────────┘
```

### State Synchronization Issues

#### Task State Consistency Flow
```
User Action in Any View
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Task Store Updated                                             │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ • Task properties updated                              │ │
│ │ • Status changed                                      │ │
│ │ • Project assignment updated                             │ │
│ │ • Due date modified                                     │ │
│ │ • Priority adjusted                                     │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
Store Persistence Triggered
    ↓
┌─────────────────────────────────────────────────────────────┐
│ IndexedDB Storage                                              │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ • Changes persisted to database                       │ │
│ │ • Auto-migration handling                               │ │
│ │ • Error recovery mechanisms                               │
│ │ • Debounced writes (1 second)                          │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
All Views Update Reactively
    ↓
┌─────────────────────────────────────────────────────────────┐
│ UI State Synchronized                                      │
│ ┌─────────────────┐ ┌─────────────────┐ ┌───────────────┐ │
│ │ Board View      │ │ Calendar View   │ │ Canvas View   │ │
│ │ Shows change   │ │ Shows change   │ │ Shows change   │ │
│ │ immediately    │ │ immediately    │ │ immediately    │ │
│ └─────────────────┴─┴─────────────────┴─┴───────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Mobile vs Desktop Interactions

### Touch Event Handling Issues

#### Current Broken Touch Flow
```
USER TOUCHES TASK
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ touchstart Event                                            │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ useHorizontalDragScroll.handleTouchStart()                  │
│ ❌ e.preventDefault() (cancels touch drag)                  │
│ ❌ e.stopPropagation() (blocks propagation)                  │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ ❌ TOUCH DRAG OPERATION CANCELLED                           │
│ ❌ MOBILE USERS CANNOT DRAG TASKS                           │
│ ❌ TOUCH ACTION: 'pan-y' LIMITS TO VERTICAL ONLY            │
└─────────────────────────────────────────────────────────────┘
```

#### Intended Working Touch Flow
```
USER TOUCHES TASK
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ touchstart Event                                            │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ useHorizontalDragScroll.handleTouchStart()                  │
│ ✅ Detects draggable element FIRST                          │
│ ✅ Allows touch drag to proceed                            │
│ ✅ No preventDefault() for draggable elements               │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ ✅ TOUCH DRAG OPERATION STARTS                             │
│ ✅ MOBILE USERS CAN DRAG TASKS                             │
│ ✅ TOUCH ACTION: 'auto' ALLOWS ALL DIRECTIONS              │
└─────────────────────────────────────────────────────────────┘
```

### Responsive Interaction Patterns

#### Mobile-First Interface Adaptation
```
Mobile Device Detected
    ↓
┌─────────────────────────────────────────────────────────────┐
│ UI Adaptation Applied                                        │
│ ┌─────────────────┐ ┌─────────────────┐                         │
│ │ Touch-Friendly   │ │ Simplified      │                         │
│ │ Larger Targets  │ │ Reduced Options │                         │
│ │ Swipe Gestures   │ │ Thumb Navigation │                         │
│ │ Voice Input      │ │ Haptic Feedback │                         │
│ └─────────────────┴─┴─────────────────┴─                         │
└─────────────────────────────────────────────────────────────┘
```

#### Desktop Interaction Patterns
```
Desktop Device Detected
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Full Feature Interface                                        │
│ ┌─────────────────┐ ┌─────────────────� ┌───────────────┐ │
│ │ Mouse Precision  │ │ Keyboard Shortcuts│ │ Multi-Select   │ │
│ │ Drag & Drop     │ │ Context Menus    │ │ Tooltips      │ │
│ │ Hover States    │ │ Complex Forms    │ │ Batch Ops     │ │
│ └─────────┴───────┴─┴─────────┴──────┴─┴───────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Authentication & Access Control

### Modal-Based Authentication Flow

#### Authentication Guard Implementation
```typescript
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  const uiStore = useUIStore()

  // Check if route requires authentication
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)

  if (requiresAuth) {
    // Wait for auth to initialize
    if (authStore.isLoading) {
      const maxWaitTime = 5000
      const startTime = Date.now()

      while (authStore.isLoading && Date.now() - startTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    if (!authStore.isAuthenticated) {
      // Open auth modal instead of redirecting
      if (!uiStore.authModalOpen) {
        uiStore.openAuthModal('login', to.fullPath)
      }
      next() // Allow navigation with modal open
    } else {
      next() // User authenticated, allow navigation
    }
  } else {
    next() // Route doesn't require auth
  }
})
```

#### Authentication Flow Diagram
```
User Attempts to Access Protected Route
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Route Guard Executes                                           │
│ Checks requiresAuth Meta Field                                │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ Authentication Check                                          │
│ ┌─────────────────┐ ┌─────────────────┐                         │
│ │ User Logged In? │ │ Auth Loading?    │                         │
│ │                │ │                │                         │
│ │       ✅ Yes      │ │     ⏳ Loading...   │                         │
│ │       ❌ No       │ │       ✅ Done     │                         │
│ └─────────┴─────────┴─┴─────────┴─────────┘                         │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ Decision Point                                               │
│ ┌─────────────────┐ ┌─────────────────┐                         │
│ │ Navigate to     │ │ Open Auth Modal │                         │
│ │ Requested Route   │ │ Preserve Route   │                         │
│                 │ │ For Later      │                         │
│ └─────────┴─────────┴─┴─────────┴─────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

### User Session Management

#### Session Lifecycle Flow
```
User Logs In Successfully
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Session Token Management                                      │
│ ┌─────────────────┐ ┌─────────────────┐                         │
│ │ Access Token    │ │ Refresh Token   │                         │
│ │ Generated      │ │ Issued         │                         │
│ │                 │ │                 │                         │
│ │ Token Stored    │ │ Token Secured   │                         │
│ │ (localStorage)  │ │ (HttpOnly)     │                         │
│ └─────────┴─────────┴─┴─────────┴─────────┘                         │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ Session Activity Tracking                                     │
│ • Last activity timestamp                                 │
│ • Session timeout monitoring                                 │
│ • Inactivity warnings                                       │
│ • Automatic logout on timeout                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Performance & Error Flows

### Data Flow and State Management

#### Current Broken Data Flow
```
USER ATTEMPTS DRAG
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ ❌ NO DRAG STATE CHANGE                                     │
│ dragState: { isDragging: false, dragData: null }           │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ ❌ NO TASK STORE UPDATES                                    │
│ Task status unchanged                                       │
│ No IndexedDB persistence                                   │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ ❌ NO UNDO/REDO RECORDING                                   │
│ No state snapshots created                                 │
│ No history entries added                                   │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ ❌ NO UI UPDATES                                            │
│ Visual state unchanged                                      │
│ User confused about action outcome                         │
└─────────────────────────────────────────────────────────────┘
```

#### Intended Working Data Flow
```
USER COMPLETES DRAG
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ ✅ DRAG STATE UPDATED                                       │
│ dragState: { isDragging: false, dragData: {...} }          │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ ✅ TASK STORE UPDATES                                       │
│ Task status changed to new column                          │
│ IndexedDB persistence triggered                            │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ ✅ UNDO/REDO RECORDING                                      │
│ State snapshot created before change                       │
│ State snapshot created after change                        │
│ History entry added with action metadata                   │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ ✅ UI UPDATES                                               │
│ Task moves to new column visually                           │
│ Success feedback shown                                     │
│ Consistent state across all views                          │
└─────────────────────────────────────────────────────────────┘
```

### Error Handling Patterns

#### Error Boundary Pattern
```typescript
export function useErrorBoundary() {
  const error = ref<Error | null>(null)
  const errorInfo = ref<string>('')

  const captureError = (err: Error, info?: string) => {
    error.value = err
    errorInfo.value = info || ''

    // Log to external service
    logError(err, info)

    // Show user-friendly message
    showErrorNotification('Something went wrong. Please try again.')
  }

  const resetError = () => {
    error.value = │ null
    errorInfo.value = ''
  }

  const handleError = async (operation: () => Promise<void>) => {
    try {
      await operation()
    } catch (err) {
      captureError(err instanceof Error ? err : new Error('Unknown error'))
    }
  }

  return {
    error: readonly(error),
    errorInfo: readonly(errorInfo),
    captureError,
    resetError,
    handleError
  }
}
```

#### Optimistic UI Updates Pattern
```
User Performs Action
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Optimistic UI Update (Immediate)                              │
│ • Visual feedback shown immediately                           │
│ │ • Loading spinners                                           │
│ │ • Success states                                         │
│ │ • Progress indicators                                    │
│ │ • Temporary states                                        │
│ └─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend Processing                                           │
│ • API call executed                                      │
│ • Database operation performed                            │
│ • Validation checks completed                              │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ Result Processing                                           │
│ ┌─────────────────┐ ┌─────────────────┐                         │
│ │ Success Case      │ │ Error Case      │                         │
│ │ • Confirmation   │ │ • Rollback      │                         │
│ │ │ • Final state  │ │ • Error message │                         │
│ │ │ • Persistence  │ │ • Retry option │                         │
│ └─────────┴─────────┴─┴─────────┴─────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

### Performance Optimization Flows

#### Virtual Scrolling Implementation
```
Large Dataset Rendered
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Virtual Scrolling Applied                                        │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Viewport Calculation                                    │ │
│ │ • Visible items calculated                           │ │
│ │ • Render range determined                              │ │
│ │ • Overscan buffer applied                              │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ Efficient Rendering                                           │
│ • Only visible items rendered                                 │
│ • DOM elements recycled                                     │
│ │ • Memory usage minimized                                   │
│ │ • Scrolling performance optimized                          │
│ • 60fps target maintained                                   │
│ └─────────────────────────────────────────────────────────────┘
```

#### Debounced Operations Pattern
```
Frequent User Input Detected
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Debounce Timer Started                                         │
│ • Input captured                                              │
│ │ • Timer countdown begins                                   │
│ │ • Previous timer cancelled                                 │
│ │ • New timer scheduled                                  │
│ └─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ Intermediate State Updates (Optional)                          │
│ • Loading indicators shown                                   │
│ • Preview calculations displayed                               │
│ │ • Partial results rendered                                   │
│ └─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ Final Processing (After Delay)                                 │
│ • Batched operations executed                               │
│ │ • Single API call instead of multiple                     │
│ │ • State updates consolidated                              │
│ │ • Persistence triggered                                    │
│ └─────────────────────────────────────────────────────────────┘
```

---

## Summary

### Root Cause Analysis

The interaction flows clearly show that:

1. **Event Timing**: Event interception happens too early in the chain
2. **Cascading Failures**: One blocked event prevents entire drag system
3. **CSS Compounding**: Multiple layers of restrictions compound the problem
4. **Cross-Platform Impact**: Both desktop and mobile users affected
5. **Simple Fix Path**: Relatively small changes can restore full functionality

### System Architecture Quality

- **✅ Good**: Comprehensive drag detection logic
- **✅ Good**: Proper event cleanup and memory management
- **✅ Good**: Vue reactive system integration
- **❌ Broken**: Event handler priority and timing
- **❌ Broken**: CSS interaction with drag operations
- **❌ Broken**: Cross-view consistency

### Fix Implementation Priority

1. **High Priority**: Fix event handler timing in `useHorizontalDragScroll.ts`
2. **High Priority**: Remove global CSS constraints affecting drag operations
3. **Medium Priority**: Restore consistent drag functionality across all views
4. **Low Priority**: Add comprehensive error handling and user feedback

This interaction flows reference provides complete visibility into the Pomo-Flow application's user interaction patterns, current system issues, and the intended working state for optimal user experience.

---

**Last Updated**: November 3, 2025
**Consolidated From**: 4 separate interaction and flow documents
**Document Type**: Comprehensive Interaction Flows Reference
**Recent Workflows Added**: Uncategorized task filtering, Done task visibility toggle, Enhanced error recovery, Horizontal drag scroll, Smart state persistence, Enhanced CatalogView workflow with smart filtering and counter consistency