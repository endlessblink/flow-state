# SOP-033: Data Persistence Patterns

**Created**: 2026-01-25
**Related Task**: TASK-1064 (was BUG-1051)
**Status**: Active

## Problem

Data changes (dates, priorities, filters) reset after page refresh. Root causes:
1. Fire-and-forget async calls (missing `await`)
2. Unmapped Supabase fields
3. Unpersisted UI state (in-memory refs)
4. Silent error swallowing (catch without re-throw)

## Patterns to Follow

### 1. Always Await Store Operations

**WRONG:**
```typescript
function handleUpdate() {
  taskStore.updateTask(taskId, { dueDate: newDate })  // Fire-and-forget!
  showSuccess()
}
```

**CORRECT:**
```typescript
async function handleUpdate() {
  await taskStore.updateTask(taskId, { dueDate: newDate })
  showSuccess()
}
```

**Rule:** Any function calling `taskStore.updateTask()`, `timerStore.startTimer()`, or similar async store methods MUST:
1. Be declared `async`
2. Use `await` before the call

### 2. Supabase Field Mapping Checklist

When adding a new field to the Task type, update **3 locations**:

| Location | File | What to Add |
|----------|------|-------------|
| 1. Interface | `src/utils/supabaseMappers.ts` | Add to `SupabaseTask` interface |
| 2. To Supabase | `src/utils/supabaseMappers.ts` | Add to `toSupabaseTask()` function |
| 3. From Supabase | `src/utils/supabaseMappers.ts` | Add to `fromSupabaseTask()` function |

**Example:**
```typescript
// 1. Interface
interface SupabaseTask {
  scheduled_date?: string | null  // ADD
}

// 2. toSupabaseTask()
return {
  scheduled_date: task.scheduledDate || null,  // ADD
}

// 3. fromSupabaseTask()
return {
  scheduledDate: record.scheduled_date || undefined,  // ADD
}
```

### 3. UI State Persistence with useStorage

For state that should survive page refresh (filters, view modes, preferences):

**WRONG:**
```typescript
const viewMode = ref<string>('day')  // Resets on refresh!
```

**CORRECT:**
```typescript
import { useStorage } from '@vueuse/core'
const viewMode = useStorage<string>('calendar-view-mode', 'day')
```

**Naming Convention:** `{feature}-{state-name}` (e.g., `calendar-view-mode`, `board-show-filters`)

### 4. Error Handling - Always Re-throw

**WRONG:**
```typescript
} catch (e) {
  handleError(e, 'saveProject')
  return null  // Caller thinks save succeeded!
}
```

**CORRECT:**
```typescript
} catch (e) {
  handleError(e, 'saveProject')
  throw e  // Caller knows save failed
}
```

## Key Files

| File | Purpose |
|------|---------|
| `src/utils/supabaseMappers.ts` | Type conversion between app and Supabase |
| `src/composables/useSupabaseDatabase.ts` | Database operations |
| `src/stores/tasks.ts` | Task store with async operations |

## Verification

Before claiming a persistence feature is done:

1. **Refresh test:** Make change → F5 → Verify change persisted
2. **Network tab:** Confirm Supabase request completed (not pending)
3. **localStorage check:** For UI state, verify key exists in DevTools → Application → Local Storage

## ESLint Prevention

Add to `.eslintrc.js` to catch fire-and-forget:
```javascript
{
  '@typescript-eslint/no-floating-promises': 'error'
}
```

## Related

- TASK-1064: Original comprehensive fix
- BUG-1046: Related overnight reset issue
- TASK-1010: Quick Sort infrastructure
