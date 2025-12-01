# Component Dependency Graph Analysis
## Pomo-Flow Component Relationship Mapping

### 1. Core Application Architecture

```
App.vue (2,920 lines)
├── TaskManagerSidebar.vue
├── CalendarInboxPanel.vue
├── ProjectTreeItem.vue
├── QuickTaskCreate.vue
├── ViewControls.vue
├── TimeDisplay.vue
└── Main Content Area
    ├── BoardView.vue
    ├── CalendarView.vue
    ├── CanvasView.vue
    ├── FocusView.vue
    ├── QuickSortView.vue
    └── CatalogView.vue
```

### 2. Canvas System Dependencies

```
CanvasView.vue (4,511 lines) - CORE
├── Vue Flow Integration [UNEXTRACTABLE]
│   ├── TaskNode.vue (572 lines)
│   ├── CanvasSection.vue (569 lines)
│   └── SectionNodeSimple.vue (376 lines)
├── Canvas Controls [EXTRACTABLE]
│   ├── SectionManager.vue (752 lines)
│   ├── SectionWizard.vue (869 lines)
│   ├── MultiSelectionOverlay.vue (515 lines)
│   └── CanvasContextMenu.vue (515 lines)
├── Sidebar Panels [EXTRACTABLE]
│   ├── InboxPanel.vue (671 lines)
│   └── InboxTimeFilters.vue (326 lines)
└── Modals [EXTRACTABLE]
    ├── GroupEditModal.vue (393 lines)
    └── ResizeHandle.vue (177 lines)
```

### 3. Task Management Ecosystem

```
TaskEditModal.vue (1,409 lines) - CENTRAL TASK HUB
├── Task Form Fields
├── Priority Controls
├── Status Management
├── Date/Time Inputs
└── Validation System

TaskCard.vue (927 lines) - KANBAN DISPLAY
├── Priority Indicators
├── Status Badges
├── Progress Tracking
└── Context Menu Integration

TaskRow.vue (423 lines) - TABLE DISPLAY
├── Hierarchical Data
├── Progress Indicators
└── Quick Actions

TaskTable.vue (411 lines) - TABLE CONTAINER
├── TaskTable.vue components
└── Filtering Controls
```

### 4. Modal System Architecture

```
Modal Hierarchy:
├── BaseModal.vue (609 lines) - FOUNDATION
│   ├── SettingsModal.vue (531 lines)
│   ├── SearchModal.vue (513 lines)
│   ├── GroupModal.vue (531 lines)
│   ├── ProjectModal.vue (353 lines)
│   ├── ConfirmationModal.vue (199 lines)
│   ├── QuickTaskCreateModal.vue (209 lines)
│   └── AuthModal.vue (161 lines)

├── Task-Specific Modals
│   ├── TaskEditModal.vue (1,409 lines)
│   ├── BatchEditModal.vue (814 lines)
│   └── DataRecoveryCenter.vue (899 lines)

└── Canvas-Specific Modals
    ├── GroupEditModal.vue (393 lines)
    └── SectionWizard.vue (869 lines)
```

### 5. Context Menu System

```
Context Menu Hierarchy:
├── TaskContextMenu.vue (874 lines) - TASK OPERATIONS
├── ContextMenu.vue (245 lines) - BASE CONTEXT MENU
├── CanvasContextMenu.vue (515 lines) - CANVAS OPERATIONS
└── EdgeContextMenu.vue (157 lines) - CONNECTION OPERATIONS
```

### 6. Authentication Flow

```
AuthModal.vue (161 lines) - AUTHENTICATION HUB
├── LoginForm.vue (372 lines)
├── SignupForm.vue (492 lines)
├── ResetPasswordView.vue (346 lines)
├── GoogleSignInButton.vue (195 lines)
└── UserProfile.vue (391 lines)
```

### 7. State Management Dependencies

#### **Task Store Dependencies (60+ components)**
- Direct users: App.vue, BoardView, CalendarView, CanvasView
- Task displays: TaskCard, TaskRow, TaskTable, TaskList
- Modals: TaskEditModal, BatchEditModal
- UI components: ProjectTreeItem, HierarchicalTaskRow

#### **UI Store Dependencies (40+ components)**
- Sidebar management: App.vue, TaskManagerSidebar
- Theme integration: Base components
- Modal management: All modal components
- Density controls: BoardView, TaskCard

#### **Timer Store Dependencies (10+ components)**
- Timer display: TimeDisplay, TaskNode
- Timer controls: DoneToggle, TaskCard
- Session management: FocusView

#### **Canvas Store Dependencies (10+ components)**
- Canvas state: CanvasView, SectionManager
- Node management: TaskNode, CanvasSection
- Selection: MultiSelectionOverlay

### 8. External Library Integration

#### **Vue Flow Dependencies (10 components)**
```typescript
Core Integration:
CanvasView.vue → useVueFlow() → VueFlow component
    ↓
TaskNode.vue → Handle, Position
    ↓  
CanvasSection.vue → Parent-child relationships
    ↓
SectionManager.vue → Node operations
```

#### **Naive UI Dependencies (through base components)**
```typescript
Base Components → Naive UI:
BaseButton → n-button
BaseModal → n-modal
BaseInput → n-input
BaseDropdown → n-dropdown
```

#### **Lucide Vue Next Dependencies (all components)**
```typescript
Universal icon usage across all components:
Calendar, Clock, Check, Play → Time/Status
Settings, Plus, Edit → Actions
Priority icons → Task priorities
```

### 9. Component Interaction Patterns

#### **Parent-Child Relationships**
```
App.vue → Main Views → Feature Components → Base Components
    ↓                ↓                    ↓
  Sidebar        Board/Calendar      Task Cards/Nodes
  Controls        Views               Form Elements
```

#### **Modal Pattern**
```
Trigger Component → Modal Component → Form Fields
  ↓                   ↓                ↓
Button/Action    BaseModal.vue    Input/Select
                 (Central hub)     Validation
```

#### **Context Menu Pattern**
```
Right Click → Context Menu → Action Handler
    ↓            ↓              ↓
  Component   Position Menu  Store Update
```

#### **Drag-and-Drop Pattern**
```
Drag Start → Drag Handle → Drop Target
    ↓           ↓            ↓
  Component   Visual     Update State
               Feedback    Position
```

### 10. Circular Dependency Risks

#### **Identified Circular Risks**
1. **CanvasView ↔ SectionManager**
   - CanvasView manages sections, SectionManager updates canvas
   - **Risk**: State synchronization loops
   - **Mitigation**: Clear state ownership boundaries

2. **TaskEditModal ↔ Task Store**
   - Modal updates tasks, store triggers modal updates
   - **Risk**: Infinite update loops
   - **Mitigation**: Debounced updates

3. **BoardView ↔ TaskCard**
   - Board renders cards, cards update board state
   - **Risk**: Performance issues
   - **Mitigation**: Immutable updates

### 11. Refactoring Opportunities

#### **High-Value Extractions**
1. **Canvas Controls** from CanvasView.vue
2. **Task Form Fields** from TaskEditModal.vue
3. **Sidebar Layout** from App.vue
4. **Calendar View Switchers** from CalendarView.vue

#### **Consolidation Opportunities**
1. **Unified Context Menu** - Merge TaskContextMenu, ContextMenu, CanvasContextMenu
2. **Generic Modal System** - Reduce modal duplication
3. **Unified Task Display** - Consolidate TaskCard, TaskRow, TaskTable
4. **Base Component Extensions** - Enhance base components for broader use

#### **Composition Opportunities**
1. **UseForm composable** - Extract form logic from modals
2. **UseModal composable** - Centralize modal management
3. **UseDragAndDrop composable** - Extract drag functionality
4. **UseCalendar composable** - Extract calendar logic

---

**Generated**: November 2025
**Analysis Purpose**: Phase 2A - Dependency Mapping for Refactoring
**Focus Areas**: Component boundaries, circular dependencies, extraction opportunities
