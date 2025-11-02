# CLAUDE CODE SKILLS

**Location**: `.claude/skills/` - Auto-discovered skills for project-specific development patterns

## Available Skills

All skills show activation messages when used: **🔧 SKILL ACTIVATED**

### 🎯 Vue.js Development (`dev-vue`)
- Vue 3 Composition API with `<script setup>` patterns
- Component props, events, and TypeScript integration
- Performance optimization and project structure

### 🗃️ Pinia State Management (`dev-pinia-state`)
- Store patterns, cross-store communication, and optimistic updates
- Persistence strategies and error handling

### 🎭 Playwright Testing (`qa-playwright-testing`)
- Drag-drop testing, multi-view validation, accessibility testing
- Performance testing with large datasets

### 🔬 Comprehensive Testing (`qa-testing`)
- **MANDATORY**: Real data validation (no demo content)
- **ZERO TOLERANCE**: No console errors allowed
- **VISUAL CONFIRMATION**: Playwright MCP browser verification
- **CROSS-VIEW SYNC**: State changes across all views
- **DATA PERSISTENCE**: Verification after page refresh

### 📚 Storybook Documentation (`dev-storybook-documentation`)
- Story structure, interactive examples, design token documentation
- Component states and best practices

### 🎨 CSS/Design System (`dev-css-design-system`)
- Design tokens, responsive patterns, component styling
- Calendar/kanban/canvas specific styles

### 📋 Task Management (`dev-task-management`)
- Task CRUD, bulk operations, scheduling, dependencies
- Search, filtering, and project organization

### 📅 Calendar/Canvas Integration (`dev-calendar-canvas-integration`)
- Multi-view drag-drop, time slot calculations, canvas interactions
- Event resizing and performance optimization

### 🎨 Canvas Development, Design & Debugging (`dev-debug-canvas`)
- **Vue Flow architecture**: Node types, parent-child relationships, extent behavior, design patterns
- **NodeResizer configuration**: Handle types, style customization, event lifecycle
- **Development patterns**: Component structure, state management, interaction handlers
- **Debugging techniques**: DOM inspection with Playwright, CSS selector strategies
- **Testing strategies**: Playwright automation for drag/drop, resize, state verification
- **Common issues**: Children moving with parent, handle visibility, selector bugs
- **Solution patterns**: Preventing child movement, proper element targeting, design best practices

### ⚙️ Port Manager (`ops-port-manager`)
- **FIXED PORT 5546**: Always use port 5546 for main application
- Server health checks and port conflict resolution
- Development environment configuration and browser access patterns

## How Skills Work

Claude Code automatically detects which skill to use based on:
- **Context**: The type of work you're requesting
- **Keywords**: Specific terms related to each skill's domain
- **File patterns**: Working with certain file types or directories
- **Previous context**: Continuity within the same development session

Each skill contains:
- **Code patterns** specific to this project
- **Best practices** and conventions
- **Helper functions** and utilities
- **Common pitfalls** and solutions
- **Performance considerations**

---

# CRITICAL VALIDATION RULES

🚨 **PLAYWRIGHT VERIFICATION MANDATORY**: Test EVERY feature with Playwright MCP before claiming it works. Visual confirmation in browser is required. No assumptions, no console logs, no code analysis.

🚨 **ALWAYS CREATE AND UPDATE LIKE I SAID TASKS BEFORE DOING ANYTHING!!!**

ALWAYS TEST WITH PLAYWRIGHT BEFORE SAYING THAT SOMETHING IS DONE - IT PROBABLY ISN'T

CRITICAL VALIDATION RULE: Whatever you want me to test MUST be functional and visible through Playwright MCP browser. If it's not working in Playwright MCP, it's not working at all. Do not claim functionality exists without Playwright MCP confirmation.

NEVER CLAIM FUNCTIONALITY WORKS WITHOUT PLAYWRIGHT VERIFICATION: Always use Playwright MCP to test before confirming that any feature is working. Do not assume or claim success without actual visual confirmation through browser testing.

🚨 **PLAYWRIGHT FIRST RULE**: Test functionality with Playwright MCP BEFORE making claims about what works. Visual confirmation is mandatory.

---

# CORE PHILOSOPHY

🎯 **THIS IS A PERSONAL PRODUCTIVITY TOOL BUILT FOR ONE USER - ME**

This is MY productivity tool, built for MY workflow. Compromising on UX means I won't use it effectively, which defeats the entire purpose. Every feature, interaction, and design decision must serve MY specific productivity needs.

**CRITICAL PRINCIPLE**: Do not suggest "good enough" solutions, library compromises, or generic UX patterns. This tool must work EXACTLY as needed for MY workflow. No shortcuts, no settling, no "most users don't need this."

Build features as by-products of this core principle:
- Perfect UX trumps faster implementation
- Custom solutions over library limitations
- Exact workflow match over generic patterns
- Long-term usability over short-term convenience

**NEVER**: Use production language (production-ready, enterprise-quality, fully functional). Keep language practical and focused on what's actually working.

---

# PROJECT STRUCTURE

```
src/
├── components/
│   ├── base/              # BaseButton, BaseInput, BaseCard, BaseBadge, BaseIconButton, BaseNavItem
│   ├── board/             # KanbanColumn, TaskCard, KanbanSwimlane
│   ├── calendar/          # CalendarGrid, TaskEvent, ResizeHandle
│   ├── canvas/            # TaskNode, CanvasSection, InboxPanel, SectionManager, SectionNodeSimple, MultiSelectionOverlay, CanvasContextMenu, EdgeContextMenu, InboxContextMenu
│   └── modals/            # QuickTaskCreate, TaskEditModal, TaskContextMenu, ContextMenu, ProjectModal, SettingsModal, SearchModal, ConfirmationModal
├── stores/                # Pinia state management
├── views/                 # Main application views
└── stories/               # Storybook component stories

# Storybook Design System
├── Access: localhost:6006 (or npm run storybook)
├── Coverage: All 36 components documented with interactive examples
└── Categories: base, board, canvas, popups, right-click-menus, ui
```

---

# CALENDAR IMPLEMENTATION

## Required Features
1. **Drag from sidebar → calendar**: Tasks appear immediately after drop
2. **Resize handles**: Independent top/bottom handles (separate from drag)
3. **Ghost preview**: Real-time visual feedback during drag/resize
4. **Task movement**: Drag within calendar to reschedule
5. **Multi-slot spanning**: Tasks >30min span multiple time slots
6. **State sync**: Calendar ↔ sidebar ↔ kanban sync immediately

## Implementation Pattern
| Interaction | Zone | Handler |
|-------------|------|---------|
| Move task | Event center | Drag handle |
| Resize | Event edges (top/bottom) | Resize handles with `stopPropagation()` |
| Preview | Overlay | Ghost component |

## Architecture
- **State**: Single source of truth via Pinia store
- **Components**: CalendarGrid + TaskEvent + ResizeHandle + GhostPreview
- **Positioning**: Absolute positioning, proper z-index, grid-based slots
- **Performance**: 60fps interactions, proper event cleanup

---

# DESIGN SYSTEM

## Components (36 Total)

| Category | Components | Status |
|----------|-----------|--------|
| **Base (6)** | BaseButton, BaseInput, BaseCard, BaseBadge, BaseIconButton, BaseNavItem | 5/6 documented |
| **UI (9)** | TimeDisplay, DensityController, CustomSelect, ProjectTreeItem, TaskManagerSidebar, ProjectDropZone, EmojiPicker, CommandPalette, ErrorBoundary | 0/9 documented |
| **Board (3)** | KanbanColumn, TaskCard, KanbanSwimlane | 2/3 documented |
| **Canvas (9)** | TaskNode, CanvasSection, InboxPanel, SectionManager, SectionNodeSimple, MultiSelectionOverlay, CanvasContextMenu, EdgeContextMenu, InboxContextMenu | 1/9 documented |
| **Modal (9)** | QuickTaskCreate, TaskEditModal, TaskContextMenu, ContextMenu, ProjectModal, SettingsModal, SearchModal, ConfirmationModal | 3/9 documented |

## Design System Access
```bash
# Storybook (Interactive Documentation)
npm run storybook
# Visit: localhost:6006

# Via main app route (redirects to Storybook)
npm run dev
# Visit: localhost:5546/#/design-system (opens Storybook in new tab)
```

## Adding Components to Storybook

```typescript
// src/stories/category/ComponentName.stories.ts
import type { Meta, StoryObj } from '@storybook/vue3'
import ComponentName from '@/components/category/ComponentName.vue'

const meta: Meta<typeof ComponentName> = {
  title: 'Category/ComponentName',
  component: ComponentName,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    // component props
  },
}
```

## Guidelines
- **Interactive examples**: Use Storybook's controls and playground
- **Design tokens**: Reference actual CSS variables used in components
- **No modifications**: Document components as they exist in the codebase
- **Multiple states**: Show all component variations (hover, active, disabled, etc.)
- **Complete coverage**: Document all props, slots, and events

---

# TASK MANAGEMENT & MEMORY SYSTEM

## Critical Task Management Rule
🚨 **ALWAYS CREATE AND UPDATE LIKE I SAID TASKS BEFORE DOING ANYTHING!!!**

- Create tasks before starting work using TodoWrite tool
- Update tasks in real-time as you progress
- Mark complete only when functionality is verified with Playwright
- Never work without active task tracking
- Update progress immediately after completing each subtask

## Like I Said MCP Integration
- Use for task creation and management throughout development
- Update progress in real-time as features are implemented
- Reference completed tasks for context and continuity
- Maintain task history across sessions for project continuity
- Link related tasks for complex feature development

---

# TECHNICAL PATTERNS

## State Management
- Pinia store = single source of truth
- Reactive computed properties for rendering
- Immediate UI updates via Vue reactivity
- Real-time synchronization across all views

## Event Handling
```javascript
// Resize: prevent drag conflicts
onResize(event) {
  event.stopPropagation()
  // resize logic
}

// Drag: separate interaction zones
onDrag(event) {
  // move logic
}
```

## Component Data Flow
TaskStore → CalendarView → EventComponents → User Interaction → TaskStore (update) → All Views (sync)

## Performance
- Event delegation for multiple items
- Proper cleanup on component unmount
- Efficient slot-to-event mapping
- Smooth 60fps target for all interactions

---

# DEVELOPMENT WORKFLOW

## Testing Sequence (Mandatory)
1. Create and update tasks using TodoWrite
2. Write feature code
3. Test in Playwright MCP (mandatory)
4. Verify visual appearance and functionality
5. Confirm state synchronization across views
6. Only then: mark task as complete

## Component Documentation Priority
1. Missing base components (BaseIconButton)
2. UI components (all 9 missing)
3. Canvas components (8 missing)
4. Modal components (6 missing)
5. Complete partial docs (KanbanColumn, InboxPanel, TaskEditModal)

---

# CODE STANDARDS

## Vue 3 Composition API
- Use `<script setup>` syntax
- Reactive state via `ref()`, `reactive()`, `computed()`
- Props with TypeScript interfaces

## Styling
- Scoped styles with design tokens
- `var(--color-*)`, `var(--spacing-*)`, `var(--font-*)`
- No hardcoded colors or magic numbers

## Imports
```javascript
// Preferred order
import { ref } from 'vue'
import { useStore } from '@/stores/taskStore'
import BaseButton from '@/components/base/BaseButton.vue'
```

## File Naming
- Components: PascalCase (TaskCard.vue)
- Composables: camelCase (useTaskDrag.js)
- Stores: camelCase (taskStore.js)
- Pages: PascalCase (CalendarPage.vue)

---

# VALIDATION CHECKLIST

Before claiming any feature works:
- [ ] Created and updated TodoWrite tasks
- [ ] Implemented the feature code
- [ ] Tested with Playwright MCP browser
- [ ] Verified visual appearance matches requirements
- [ ] Confirmed state synchronization across views
- [ ] Marked tasks as complete only after Playwright confirmation
- [ ] Used practical language (no "production-ready" claims)
- [ ] Followed all code standards and patterns