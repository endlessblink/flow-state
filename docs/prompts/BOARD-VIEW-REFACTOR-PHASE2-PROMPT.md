# Board View Refactor - Phase 2 (Remaining Work)

**Task ID**: TASK-191 (continuation)
**Priority**: P1
**Estimated Effort**: 8-12 hours
**Prerequisite**: Phase 1 composable extraction is COMPLETE

---

## What Was Completed (Phase 1) ✅

### Composables Created
All 5 composables extracted with proper dependency injection:
- `src/composables/board/useBoardState.ts` (90 LOC)
- `src/composables/board/useBoardActions.ts` (74 LOC)
- `src/composables/board/useBoardDensity.ts` (~85 LOC)
- `src/composables/board/useBoardModals.ts` (~50 LOC)
- `src/composables/board/useBoardContextMenu.ts` (~25 LOC)

### Improvements Made
- ✅ Deep watchers removed from BoardView.vue (was 2, now 0)
- ✅ Console.log reduced from 60+ to 8
- ✅ Logic extracted to composables with centralized error handling
- ✅ Build passes with no regressions

---

## What Still Needs To Be Done (Phase 2) ⚠️

### Current State

| File | Current LOC | Target LOC | Gap |
|------|-------------|------------|-----|
| BoardView.vue | 579 | <250 | -329 LOC |
| KanbanSwimlane.vue | 651 | ~300 | -351 LOC |
| KanbanColumn.vue | 389 | ~200 | -189 LOC |
| TaskCard.vue | 639 | ~200 | -439 LOC |

**Total Gap**: ~1,308 LOC to remove/extract

---

## Task 1: Extract BoardView.vue CSS (2-3 hours)

**Problem**: BoardView.vue has 323 lines of CSS (56% of file)

**Current structure** (lines 257-579):
```
.board-view-wrapper
.kanban-header, .kanban-header--minimal
.header-left, .board-title, .task-count
.header-controls
.density-selector, .density-btn
.hide-done-toggle
.done-column-toggle
.today-filter
.status-filters, .status-btn
.kanban-scroll-container
.kanban-board
```

**Solution Options**:

**Option A (Recommended)**: Extract to separate SCSS file
```
src/
├── views/
│   ├── BoardView.vue          # ~250 LOC (template + script only)
│   └── BoardView.scss         # 323 LOC CSS
```

In BoardView.vue:
```vue
<style scoped lang="scss">
@import './BoardView.scss';
</style>
```

**Option B**: Convert to Tailwind utility classes
- Replace custom CSS with Tailwind equivalents
- More work but better consistency with design system

**Acceptance Criteria**:
- [ ] BoardView.vue under 280 LOC total
- [ ] All styles still work correctly
- [ ] Build passes

---

## Task 2: Refactor KanbanSwimlane.vue (3-4 hours)

**Current**: 651 LOC
**Target**: ~300 LOC
**Location**: `src/components/kanban/KanbanSwimlane.vue`

**Problems to Fix**:

1. **Remove localTasks copying** - Use props directly
   ```typescript
   // REMOVE this pattern:
   const localTasks = ref<Task[]>([])
   watch(() => props.tasks, (newTasks) => {
     localTasks.value = [...newTasks]
   }, { immediate: true, deep: true })

   // REPLACE with:
   // Just use props.tasks directly in template and computed
   ```

2. **Simplify tasksByStatus computed**
   ```typescript
   const tasksByStatus = computed(() => {
     const result: Record<TaskStatus, Task[]> = {
       planned: [], in_progress: [], done: []
     }
     for (const task of props.tasks) {
       if (result[task.status]) {
         result[task.status].push(task)
       }
     }
     return result
   })
   ```

3. **Extract CSS** - Same pattern as BoardView

**Acceptance Criteria**:
- [ ] No local task state copying
- [ ] Under 350 LOC
- [ ] Drag-drop still works between columns

---

## Task 3: Refactor KanbanColumn.vue (2-3 hours)

**Current**: 389 LOC
**Target**: ~200 LOC
**Location**: `src/components/kanban/KanbanColumn.vue`

**Problems to Fix**:

1. **Remove duplicate local state**
   - Same pattern as Swimlane - use props directly

2. **Simplify VueDraggable integration**
   ```vue
   <draggable
     :model-value="tasks"
     :group="{ name: 'tasks', pull: true, put: true }"
     item-key="id"
     @update:model-value="handleReorder"
     @change="handleDragChange"
   >
   ```

3. **Extract CSS to separate file or Tailwind**

**Acceptance Criteria**:
- [ ] Under 220 LOC
- [ ] Drag-drop works correctly
- [ ] Task ordering persists

---

## Task 4: Refactor TaskCard.vue + Extract Badges (3-4 hours)

**Current**: 639 LOC (61% is CSS with 7 inline badge types)
**Target**: ~200 LOC + new TaskCardBadges.vue
**Location**: `src/components/kanban/TaskCard.vue`

**Step 1**: Create TaskCardBadges.vue
```vue
<!-- src/components/kanban/TaskCardBadges.vue -->
<script setup lang="ts">
import type { Priority } from '@/types/tasks'

defineProps<{
  priority?: Priority
  dueDate?: Date | string | null
  projectColor?: string
  estimatedPomodoros?: number
  completedPomodoros?: number
  hasSubtasks?: boolean
  subtaskProgress?: { done: number; total: number }
  isRecurring?: boolean
}>()
</script>

<template>
  <div class="task-badges">
    <!-- Priority badge -->
    <span v-if="priority && priority !== 'none'"
          class="badge badge--priority"
          :class="`badge--${priority}`">
      {{ priority }}
    </span>

    <!-- Due date badge -->
    <span v-if="dueDate" class="badge badge--due">
      {{ formatDueDate(dueDate) }}
    </span>

    <!-- Pomodoro progress -->
    <span v-if="estimatedPomodoros" class="badge badge--pomodoro">
      {{ completedPomodoros || 0 }}/{{ estimatedPomodoros }} 🍅
    </span>

    <!-- Subtask progress -->
    <span v-if="hasSubtasks && subtaskProgress" class="badge badge--subtasks">
      {{ subtaskProgress.done }}/{{ subtaskProgress.total }}
    </span>

    <!-- Recurring indicator -->
    <span v-if="isRecurring" class="badge badge--recurring">🔄</span>
  </div>
</template>
```

**Step 2**: Update TaskCard.vue to use new component
```vue
<TaskCardBadges
  :priority="task.priority"
  :due-date="task.dueDate"
  :estimated-pomodoros="task.estimatedPomodoros"
  :completed-pomodoros="task.completedPomodoros"
  :has-subtasks="hasSubtasks"
  :subtask-progress="subtaskProgress"
  :is-recurring="task.recurrence?.enabled"
/>
```

**Step 3**: Extract remaining CSS

**Acceptance Criteria**:
- [ ] TaskCardBadges.vue created (~80 LOC)
- [ ] TaskCard.vue under 250 LOC
- [ ] All badge types render correctly
- [ ] Hover states work

---

## Task 5: Remove Remaining Console Statements (30 min)

**Current locations** (8 total):

1. `src/views/BoardView.vue:252`
   ```typescript
   console.error('🔧 BoardView: Error toggling Today filter:', error)
   ```
   → Remove or replace with proper error handling

2. `src/components/kanban/KanbanSwimlane.vue` (1 occurrence)
   → Find and remove

3. `src/components/kanban/KanbanColumn.vue` (1 occurrence)
   → Find and remove

4. `src/composables/board/useBoardDensity.ts` (3 occurrences)
   → Replace with silent error handling or remove

5. `src/composables/board/useBoardState.ts:78`
   ```typescript
   console.error('useBoardState.totalDisplayedTasks: Error calculating task count:', error)
   ```
   → Remove, return fallback silently

6. `src/composables/board/useBoardActions.ts:19`
   ```typescript
   console.error(errorMessage, error)
   ```
   → Keep only if truly needed for debugging, or emit to error boundary

**Acceptance Criteria**:
- [ ] 0 console.log/error/warn statements in board system
- [ ] Errors handled gracefully without console output

---

## Verification Checklist

After completing all tasks:

### Automated
```bash
# Build passes
npm run build

# Lint passes
npm run lint

# Check LOC targets
wc -l src/views/BoardView.vue src/components/kanban/*.vue
# Expected: ~950 total (down from 2,258)
```

### Manual Testing
- [ ] Board View loads correctly
- [ ] Tasks display in correct swimlanes by project
- [ ] Drag task between columns (todo → in_progress → done)
- [ ] Drag task between swimlanes (projects)
- [ ] Right-click context menu works
- [ ] Edit modal opens and saves
- [ ] Delete with confirmation works
- [ ] Density toggle works (if applicable)
- [ ] Done column show/hide works
- [ ] Filter controls work
- [ ] Refresh page - verify state persists

---

## Success Metrics

| Metric | Before Phase 2 | After Phase 2 |
|--------|----------------|---------------|
| BoardView.vue | 579 LOC | <250 LOC |
| KanbanSwimlane.vue | 651 LOC | <350 LOC |
| KanbanColumn.vue | 389 LOC | <220 LOC |
| TaskCard.vue | 639 LOC | <250 LOC |
| Console statements | 8 | 0 |
| **Total Board LOC** | **2,258** | **<1,100** |
| **Health Score** | ~6/10 | 7.5+/10 |

---

## Files to Create

- `src/views/BoardView.scss` (or use Tailwind)
- `src/components/kanban/TaskCardBadges.vue`

## Files to Modify

- `src/views/BoardView.vue`
- `src/components/kanban/KanbanSwimlane.vue`
- `src/components/kanban/KanbanColumn.vue`
- `src/components/kanban/TaskCard.vue`
- `src/composables/board/useBoardDensity.ts`
- `src/composables/board/useBoardState.ts`
- `src/composables/board/useBoardActions.ts`

---

## Order of Operations

1. **Task 5 first** - Remove console statements (quick win)
2. **Task 1** - Extract BoardView CSS
3. **Task 4** - Create TaskCardBadges + refactor TaskCard
4. **Task 2** - Refactor KanbanSwimlane
5. **Task 3** - Refactor KanbanColumn
6. **Verify** - Run full checklist

Commit after each task for easy rollback.

---

## Reference

- Original refactor prompt: `docs/prompts/BOARD-VIEW-REFACTOR-PROMPT.md`
- Canvas patterns to follow: `src/composables/canvas/`
- Tech debt audit: `plans/system-tech-debt-audit-2026-01-10.md`
