# SOP: Smart Group Instant Updates & Nested Property Inheritance (TASK-116)

**Date**: January 7, 2026
**Status**: Completed
**Tracking**: `docs/MASTER_PLAN.md` - TASK-116

---

## Quick Reference

**If smart group property updates aren't instant, check these items:**

| Check | File | What to Verify |
|-------|------|----------------|
| 1. Watcher hash includes property | `CanvasView.vue` | `dueDate` and `estimatedDuration` in hash string |
| 2. Batcher priority is 'high' | `CanvasView.vue` | `batchedSyncNodes('high')` not 'normal' |
| 3. All smart group cases handled | `taskOperations.ts` | Includes 'later' case |
| 4. Duration handler exists | `useCanvasDragDrop.ts` | Has `case 'duration':` in switch |
| 5. Nested groups use `applyAllNestedSectionProperties()` | `useCanvasDragDrop.ts` | Not the old single-section approach |

---

## Problem Summary

When dragging tasks to smart groups (Today, Tomorrow, High Priority, etc.):
- Task position updates but properties don't change visually
- Requires page refresh to see the dueDate/priority change
- Duration keywords don't apply estimatedDuration
- Nested groups (group inside group) don't apply properties from both

---

## Root Causes

### Issue 1: Watcher Missing Properties

**File**: `src/views/CanvasView.vue` (~line 1835)

**Before (BROKEN):**
```typescript
watch(
  () => taskStore.tasks.map(t => `${t.id}:${t.title}:${t.status}:${t.priority}`).join('|'),
  (val) => { if (val) batchedSyncNodes('normal') },
  { flush: 'post' }
)
```

**After (FIXED):**
```typescript
// TASK-116: Added dueDate and estimatedDuration to trigger sync when smart groups update properties
// Using 'high' priority for instant feedback when dropping tasks on smart groups
watch(
  () => taskStore.tasks.map(t => `${t.id}:${t.title}:${t.status}:${t.priority}:${t.dueDate || ''}:${t.estimatedDuration || 0}`).join('|'),
  (val) => { if (val) batchedSyncNodes('high') },
  { flush: 'post' }
)
```

**Why it works:** The hash-based watcher now detects dueDate and estimatedDuration changes, triggering canvas sync. 'high' priority bypasses the 16ms batching delay.

---

### Issue 2: Missing 'Later' Smart Group Case

**File**: `src/stores/tasks/taskOperations.ts` (~line 433)

**Before (BROKEN):**
```typescript
// No 'later' case - only handled today, tomorrow, this weekend, this week
```

**After (FIXED):**
```typescript
case 'later': {
    // "Later" clears the due date - task is postponed indefinitely
    dueDate = ''
    break
}
```

---

### Issue 3: No Nested Group Inheritance

When a group is inside another group (e.g., "High Priority" inside "Today"), dropping a task should apply properties from BOTH groups.

**File**: `src/composables/canvas/useCanvasDragDrop.ts`

**New Functions Added:**

#### 1. `getAllContainingSections()`
```typescript
const getAllContainingSections = (taskX: number, taskY: number, taskWidth: number = 220, taskHeight: number = 100) => {
    const taskCenterX = taskX + taskWidth / 2
    const taskCenterY = taskY + taskHeight / 2

    return canvasStore.sections.filter(section => {
        const { x, y, width, height } = section.position
        return (
            taskCenterX >= x &&
            taskCenterX <= x + width &&
            taskCenterY >= y &&
            taskCenterY <= y + height
        )
    }).sort((a, b) => {
        // Sort by area - LARGEST first (parent sections before child sections)
        const areaA = (a.position.width || 300) * (a.position.height || 200)
        const areaB = (b.position.width || 300) * (b.position.height || 200)
        return areaB - areaA
    })
}
```

#### 2. `getSectionProperties()`
```typescript
const getSectionProperties = (section: CanvasSection): Partial<Task> => {
    const updates: Partial<Task> = {}

    // 1. Check explicit assignOnDrop settings first
    if (section.assignOnDrop) {
        const settings = section.assignOnDrop
        if (settings.priority) updates.priority = settings.priority
        if (settings.status) updates.status = settings.status
        if (settings.projectId) updates.projectId = settings.projectId
        if (settings.dueDate) {
            const resolvedDate = resolveDueDate(settings.dueDate)
            if (resolvedDate !== null) updates.dueDate = resolvedDate
        }
        return updates
    }

    // 2. Auto-detect from section name using power keywords
    const keyword = detectPowerKeyword(section.name)
    if (keyword) {
        switch (keyword.category) {
            case 'date':
                const today = new Date()
                switch (keyword.value) {
                    case 'today': updates.dueDate = formatDateKey(today); break
                    case 'tomorrow':
                        const tom = new Date(today); tom.setDate(today.getDate() + 1)
                        updates.dueDate = formatDateKey(tom); break
                    // ... other date cases
                    case 'later': updates.dueDate = ''; break
                }
                break
            case 'priority': updates.priority = keyword.value as 'high' | 'medium' | 'low'; break
            case 'status': updates.status = keyword.value as Task['status']; break
            case 'duration':
                const durationMap: Record<string, number> = {
                    'quick': 15, 'short': 30, 'medium': 60, 'long': 120, 'unestimated': 0
                }
                updates.estimatedDuration = durationMap[keyword.value] ?? 0
                break
        }
        return updates
    }

    // 3. Legacy fallback for explicit type/propertyValue
    if (section.type === 'priority' && section.propertyValue) updates.priority = section.propertyValue
    // ... other legacy cases

    return updates
}
```

#### 3. `applyAllNestedSectionProperties()`
```typescript
const applyAllNestedSectionProperties = (taskId: string, taskX: number, taskY: number) => {
    const containingSections = getAllContainingSections(taskX, taskY)
    if (containingSections.length === 0) return

    const mergedUpdates: Partial<Task> = {}
    const appliedSections: string[] = []

    // Iterate from OUTER to INNER (largest to smallest)
    for (const section of containingSections) {
        const sectionProps = getSectionProperties(section)
        if (Object.keys(sectionProps).length > 0) {
            Object.assign(mergedUpdates, sectionProps)  // Inner overrides outer
            appliedSections.push(section.name)
        }
    }

    if (Object.keys(mergedUpdates).length > 0) {
        console.log(`🎯 [NESTED-GROUPS] Applying properties from ${appliedSections.length} sections:`, {
            sections: appliedSections,
            mergedUpdates
        })
        taskStore.updateTaskWithUndo(taskId, mergedUpdates)
    }
}
```

---

## Power Group Keywords Reference

| Category | Keywords | Property Set |
|----------|----------|--------------|
| **Date** | today, tomorrow, this weekend, this week, later | `dueDate` |
| **Priority** | high, medium, low | `priority` |
| **Status** | todo, active, done, paused | `status` |
| **Duration** | quick (15m), short (30m), medium (1h), long (2h), unestimated (0) | `estimatedDuration` |

---

## Data Flow Diagram

```
TASK DROP ON NESTED GROUPS
===========================

1. User drops task on inner group
         |
         v
2. handleNodeDragStop() fires
         |
         v
3. getContainingSection() finds innermost group
         |
         v
4. applyAllNestedSectionProperties() called with task position
         |
         v
5. getAllContainingSections() finds ALL groups containing task center
   Returns: [Parent (Today), Child (High Priority)] sorted by size
         |
         v
6. For each section (outer to inner):
   - getSectionProperties() extracts assignOnDrop OR keyword-detected props
   - Object.assign(mergedUpdates, sectionProps) - inner overrides outer
         |
         v
7. taskStore.updateTaskWithUndo(taskId, mergedUpdates)
   mergedUpdates = { dueDate: '2026-01-07', priority: 'high' }
         |
         v
8. Store watcher detects dueDate change in hash
         |
         v
9. batchedSyncNodes('high') triggers immediate canvas update
         |
         v
10. Task node visually updates with new dueDate badge + priority color
```

---

## Debugging Guide

### Console Logs to Watch

```
🎯 [NESTED-GROUPS] Applying properties from 2 sections:
  sections: ["Today", "High Priority"]
  mergedUpdates: { dueDate: "2026-01-07", priority: "high" }
```

### Quick Checks

1. **Property not updating?** - Check if keyword is detected: `detectPowerKeyword(groupName)`
2. **Not instant?** - Check watcher priority is 'high' not 'normal'
3. **Nested not working?** - Verify `applyAllNestedSectionProperties()` is being called, not old single-section function
4. **Console error?** - Check `formatDateKey` import exists in useCanvasDragDrop.ts

---

## Verification Checklist

- [x] Drop task on "Today" group → dueDate updates instantly
- [x] Drop task on "Tomorrow" group → dueDate updates instantly
- [x] Drop task on "High Priority" group → priority updates instantly
- [x] Drop task on "Later" group → dueDate clears
- [x] Drop task on "Quick" group → estimatedDuration = 15
- [x] Drop task on "High Priority" inside "Today" → BOTH priority AND dueDate update
- [x] Console shows `[NESTED-GROUPS]` log with merged properties
- [ ] User manual verification needed for nested groups

---

## Files Changed

| File | Change |
|------|--------|
| `src/views/CanvasView.vue` | Added `dueDate`, `estimatedDuration` to watcher hash; Changed priority to 'high' |
| `src/composables/canvas/useCanvasDragDrop.ts` | Added `getAllContainingSections()`, `getSectionProperties()`, `applyAllNestedSectionProperties()`; Added `case 'duration':` |
| `src/stores/tasks/taskOperations.ts` | Added `case 'later':` to `moveTaskToSmartGroup()` |

---

## Related SOPs

- **CANVAS-nested-groups-fix.md** - Nested group drag positioning (different issue)
- **TASKS-store-patterns.md** - Task store patterns

---

**Last Updated**: January 7, 2026
**Author**: Claude Code
