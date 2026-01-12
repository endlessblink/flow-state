# Fix: Circular Dependencies (156 Cycles)

**Priority**: P2-MEDIUM
**Time Estimate**: 2+ hours
**Dependencies**: All other fixes complete first

---

## Problem

The test `tests/safety/dependencies.test.ts` detects 156 circular dependency cycles in the codebase.

```
AssertionError: expected [ Array(156) ] to have a length of +0 but got 156
```

---

## Analysis First

### Step 1: Identify Critical Cycles

```bash
# Run the dependency test with verbose output:
npm test -- --run tests/safety/dependencies.test.ts 2>&1 | head -100

# Or add logging to the test to see the cycles:
# In tests/safety/dependencies.test.ts, before the expect():
console.log('Circular dependencies found:');
circularDeps.forEach(cycle => console.log(cycle));
```

### Step 2: Categorize Cycles

Common patterns in Vue/Pinia apps:

| Pattern | Example | Fix Strategy |
|---------|---------|--------------|
| Store ↔ Composable | `tasks.ts` ↔ `useTaskActions.ts` | Lazy import or DI |
| Store ↔ Store | `tasks.ts` ↔ `canvas.ts` | Event-based or shared module |
| Component ↔ Utility | `TaskNode.vue` ↔ `taskUtils.ts` | Extract types to separate file |
| Service ↔ Store | `supabase.ts` ↔ `auth.ts` | Inversion of control |

---

## Fix Strategies

### Strategy 1: Lazy Imports (Most Common Fix)

```typescript
// BEFORE (creates cycle):
import { useTaskStore } from '@/stores/tasks';

export function useTaskActions() {
  const taskStore = useTaskStore();
  // ...
}

// AFTER (breaks cycle with lazy import):
export function useTaskActions() {
  // Import inside function, not at module level
  const { useTaskStore } = await import('@/stores/tasks');
  const taskStore = useTaskStore();
  // ...
}

// OR use dynamic getter:
const getTaskStore = () => {
  const { useTaskStore } = require('@/stores/tasks');
  return useTaskStore();
};
```

### Strategy 2: Dependency Injection

```typescript
// BEFORE:
import { useTaskStore } from '@/stores/tasks';

export function useTaskActions() {
  const taskStore = useTaskStore();
  return { /* actions using taskStore */ };
}

// AFTER:
export function useTaskActions(taskStore?: ReturnType<typeof useTaskStore>) {
  const store = taskStore ?? useTaskStore();
  return { /* actions using store */ };
}

// At call site:
const taskStore = useTaskStore();
const actions = useTaskActions(taskStore);
```

### Strategy 3: Extract Shared Types

```typescript
// BEFORE - types.ts imports from store.ts which imports from types.ts
// store.ts
import { Task } from './types';
export const useTaskStore = ...

// types.ts
import { useTaskStore } from './store';  // CYCLE!
export type TaskStore = ReturnType<typeof useTaskStore>;

// AFTER - separate type definitions
// types/task.ts (no imports from stores)
export interface Task { id: string; title: string; }

// types/stores.ts (type-only imports)
import type { Task } from './task';
export interface TaskStoreState { tasks: Task[]; }

// stores/tasks.ts
import type { Task, TaskStoreState } from '@/types';
```

### Strategy 4: Event-Based Communication

```typescript
// BEFORE - stores directly reference each other
// tasks.ts
import { useCanvasStore } from './canvas';
const canvasStore = useCanvasStore();
canvasStore.updateNode(task);

// AFTER - use events
// events/taskEvents.ts
import mitt from 'mitt';
export const taskEvents = mitt<{
  'task:updated': Task;
  'task:deleted': string;
}>();

// tasks.ts
import { taskEvents } from '@/events/taskEvents';
taskEvents.emit('task:updated', task);

// canvas.ts
import { taskEvents } from '@/events/taskEvents';
taskEvents.on('task:updated', (task) => {
  updateNode(task);
});
```

---

## Priority Fixes

Focus on these high-impact cycles first:

### 1. Store Cross-References
```
stores/tasks.ts ↔ stores/canvas.ts
stores/auth.ts ↔ services/auth/supabase.ts
```

### 2. Composable-Store Cycles
```
composables/useSupabaseDatabaseV2.ts ↔ stores/tasks.ts
composables/canvas/* ↔ stores/canvas.ts
```

### 3. Utility-Component Cycles
```
utils/errorHandler.ts ↔ composables/useErrorHandler.ts
```

---

## Implementation Steps

1. **Run analysis** to identify all 156 cycles
2. **Group by module** (stores, composables, utils)
3. **Fix highest-impact first** (stores often break many cycles)
4. **Re-run test after each fix** to track progress
5. **Target**: Reduce to <10 cycles (some may be acceptable)

---

## Verification

```bash
# After each batch of fixes:
npm test -- --run tests/safety/dependencies.test.ts

# Track progress:
# 156 → 100 → 50 → 20 → <10

# Full test suite:
npm test
```

---

## Acceptable Cycles

Some cycles may be acceptable if they're:
- Type-only imports (don't cause runtime issues)
- Within the same logical module
- Already handled by bundler (Vite can handle some cycles)

Consider updating the test to allow known-safe cycles:
```typescript
const ALLOWED_CYCLES = [
  'stores/tasks.ts → stores/canvas.ts',  // Intentional for reactivity
];

const actualCircularDeps = circularDeps.filter(
  cycle => !ALLOWED_CYCLES.includes(cycle)
);
expect(actualCircularDeps).toHaveLength(0);
```

---

## Success Criteria

- [ ] Circular dependency count reduced from 156 to <10
- [ ] No runtime import errors
- [ ] Application starts without issues
- [ ] All stores initialize correctly
- [ ] Hot module reload still works
