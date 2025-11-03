# Perplexity Debug Query: Nested Tasks and UI Enhancement Issues

## Context

### System Environment
- **Project**: pomo-flow - Vue 3 productivity application
- **Tech Stack**: Vue 3 + TypeScript + Vite + Pinia
- **Dev Server**: Running on http://localhost:5547
- **Browser**: Chrome/Edge with Playwright testing
- **OS**: Linux (WSL2 environment)

### Recent Changes Made
1. **Added `parentTaskId` field** to Task interface in `src/stores/tasks.ts`
2. **Created MultiSelectToggle component** with glass morphism design
3. **Enhanced DragHandle component** with improved visibility
4. **Updated HierarchicalTaskRow** to use new nested task structure
5. **Added nested task management functions** to task store

### Key Files Modified
- `src/stores/tasks.ts` - Task interface and nested task functions
- `src/components/MultiSelectToggle.vue` - Custom multi-select component
- `src/components/DragHandle.vue` - Enhanced drag indicator
- `src/components/HierarchicalTaskRow.vue` - Updated for nested tasks

### Current Dependencies
- Vue 3.x with Composition API
- Pinia for state management
- Lucide icons for UI components
- Custom CSS variables for theming

## Problem

### Primary Issues
1. **Nested Tasks Not Visible**: After implementing `parentTaskId` field, nested tasks are not showing up in the list view hierarchy
2. **MultiSelectToggle Design Integration**: The glass morphism design may conflict with existing CSS variables
3. **DragHandle Visibility**: Enhanced drag indicators may not be properly integrated with the task row layout
4. **Build Compilation**: Recent syntax errors in tasks.ts required fixes

### Secondary Issues
1. **CSS Variable Conflicts**: Glass morphism effects rely on custom CSS properties that may not be defined
2. **Component Integration**: New components need proper integration in HierarchicalTaskRow grid layout
3. **State Synchronization**: Nested task changes may not properly sync between components
4. **Performance**: Enhanced animations may impact performance on large task lists

### Error Symptoms
- **Build Errors**: TypeScript compilation failed due to syntax errors in tasks.ts (fixed)
- **Missing Nested Tasks**: Tasks with `parentTaskId` are not being rendered in hierarchical structure
- **Layout Issues**: Grid layout may break with new component sizes
- **CSS Conflicts**: Glass morphism gradients may not render without proper CSS variables

### Expected vs Actual Behavior
**Expected**:
- Parent tasks show expand/collapse chevrons when they have children
- Nested tasks appear indented under their parents
- Multi-select toggles have glass morphism appearance
- Drag handles are prominent and clearly indicate draggability

**Actual**:
- Build compiles successfully but nested tasks not visible
- Components may show fallback styling instead of enhanced design
- Layout may have misaligned elements

## Constraints

### Must Remain Unchanged
1. **Existing Task Data Structure**: Cannot modify existing task data in the database
2. **Core Task Functionality**: Basic task CRUD operations must continue working
3. **Existing UI Components**: All other components (kanban, calendar, canvas) must remain functional
4. **Database Schema**: IndexedDB storage and migration logic must not be broken
5. **API Endpoints**: All existing API integrations must continue working

### Cannot Break
1. **Existing subtasks array approach** - must maintain backward compatibility
2. **Project-based filtering** - must continue working with existing projects
3. **Task completion workflow** - existing done/undone functionality
4. **Drag and drop to other views** - existing integration with canvas and kanban

## Goal

### Success Definition
1. **Nested Tasks Visible**: Tasks with `parentTaskId` display correctly in hierarchical structure with proper indentation
2. **Enhanced UI Working**: MultiSelectToggle and DragHandle components render with improved design
3. **Layout Intact**: Task rows maintain proper alignment and responsive behavior
4. **State Consistent**: Changes to nested task structure properly reflect across all views
5. **Performance Maintained**: Enhanced animations don't degrade performance on large datasets

### Acceptable Outcomes
- Glass morphism design falls back gracefully if CSS variables unavailable
- Enhanced components work with minimal CSS if advanced styling fails
- Performance is acceptable with up to 1000 tasks

## Code Snippets

### Current Task Interface (Fixed)
```typescript
export interface Task {
  id: string
  title: string
  description: string
  status: 'planned' | 'in_progress' | 'done' | 'backlog' | 'on_hold'
  priority: 'low' | 'medium' | 'high' | null
  progress: number
  completedPomodoros: number
  subtasks: Subtask[] // Keep for backward compatibility
  dueDate: string
  scheduledDate?: string
  scheduledTime?: string
  estimatedDuration?: number
  instances?: TaskInstance[]
  projectId: string
  parentTaskId?: string | null // NEW: For nested tasks
  createdAt: Date
  updatedAt: Date
  // ... other existing fields
}
```

### Nested Task Functions (Working)
```typescript
const getNestedTasks = (parentTaskId: string | null = null): Task[] => {
  return tasks.value.filter(task => task.parentTaskId === parentTaskId)
}

const getTaskChildren = (taskId: string): Task[] => {
  return tasks.value.filter(task => task.parentTaskId === taskId)
}

const hasNestedTasks = (taskId: string): boolean => {
  return tasks.value.some(task => task.parentTaskId === taskId)
}
```

### HierarchicalTaskRow Template (Needs Integration)
```vue
<template>
  <div class="hierarchical-task-row">
    <div class="task-row" :style="{ paddingLeft: `${indentLevel * 16 + 12}px` }">
      <!-- Drag Handle - NEEDS INTEGRATION -->
      <div class="task-row__drag-handle" @click.stop>
        <DragHandle
          :disabled="false"
          size="sm"
          :title="`Drag to move ${task.title}`"
          @dragStart="handleDragStart"
          @dragEnd="handleDragEnd"
        />
      </div>

      <!-- Expand/Collapse Chevron -->
      <div class="task-row__expand" @click.stop="toggleExpanded">
        <ChevronRight
          v-if="hasSubtasks"
          :size="16"
          class="expand-icon"
          :class="{ 'expand-icon--expanded': isExpanded }"
        />
      </div>

      <!-- Multi-Select Toggle - NEEDS INTEGRATION -->
      <div class="task-row__select-toggle" @click.stop>
        <MultiSelectToggle
          :selected="selected"
          :aria-label="`Select ${task.title}`"
          @change="handleSelectionChange"
        />
      </div>

      <!-- Done Toggle -->
      <div class="task-row__done-toggle" @click.stop>
        <DoneToggle
          :completed="task.status === 'done'"
          size="sm"
          variant="default"
          @toggle="handleToggleComplete"
        />
      </div>

      <!-- Title -->
      <div class="task-row__title">
        <span class="task-row__title-text">
          {{ task.title }}
        </span>
        <span v-if="hasSubtasks" class="subtask-count">
          {{ completedSubtaskCount }}/{{ childTasks.length }}
        </span>
      </div>

      <!-- Other task fields... -->
    </div>

    <!-- Nested Tasks (Recursive) -->
    <template v-if="isExpanded && hasSubtasks">
      <HierarchicalTaskRow
        v-for="childTask in childTasks"
        :key="childTask.id"
        :task="childTask"
        :indent-level="indentLevel + 1"
        :expanded-tasks="expandedTasks"
        <!-- ... other props -->
      />
    </template>
  </div>
</template>
```

### CSS Grid Layout (May Need Adjustment)
```css
.task-row {
  display: grid;
  grid-template-columns: 24px 24px 24px 32px 1fr 120px 80px 100px 80px;
  grid-template-areas: "drag expand done-select select title due priority status actions";
  height: 36px;
  align-items: center;
  gap: var(--space-2);
}
```

### CSS Variables (May Need Definition)
```css
:root {
  /* Glass morphism variables - ADD IF MISSING */
  --glass-bg-soft: rgba(255, 255, 255, 0.1);
  --glass-bg-light: rgba(255, 255, 255, 0.15);
  --glass-border: rgba(255, 255, 255, 0.2);

  /* State variables - ADD IF MISSING */
  --state-hover-bg: rgba(59, 130, 246, 0.1);
  --state-hover-border: rgba(59, 130, 246, 0.3);
  --state-hover-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  --state-hover-glow: 0 0 20px rgba(59, 130, 246, 0.3);
  --state-active-bg: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  --state-active-border: #3b82f6;
  --state-active-text: white;
  --state-active-glass: blur(10px);
}
```

## Request

Please provide:

1. **Root Cause Analysis**: Why are nested tasks not appearing in the hierarchy despite the data structure being correct?
2. **CSS Variable Issues**: Which CSS variables are undefined and causing glass morphism to fall back?
3. **Safe Fix Strategy**: Step-by-step approach to fix issues without breaking existing functionality
4. **Testing Methodology**: How to verify each fix works without affecting other components
5. **Code Examples**: Specific, working code snippets for fixing nested task rendering and component integration
6. **Fallback Strategies**: What to do if enhanced styling doesn't work with existing theme system

Please focus on maintaining backward compatibility and ensuring all existing functionality continues to work while only fixing the broken parts.