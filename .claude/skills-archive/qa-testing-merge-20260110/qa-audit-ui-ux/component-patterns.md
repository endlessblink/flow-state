# Component Patterns & Consistency

## Overview

This document defines the standard patterns for Vue 3 components in Pomo-Flow to ensure consistency across the codebase.

## Component Structure Standard

### Canonical Component Template

```vue
<script setup lang="ts">
// ===== IMPORTS (Organized by Type) =====
// 1. Vue core imports
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

// 2. Store imports
import { useTaskStore } from '@/stores/tasks'
import { use UIStore } from '@/stores/ui'

// 3. Composables
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'

// 4. Types
import type { Task, Project } from '@/types'

// 5. Components (if needed in script)
import TaskCard from './TaskCard.vue'

// ===== PROPS INTERFACE =====
interface Props {
  taskId: string                    // Required props first
  projectId?: string                // Optional props after
  variant?: 'default' | 'compact'   // Enum types for variants
  readonly?: boolean                // Boolean flags
}

// Define props with defaults for optional values
const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  readonly: false
})

// ===== EMITS DEFINITION =====
const emit = defineEmits<{
  update: [task: Task]              // Event name: [payload type]
  delete: [id: string]
  'status-change': [status: string] // Kebab-case for multi-word events
}>()

// ===== STORE USAGE =====
const taskStore = useTaskStore()
const uiStore = useUIStore()

// ===== COMPOSABLES =====
const { createTaskWithUndo, updateTaskWithUndo } = useUnifiedUndoRedo()

// ===== LOCAL STATE =====
const isLoading = ref(false)
const isEditing = ref(false)
const localTitle = ref('')

// ===== COMPUTED PROPERTIES =====
const task = computed(() => taskStore.getTask(props.taskId))
const isCompleted = computed(() => task.value?.status === 'done')
const displayTitle = computed(() => task.value?.title || 'Untitled')

// ===== WATCHERS =====
watch(() => props.taskId, (newId) => {
  // Reset local state when taskId changes
  isEditing.value = false
  localTitle.value = ''
})

// ===== METHODS =====
const handleUpdate = async () => {
  if (props.readonly) return

  isLoading.value = true
  try {
    await updateTaskWithUndo(props.taskId, {
      title: localTitle.value
    })
    emit('update', task.value!)
  } catch (error) {
    console.error('Failed to update task:', error)
  } finally {
    isLoading.value = false
  }
}

const handleDelete = () => {
  if (confirm('Delete this task?')) {
    emit('delete', props.taskId)
  }
}

// ===== LIFECYCLE HOOKS =====
onMounted(() => {
  // Initialization logic
  localTitle.value = task.value?.title || ''
})

onUnmounted(() => {
  // Cleanup logic
})
</script>

<template>
  <div
    class="task-component"
    :class="{
      'is-loading': isLoading,
      'is-completed': isCompleted,
      [`variant-${variant}`]: true
    }"
  >
    <!-- Component markup -->
  </div>
</template>

<style scoped>
/* Component-specific styles */
.task-component {
  /* Base styles using design tokens */
  background: var(--surface-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}

/* State modifiers */
.task-component.is-loading {
  opacity: 0.6;
  pointer-events: none;
}

.task-component.is-completed {
  opacity: 0.7;
}

/* Variant modifiers */
.task-component.variant-compact {
  padding: var(--space-2);
}
</style>
```

## Component Naming Conventions

### File Naming
```
✅ Good:
- TaskCard.vue (PascalCase, descriptive)
- CalendarView.vue (PascalCase with type suffix)
- BaseButton.vue (Prefix for base components)
- CanvasSection.vue (Prefix for feature components)
- KanbanColumn.vue (Prefix for feature components)

❌ Bad:
- taskcard.vue (not PascalCase)
- Card.vue (too generic)
- TC.vue (abbreviation, not self-documenting)
- task-card.vue (kebab-case, wrong convention)
```

### Component Prefixes

**Base Components** (Reusable primitives):
- `Base*` - BaseButton, BaseInput, BaseModal, BaseCard
- Located in `src/components/base/`

**Feature Components** (Domain-specific):
- `Canvas*` - CanvasSection, CanvasContextMenu
- `Kanban*` - KanbanColumn, KanbanSwimlane
- Located in `src/components/canvas/` or `src/components/kanban/`

**View Components** (Pages/routes):
- `*View` - BoardView, CalendarView, CanvasView
- Located in `src/views/`

### Component Name Matching
```vue
<!-- ✅ Good: Filename matches component name -->
<!-- File: TaskCard.vue -->
<script setup lang="ts">
// Component automatically named "TaskCard"
</script>

<!-- ❌ Bad: Mismatched names cause confusion -->
<!-- File: TaskCard.vue -->
<script>
export default {
  name: 'TaskItem' // ❌ Doesn't match filename
}
</script>
```

## Props Patterns

### Props Ordering
```typescript
interface Props {
  // 1. Required props (most important first)
  taskId: string
  projectId: string

  // 2. Optional data props
  initialTitle?: string
  metadata?: Record<string, unknown>

  // 3. Variant/display props
  variant?: 'default' | 'compact' | 'minimal'
  size?: 'sm' | 'md' | 'lg'

  // 4. Boolean flags
  readonly?: boolean
  disabled?: boolean
  loading?: boolean

  // 5. Callback props (rare in Composition API, prefer emits)
  onUpdate?: (task: Task) => void
}
```

### Props Naming Conventions
```typescript
// ✅ Good: Descriptive, consistent naming
interface Props {
  taskId: string           // Specific ID type
  isCompleted: boolean     // Boolean prefix "is"
  canEdit: boolean         // Boolean prefix "can"
  hasSubtasks: boolean     // Boolean prefix "has"
  showActions: boolean     // Boolean prefix "show"
  variant: 'default' | 'compact' // Enum for variants
}

// ❌ Bad: Inconsistent, vague naming
interface Props {
  id: string              // Too generic
  completed: boolean      // Missing "is" prefix
  editable: boolean       // Should be "canEdit"
  subtasks: boolean       // Should be "hasSubtasks"
  actions: boolean        // Should be "showActions"
  type: string            // Better as enum "variant"
}
```

### Default Values Pattern
```typescript
// ✅ Good: Clear defaults using withDefaults
const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'md',
  readonly: false,
  disabled: false,
  loading: false,
  initialTitle: ''
})

// ❌ Bad: No defaults for optional props
const props = defineProps<Props>()
```

## Emits Patterns

### Emits Naming
```typescript
// ✅ Good: Descriptive event names
const emit = defineEmits<{
  // Simple events
  close: []                        // No payload
  update: [task: Task]             // Single payload
  delete: [id: string]

  // Multi-word events (kebab-case in template)
  'status-change': [status: string]
  'priority-update': [priority: string]
  'selection-change': [selected: string[]]
}>()

// Usage in template:
<Component
  @close="handleClose"
  @update="handleUpdate"
  @status-change="handleStatusChange"
/>
```

### Event Payload Consistency
```typescript
// ✅ Good: Consistent payload structure for similar events
const emit = defineEmits<{
  'task-create': [task: Task]
  'task-update': [task: Task]
  'task-delete': [task: Task]     // Pass full object for context
}>()

// ❌ Bad: Inconsistent payloads
const emit = defineEmits<{
  'task-create': [task: Task]
  'task-update': [id: string, title: string]  // Different structure
  'task-delete': []                            // No context
}>()
```

## Computed Properties

### Naming Conventions
```typescript
// ✅ Good: Descriptive computed names
const displayTitle = computed(() => task.value?.title || 'Untitled')
const isCompleted = computed(() => task.value?.status === 'done')
const canEdit = computed(() => !props.readonly && !props.disabled)
const hasSubtasks = computed(() => task.value?.subtasks.length > 0)

// Derived data
const completionPercentage = computed(() => {
  if (!task.value?.subtasks.length) return 0
  const completed = task.value.subtasks.filter(s => s.completed).length
  return Math.round((completed / task.value.subtasks.length) * 100)
})

// ❌ Bad: Vague or inconsistent naming
const title = computed(() => task.value?.title)      // Too generic
const complete = computed(() => task.value?.done)    // Inconsistent with "isCompleted"
const edit = computed(() => !props.readonly)         // Should be "canEdit"
```

### Computed vs Methods
```typescript
// ✅ Use computed for:
const sortedTasks = computed(() =>
  tasks.value.sort((a, b) => a.priority - b.priority)
)
const filteredTasks = computed(() =>
  tasks.value.filter(t => t.status !== 'done')
)

// ✅ Use methods for:
const deleteTask = (id: string) => {
  emit('delete', id)
}
const toggleStatus = () => {
  isCompleted.value = !isCompleted.value
}
```

## State Management

### Local vs Store State
```typescript
// ✅ Good: Clear separation of concerns
// Local UI state (temporary, component-specific)
const isEditing = ref(false)
const isHovered = ref(false)
const localSearchQuery = ref('')

// Store state (persistent, shared)
const taskStore = useTaskStore()
const tasks = computed(() => taskStore.tasks)
const projects = computed(() => taskStore.projects)

// ❌ Bad: Duplicating store state locally
const tasks = ref([])  // ❌ Should use taskStore.tasks
const localTasks = computed(() => taskStore.tasks.slice())  // ❌ Unnecessary copy
```

### Reactive State Patterns
```typescript
// ✅ Good: Use ref for primitives, reactive for objects
const count = ref(0)
const isActive = ref(false)
const formData = reactive({
  title: '',
  description: '',
  priority: 'medium'
})

// ❌ Bad: Using reactive for primitives
const count = reactive({ value: 0 })  // Overcomplicated
const isActive = reactive({ value: false })
```

## Template Patterns

### Class Binding Consistency
```vue
<template>
  <!-- ✅ Good: Consistent class binding patterns -->
  <div
    class="task-card"
    :class="{
      'is-active': isActive,
      'is-loading': isLoading,
      'is-disabled': disabled,
      [`variant-${variant}`]: true,
      [`priority-${priority}`]: priority
    }"
  >
    <!-- Content -->
  </div>

  <!-- ❌ Bad: Inconsistent class patterns -->
  <div
    :class="['task-card', isActive && 'active', `type-${variant}`]"
  >
    <!-- Mixing array/object syntax, inconsistent naming -->
  </div>
</template>
```

### Conditional Rendering
```vue
<template>
  <!-- ✅ Good: v-if for expensive renders, v-show for frequent toggles -->
  <div v-if="shouldRender">
    <ExpensiveComponent />
  </div>

  <div v-show="isVisible">
    <LightweightComponent />
  </div>

  <!-- ❌ Bad: v-show for expensive components -->
  <div v-show="shouldRender">
    <ExpensiveComponent /> <!-- Rendered even when hidden -->
  </div>
</template>
```

### Event Handlers
```vue
<template>
  <!-- ✅ Good: Clear event handler names -->
  <button @click="handleDelete">Delete</button>
  <input @input="handleTitleChange" />
  <div @mouseenter="handleMouseEnter" />

  <!-- ❌ Bad: Vague or inconsistent naming -->
  <button @click="del">Delete</button>
  <input @input="onChange" />
  <div @mouseenter="onEnter" />
</template>
```

## Style Patterns

### Scoped Styles
```vue
<style scoped>
/* ✅ Good: Component-specific styles, using design tokens */
.task-card {
  background: var(--surface-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.task-card:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-md);
}

.task-card.is-active {
  border-color: var(--state-active-border);
  background: var(--state-active-bg);
}

/* ❌ Bad: Hardcoded values, !important overuse */
.task-card {
  background: #1e293b !important;
  border: 1px solid #374151;
  border-radius: 8px;
  padding: 16px;
}
</style>
```

### BEM-Style Modifiers
```vue
<style scoped>
/* ✅ Good: Clear state modifiers with "is-" prefix */
.component { }
.component.is-active { }
.component.is-loading { }
.component.is-disabled { }

/* ✅ Good: Variant modifiers with descriptive prefix */
.component.variant-compact { }
.component.variant-minimal { }
.component.priority-high { }

/* ❌ Bad: Ambiguous class names */
.component.active { }     /* Could be state or data */
.component.compact { }    /* Not clear it's a variant */
.component.red { }        /* Should be .priority-high */
</style>
```

## Component Communication Patterns

### Parent → Child (Props)
```vue
<!-- Parent -->
<template>
  <TaskCard
    :task-id="selectedTaskId"
    :readonly="isViewMode"
    variant="compact"
  />
</template>

<!-- Child receives via props interface -->
```

### Child → Parent (Emits)
```vue
<!-- Child -->
<script setup lang="ts">
const emit = defineEmits<{
  update: [task: Task]
  delete: [id: string]
}>()

const handleUpdate = () => {
  emit('update', updatedTask)
}
</script>

<!-- Parent -->
<template>
  <TaskCard
    @update="handleTaskUpdate"
    @delete="handleTaskDelete"
  />
</template>
```

### Sibling Communication (Store)
```typescript
// ✅ Good: Use Pinia store for shared state
// Component A
const taskStore = useTaskStore()
taskStore.updateTask(taskId, changes)

// Component B (automatically reactive)
const tasks = computed(() => taskStore.tasks)

// ❌ Bad: Prop drilling through parent
// Don't pass data up to parent just to send down to sibling
```

## Error Handling

### Standard Error Patterns
```typescript
// ✅ Good: Consistent error handling
const handleSave = async () => {
  isLoading.value = true
  error.value = null

  try {
    await saveTask(task.value)
    toast.success('Task saved successfully')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to save task'
    console.error('Save task error:', err)
  } finally {
    isLoading.value = false
  }
}

// ❌ Bad: Silent failures or inconsistent handling
const handleSave = async () => {
  try {
    await saveTask(task.value)
  } catch (err) {
    // Silent failure - user has no feedback
  }
}
```

## Component Checklist

### Before Committing a Component

- [ ] **Structure**
  - [ ] Imports organized by type (Vue → stores → composables → types)
  - [ ] Props interface with TypeScript types
  - [ ] Emits definition with payload types
  - [ ] Proper script setup structure

- [ ] **Naming**
  - [ ] PascalCase filename
  - [ ] Descriptive, self-documenting name
  - [ ] Proper prefix (Base*, Canvas*, Kanban*, etc.)
  - [ ] Props use consistent naming (isX, canX, hasX, showX)
  - [ ] Methods use handle* prefix for event handlers

- [ ] **Props & Emits**
  - [ ] Required props before optional
  - [ ] Default values for optional props
  - [ ] Emits have typed payloads
  - [ ] Multi-word events use kebab-case

- [ ] **State Management**
  - [ ] Local state for UI-specific data only
  - [ ] Store state for shared/persistent data
  - [ ] Computed properties for derived state
  - [ ] Watchers only when necessary

- [ ] **Styling**
  - [ ] Uses design tokens (no hardcoded values)
  - [ ] Scoped styles
  - [ ] State modifiers with "is-" prefix
  - [ ] Variant modifiers with descriptive names
  - [ ] Consistent class naming

- [ ] **Accessibility**
  - [ ] Semantic HTML elements
  - [ ] ARIA labels on icon buttons
  - [ ] Keyboard navigation support
  - [ ] Focus indicators visible

- [ ] **Error Handling**
  - [ ] Try/catch for async operations
  - [ ] Loading states shown to user
  - [ ] Error messages displayed
  - [ ] Finally blocks for cleanup

- [ ] **Performance**
  - [ ] v-if for conditional expensive renders
  - [ ] v-show for frequent toggles
  - [ ] Computed properties memoized
  - [ ] Event listeners cleaned up

---

**Last Updated:** October 23, 2025
**Pattern Version:** 1.0.0
