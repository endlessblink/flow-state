# Fix: Task Component TypeScript Errors

**Priority**: P1-HIGH
**Time Estimate**: 45 minutes
**Dependencies**: None

---

## Problem

7 TypeScript errors in Task-related components:

| File | Line | Error | Issue |
|------|------|-------|-------|
| `TaskNode.vue` | 42 | TS2322 | `string \| boolean \| undefined` → `boolean` |
| `TaskNode.vue` | 56 | TS2322 | `boolean \| undefined` → `boolean` |
| `DoneToggle.vue` | 3 | TS2345 | Missing `ariaLabel` prop |
| `DragHandle.vue` | 19 | TS2322 | Direction type mismatch |
| `HierarchicalTaskRow.vue` | 82, 83 | TS2322/TS2345 | Priority null vs undefined |
| `HierarchicalTaskRow.vue` | 193 | TS2345 | Missing `hasSubtasks`, `isExpanded` |
| `TaskEditModal.vue` | 121 | TS2345 | ComputedRef vs Ref |
| `TaskEditMetadata.vue` | 62 | TS2322 | `null` not assignable |

---

## Fixes

### Fix 1: `src/components/canvas/TaskNode.vue`

**Lines 42, 56** - Add default values for optional booleans:

```typescript
// Line 42 - CHANGE:
:some-prop="someValue"  // where someValue can be undefined

// TO:
:some-prop="someValue ?? false"

// Or in the prop definition:
const props = withDefaults(defineProps<{
  someProp?: boolean;
}>(), {
  someProp: false
});
```

### Fix 2: `src/components/tasks/DoneToggle.vue`

**Line 3** - Add missing `ariaLabel` prop:

```typescript
// Find where DoneToggle is used and add ariaLabel:
<DoneToggle
  :is-completed="task.completed"
  aria-label="Toggle task completion"  // ADD THIS
/>

// OR make ariaLabel optional in DoneToggle.vue:
const props = withDefaults(defineProps<{
  ariaLabel?: string;
  // ... other props
}>(), {
  ariaLabel: 'Toggle completion'
});
```

### Fix 3: `src/components/tasks/DragHandle.vue`

**Line 19** - Fix direction type:

```typescript
// CHANGE from:
(direction: string) => void

// TO (match the expected union):
(direction: 'up' | 'down' | 'left' | 'right') => void

// In the emit or callback definition:
const emit = defineEmits<{
  move: [direction: 'up' | 'down' | 'left' | 'right'];
}>();
```

### Fix 4: `src/components/tasks/HierarchicalTaskRow.vue`

**Lines 82-83** - Fix priority null handling:

```typescript
// CHANGE from:
:priority="task.priority"  // where priority can be null

// TO:
:priority="task.priority ?? undefined"

// OR update the child component to accept null
```

**Line 193** - Add missing props:

```typescript
// Find where the component is used and add missing props:
<SomeComponent
  :task="task"
  :indent-level="indentLevel"
  :has-subtasks="hasSubtasks"    // ADD
  :is-expanded="isExpanded"      // ADD
/>

// Compute these values:
const hasSubtasks = computed(() => task.subtasks?.length > 0);
const isExpanded = computed(() => expandedTasks.has(task.id));
```

### Fix 5: `src/components/tasks/TaskEditModal.vue`

**Line 121** - Fix ref type:

```typescript
// CHANGE from:
const inputRef = computed(() => ...);  // ComputedRef

// TO (if you need a Ref, use ref instead):
const inputRef = ref<HTMLInputElement | undefined>();

// OR if computed is intentional, update the function signature:
function someFunction(el: ComputedRef<HTMLInputElement | null | undefined> | Ref<...>) {
```

### Fix 6: `src/components/tasks/edit/TaskEditMetadata.vue`

**Line 62** - Fix null assignment:

```typescript
// CHANGE from:
someValue: string | null = null

// TO (if the target expects string | number):
someValue: string | number = ''

// OR handle null explicitly:
:some-prop="value ?? ''"
```

---

## Verification

```bash
# After fixes:
npx vue-tsc --noEmit 2>&1 | grep -E "Task|Done|Drag|Hierarchical"

# Expected: No errors from task components

# Manual test:
npm run dev
# Test task creation, editing, drag-drop
```

---

## Success Criteria

- [ ] No TS2322 type assignment errors
- [ ] No TS2345 argument type errors
- [ ] All required props provided
- [ ] Task CRUD operations work
- [ ] Drag handle keyboard navigation works
