---
status: pending
priority: p2
issue_id: 024
tags: [code-review, code-quality, DRY]
dependencies: []
---

# Day-of-Week Logic Duplicated in Drag Drop

## Problem Statement

The `getSectionProperties()` and `applySectionPropertiesToTask()` functions in useCanvasDragDrop.ts contain identical day-of-week processing logic. This violates DRY and makes maintenance error-prone.

**Why it matters:** 50+ lines of duplicate code that must be kept in sync. Any bug fix needs to be applied twice.

## Findings

**Source:** Code Simplicity Reviewer, Pattern Recognition Specialist Agents

**Affected Files:**
- `src/composables/canvas/useCanvasDragDrop.ts` (lines 186-203, 309-336)

**Duplicate Code Block 1 (getSectionProperties, lines 186-203):**
```typescript
const dayOfWeekMap: Record<string, number> = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6
}
const lowerName = section.name.toLowerCase().trim()
if (dayOfWeekMap[lowerName] !== undefined) {
    const targetDay = dayOfWeekMap[lowerName]
    const today = new Date()
    const currentDay = today.getDay()
    let daysToAdd = targetDay - currentDay
    if (daysToAdd <= 0) daysToAdd += 7
    const targetDate = new Date(today)
    targetDate.setDate(today.getDate() + daysToAdd)
    return { dueDate: targetDate.toISOString().split('T')[0] }
}
```

**Duplicate Code Block 2 (applySectionPropertiesToTask, lines 309-336):**
```typescript
const dayOfWeekMap: Record<string, number> = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6
}
const lowerName = section.name.toLowerCase().trim()
if (dayOfWeekMap[lowerName] !== undefined) {
    // ... identical calculation logic
}
```

## Proposed Solutions

### Solution 1: Extract to Helper Function (Recommended)

Create a single helper function.

```typescript
// At module level or in utils
const DAY_OF_WEEK_MAP: Record<string, number> = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6
}

function calculateDayOfWeekDate(dayName: string): string | null {
    const lowerName = dayName.toLowerCase().trim()
    const targetDay = DAY_OF_WEEK_MAP[lowerName]

    if (targetDay === undefined) return null

    const today = new Date()
    const currentDay = today.getDay()
    let daysToAdd = targetDay - currentDay
    if (daysToAdd <= 0) daysToAdd += 7

    const targetDate = new Date(today)
    targetDate.setDate(today.getDate() + daysToAdd)
    return targetDate.toISOString().split('T')[0]
}

// Usage:
const dueDate = calculateDayOfWeekDate(section.name)
if (dueDate) {
    return { dueDate }
}
```

**Pros:** Single source of truth, testable, reusable
**Cons:** Need to update both call sites
**Effort:** Small (1 hour)
**Risk:** None

### Solution 2: Move to Shared Utils

Create a date utilities file.

```typescript
// src/utils/dateUtils.ts
export function getNextOccurrenceOfDay(dayName: string): Date | null { ... }
export function formatDateISO(date: Date): string { ... }
```

**Pros:** More organized, potentially reusable elsewhere
**Cons:** More files to maintain
**Effort:** Small-Medium
**Risk:** None

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- src/composables/canvas/useCanvasDragDrop.ts

**Lines to Remove:** ~25 lines of duplicate code

**New Code:** ~15 lines for helper function

**Net Change:** ~10 lines removed

## Acceptance Criteria

- [ ] Single helper function for day-of-week date calculation
- [ ] Both getSectionProperties and applySectionPropertiesToTask use helper
- [ ] Unit test for the helper function
- [ ] Behavior unchanged

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-09 | Finding identified | Code Simplicity review |

## Resources

- TASK-116: Smart group functionality
