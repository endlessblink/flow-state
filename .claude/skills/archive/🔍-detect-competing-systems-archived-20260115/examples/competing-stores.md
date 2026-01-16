# Competing Pinia Stores

## Scenario: Task Management Duplication

### ❌ BAD - Two Stores Managing Tasks

**Store 1: src/stores/TaskStore.ts**
```typescript
import { defineStore } from 'pinia';
import type { Task } from '@/types';

export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([]);
  const completed = ref<Task[]>([]);
  const pending = ref<Task[]>([]);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  // Core task operations
  function addTask(task: Task) {
    tasks.value.push(task);
    if (task.completed) {
      completed.value.push(task);
    } else {
      pending.value.push(task);
    }
  }

  function completeTask(id: string) {
    const task = tasks.value.find(t => t.id === id);
    if (task) {
      task.completed = true;
      const index = pending.value.findIndex(t => t.id === id);
      if (index !== -1) {
        pending.value.splice(index, 1);
        completed.value.push(task);
      }
    }
  }

  async function getTasks() {
    loading.value = true;
    error.value = null;
    try {
      const response = await fetch('/api/tasks');
      const data = await response.json();
      tasks.value = data;

      // Duplicate derived state management
      completed.value = data.filter(t => t.completed);
      pending.value = data.filter(t => !t.completed);
    } catch (err) {
      error.value = err as Error;
    } finally {
      loading.value = false;
    }
  }

  // Filtering logic
  function getTasksByStatus(status: 'completed' | 'pending') {
    return tasks.value.filter(t => t.completed === (status === 'completed'));
  }

  return {
    tasks,
    completed,
    pending,
    loading,
    error,
    addTask,
    completeTask,
    getTasks,
    getTasksByStatus
  };
});
```

**Store 2: src/stores/WorkflowStore.ts**
```typescript
import { defineStore } from 'pinia';
import type { WorkflowItem } from '@/types';

export const useWorkflowStore = defineStore('workflow', () => {
  const items = ref<WorkflowItem[]>([]);
  const done = ref<WorkflowItem[]>([]);
  const todo = ref<WorkflowItem[]>([]);
  const isLoading = ref(false);
  const errorMessage = ref<Error | null>(null);

  // Nearly identical task operations (87% similar)
  function createItem(item: WorkflowItem) {
    items.value.push(item);
    if (item.status === 'done') {
      done.value.push(item);
    } else {
      todo.value.push(item);
    }
  }

  function markDone(id: string) {
    const item = items.value.find(i => i.id === id);
    if (item) {
      item.status = 'done';
      const index = todo.value.findIndex(i => i.id === id);
      if (index !== -1) {
        todo.value.splice(index, 1);
        done.value.push(item);
      }
    }
  }

  async function getAllItems() {
    isLoading.value = true;
    errorMessage.value = null;
    try {
      const response = await fetch('/api/tasks');  // Same endpoint
      const data = await response.json();
      items.value = data.map(t => ({ ...t, type: 'workflow' }));

      // Duplicate derived state management
      done.value = data.filter(t => t.completed).map(t => ({ ...t, type: 'workflow' }));
      todo.value = data.filter(t => !t.completed).map(t => ({ ...t, type: 'workflow' }));
    } catch (err) {
      errorMessage.value = err as Error;
    } finally {
      isLoading.value = false;
    }
  }

  // Duplicate filtering logic
  function getItemsByStatus(status: 'done' | 'todo') {
    return items.value.filter(i => i.status === status);
  }

  return {
    items,
    done,
    todo,
    isLoading,
    errorMessage,
    createItem,
    markDone,
    getAllItems,
    getItemsByStatus
  };
});
```

### ✅ GOOD - Single Consolidated Store

**Consolidated: src/stores/TaskStore.ts**
```typescript
import { defineStore } from 'pinia';
import type { Task, TaskFilter, TaskContext } from '@/types';

interface TaskFilter {
  status?: 'all' | 'completed' | 'pending';
  context?: 'all' | 'workflow' | 'personal';
  category?: string;
}

export const useTaskStore = defineStore('tasks', () => {
  // Single source of truth for task data
  const tasks = ref<Task[]>([]);
  const loading = ref(false);
  const error = ref<Error | null>(null);
  const filterCriteria = reactive<TaskFilter>({
    status: 'all',
    context: 'all'
  });

  // Computed derived state instead of duplicating arrays
  const completed = computed(() =>
    tasks.value.filter(t => t.completed)
  );

  const pending = computed(() =>
    tasks.value.filter(t => !t.completed)
  );

  // Context-specific computed for workflow needs
  const workflowItems = computed(() =>
    tasks.value.map(t => ({
      ...t,
      type: 'workflow' as const,
      status: t.completed ? 'done' : 'todo'
    }))
  );

  const doneItems = computed(() =>
    workflowItems.value.filter(i => i.status === 'done')
  );

  const todoItems = computed(() =>
    workflowItems.value.filter(i => i.status === 'todo')
  );

  // Flexible filtering instead of multiple filter methods
  const filteredTasks = computed(() => {
    let result = [...tasks.value];

    if (filterCriteria.status !== 'all') {
      const isCompleted = filterCriteria.status === 'completed';
      result = result.filter(t => t.completed === isCompleted);
    }

    if (filterCriteria.context !== 'all') {
      result = result.map(t => ({ ...t, type: filterCriteria.context }));
    }

    return result;
  });

  // Single implementation for task operations
  function addTask(task: Task) {
    tasks.value.push(task);
  }

  function completeTask(id: string) {
    const task = tasks.value.find(t => t.id === id);
    if (task) {
      task.completed = true;
      task.completedAt = new Date();
    }
  }

  function updateTask(id: string, updates: Partial<Task>) {
    const index = tasks.value.findIndex(t => t.id === id);
    if (index !== -1) {
      tasks.value[index] = { ...tasks.value[index], ...updates };
    }
  }

  async function fetchTasks() {
    loading.value = true;
    error.value = null;
    try {
      const response = await fetch('/api/tasks');
      const data = await response.json();
      tasks.value = data;
    } catch (err) {
      error.value = err as Error;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Filter setters instead of multiple getter methods
  function setStatusFilter(status: TaskFilter['status']) {
    filterCriteria.status = status;
  }

  function setContextFilter(context: TaskFilter['context']) {
    filterCriteria.context = context;
  }

  function clearFilters() {
    filterCriteria.status = 'all';
    filterCriteria.context = 'all';
    filterCriteria.category = undefined;
  }

  return {
    // State
    tasks,
    loading,
    error,
    filterCriteria,

    // Computed derived state
    completed,
    pending,
    filteredTasks,

    // Workflow-specific computed (no duplication needed)
    workflowItems,
    doneItems,
    todoItems,

    // Actions
    addTask,
    completeTask,
    updateTask,
    fetchTasks,
    setStatusFilter,
    setContextFilter,
    clearFilters
  };
});
```

**Usage in Components:**

```typescript
// For general task management
const taskStore = useTaskStore();
const { tasks, completed, pending } = storeToRefs(taskStore);

// For workflow-specific views
const { workflowItems, doneItems, todoItems } = storeToRefs(taskStore);

// For filtered views
const { filteredTasks, setStatusFilter } = taskStore;
```

### Conflict Report

**COMPETING SYSTEM DETECTED**
- **Category**: State Management
- **Severity**: HIGH

**Conflict Type**: Duplicate Pinia Stores
- **Scope**: tasks/workflow management
- **Pattern Match**: 87% code similarity in core methods

**Files Involved**:
- `src/stores/TaskStore.ts` (primary implementation)
- `src/stores/WorkflowStore.ts` (duplicate functionality)

**Issues Identified**:
1. **Duplicate data fetching**: Both stores fetch from `/api/tasks`
2. **Redundant derived state**: Managing completed/pending arrays separately
3. **Similar filtering logic**: `getTasksByStatus` vs `getItemsByStatus`
4. **Inconsistent naming**: Task vs Item, Complete vs Done
5. **Duplicate error handling**: Similar error state management
6. **Maintenance burden**: Changes must be made in two places

**Recommendation**: Consolidate into single TaskStore
1. **Keep TaskStore** as primary implementation (more established)
2. **Move WorkflowStore logic** to computed properties
3. **Add context support** to handle workflow vs personal distinctions
4. **Update all WorkflowStore imports** to use TaskStore
5. **Delete redundant WorkflowStore.ts**

**Estimated Effort**: 2-3 hours
- **Data migration**: 30 minutes
- **Component updates**: 1-2 hours
- **Testing**: 30 minutes

**Risk**: Medium
- **Breaking changes**: Requires updating all WorkflowStore consumers
- **Testing scope**: All components using workflow functionality
- **Rollback difficulty**: Medium (can keep WorkflowStore as backup)

**Migration Path**:
1. Create workflow-specific computed in TaskStore
2. Add backward compatibility methods if needed
3. Update WorkflowStore imports one component at a time
4. Test each updated component thoroughly
5. Remove WorkflowStore after all updates complete
6. Update documentation and team guidelines

**Benefits**:
- **Single source of truth** for task data
- **Consistent API** across the application
- **Reduced maintenance** overhead
- **Better type safety** with unified interfaces
- **Improved performance** through computed properties
- **Easier testing** with single store to mock