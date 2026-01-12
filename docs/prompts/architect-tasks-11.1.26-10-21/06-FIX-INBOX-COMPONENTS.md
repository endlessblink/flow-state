# Fix: Inbox Component TypeScript Errors

**Priority**: P1-HIGH
**Time Estimate**: 30 minutes
**Dependencies**: None

---

## Problem

4 TypeScript errors in Inbox components related to priority types:

| File | Line | Error | Issue |
|------|------|-------|-------|
| `UnifiedInboxPanel.vue` | 27 | TS2322 | `string \| null` not assignable to priority type |
| `UnifiedInboxHeader.vue` | 60 | TS2322 | `string \| null` not assignable to priority type |
| `CalendarInboxHeader.vue` | 65 | TS2322 | `Set<string>` not assignable to `string \| number` |
| `CalendarInboxHeader.vue` | 66 | TS2769 | Wrong emit event name |

---

## Fixes

### Fix 1: `src/components/inbox/UnifiedInboxPanel.vue`

**Line 27** - Fix priority type:

```typescript
// Find the line with priority assignment
// CHANGE from:
const priority: string | null = ...

// TO (use proper union type):
type Priority = 'high' | 'medium' | 'low' | null;
const priority: Priority = ...

// OR cast when assigning:
const priority = someValue as 'high' | 'medium' | 'low' | null;
```

### Fix 2: `src/components/inbox/unified/UnifiedInboxHeader.vue`

**Line 60** - Same priority type fix:

```typescript
// CHANGE from:
priority: string | null

// TO:
priority: 'high' | 'medium' | 'low' | null

// If it's a prop, update the prop definition:
const props = defineProps<{
  priority: 'high' | 'medium' | 'low' | null;
}>();

// Or use withDefaults:
const props = withDefaults(defineProps<{
  priority?: 'high' | 'medium' | 'low' | null;
}>(), {
  priority: null
});
```

### Fix 3: `src/components/inbox/calendar/CalendarInboxHeader.vue`

**Line 65** - Fix Set vs primitive type:

```typescript
// LOOK FOR something like:
// someValue: Set<string> being assigned to a string | number prop

// CHANGE from:
:some-prop="selectedGroups"  // where selectedGroups is Set<string>

// TO (convert Set to array or string):
:some-prop="Array.from(selectedGroups).join(',')"

// OR update the prop to accept the correct type
```

**Line 66** - Fix emit event name:

```typescript
// CHANGE from:
emit('update:selectedCanvasGroups', value)

// TO (match the expected emit):
emit('update:selectedDuration', value)

// OR update the defineEmits to include the correct event:
const emit = defineEmits<{
  'update:selectedDuration': [value: number];
  'update:selectedCanvasGroups': [value: Set<string>];
}>();
```

---

## Type Definition (Shared)

Consider creating shared priority type in `src/types/task.ts`:

```typescript
export type Priority = 'high' | 'medium' | 'low';
export type PriorityOrNull = Priority | null;

// Use throughout:
import type { PriorityOrNull } from '@/types/task';
```

---

## Verification

```bash
# After fixes:
npx vue-tsc --noEmit 2>&1 | grep -i "inbox"

# Expected: No errors from Inbox components

# Manual test:
npm run dev
# Navigate to Inbox, test filtering by priority
```

---

## Success Criteria

- [ ] No TS2322 errors for priority types
- [ ] No TS2769 errors for emit mismatches
- [ ] Inbox filtering works correctly
- [ ] No console errors in Inbox views
