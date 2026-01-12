# Fix: Calendar Component TypeScript Errors

**Priority**: P1-HIGH
**Time Estimate**: 30 minutes
**Dependencies**: None

---

## Problem

8 TypeScript errors from duplicate identifiers in Calendar components:

| File | Lines | Error | Identifier |
|------|-------|-------|------------|
| `CalendarWeekView.vue` | 25, 28 | TS2300 | `weekEvents` |
| `CalendarWeekView.vue` | 26, 29 | TS2300 | `currentTaskId` |
| `CalendarMonthView.vue` | 22, 25 | TS2300 | `monthDays` |
| `CalendarMonthView.vue` | 23, 26 | TS2300 | `currentTaskId` |
| `CalendarDayView.vue` | 37, 44 | TS2300 | `resizePreview` |

---

## Fixes

### Fix 1: `src/components/calendar/CalendarWeekView.vue`

**Find duplicate declarations** around lines 25-29:

```typescript
// LOOK FOR duplicates like:
const weekEvents = computed(() => ...);
const currentTaskId = ref<string | null>(null);
// ... later in the file ...
const weekEvents = computed(() => ...);  // DUPLICATE - REMOVE
const currentTaskId = ref<string | null>(null);  // DUPLICATE - REMOVE
```

**Action**: Remove the duplicate declarations, keeping only one of each.

### Fix 2: `src/components/calendar/CalendarMonthView.vue`

**Find duplicate declarations** around lines 22-26:

```typescript
// LOOK FOR duplicates like:
const monthDays = computed(() => ...);
const currentTaskId = ref<string | null>(null);
// ... later in the file ...
const monthDays = computed(() => ...);  // DUPLICATE - REMOVE
const currentTaskId = ref<string | null>(null);  // DUPLICATE - REMOVE
```

**Action**: Remove the duplicate declarations.

### Fix 3: `src/components/calendar/CalendarDayView.vue`

**Find duplicate declarations** around lines 37, 44:

```typescript
// LOOK FOR duplicates like:
const resizePreview = ref<ResizePreview | null>(null);
// ... later in the file ...
const resizePreview = ref<ResizePreview | null>(null);  // DUPLICATE - REMOVE
```

**Action**: Remove the duplicate declaration.

---

## Investigation Steps

```bash
# Find all variable declarations in each file:
grep -n "const weekEvents\|const currentTaskId" src/components/calendar/CalendarWeekView.vue
grep -n "const monthDays\|const currentTaskId" src/components/calendar/CalendarMonthView.vue
grep -n "const resizePreview" src/components/calendar/CalendarDayView.vue
```

---

## Common Causes

1. **Copy-paste errors** during refactoring
2. **Merge conflicts** that added duplicate code
3. **Multiple script sections** (check for multiple `<script>` tags)

---

## Verification

```bash
# After fixes:
npx vue-tsc --noEmit 2>&1 | grep "Calendar"

# Expected: No errors from Calendar components

# Manual test:
npm run dev
# Navigate to Calendar view, verify no errors
```

---

## Success Criteria

- [ ] No TS2300 (duplicate identifier) errors
- [ ] Each variable declared only once per component
- [ ] Calendar views render correctly
- [ ] No console errors on Calendar pages
