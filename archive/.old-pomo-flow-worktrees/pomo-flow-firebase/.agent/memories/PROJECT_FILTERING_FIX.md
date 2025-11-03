# Project Filtering Fix - Implementation Memory

**Date**: October 16, 2025
**Status**: ✅ COMPLETED AND WORKING
**Related Issue**: Work project filter showing 0 tasks despite count showing 2

---

## The Problem

When clicking on the "Work" project (a parent project):
- Sidebar showed: "Work - 2 tasks"
- Board showed: Empty (0 tasks)
- Expected: "لعبوד על סרטון ליים" task should be visible

**Root Cause**: Mismatch between counting logic (recursive) and filtering logic (non-recursive)

---

## The Solution

### Two Key Changes

#### 1. **Pinia Store - tasks.ts** (lines 659-708)

Added recursive helper function and updated filtering logic:

```typescript
// NEW: Recursive helper to find all child projects
const getChildProjectIds = (projectId: string): string[] => {
  const ids = [projectId]
  const childProjects = projects.value.filter(p => p.parentId === projectId)
  childProjects.forEach(child => {
    ids.push(...getChildProjectIds(child.id))
  })
  return ids
}

// UPDATED: Project filter now includes children
if (activeProjectId.value) {
  const projectIds = getChildProjectIds(activeProjectId.value)
  // OLD: filtered = filtered.filter(task => task.projectId === activeProjectId.value)
  // NEW: Include parent AND all descendants
  filtered = filtered.filter(task => projectIds.includes(task.projectId))
}
```

**Impact**: filteredTasks now correctly includes tasks from child projects

#### 2. **BoardView.vue** (lines 248-268)

Added recursive helper and updated project display logic:

```typescript
// NEW: Recursive helper to find project and children
const getProjectAndChildren = (projectId: string): string[] => {
  const ids = [projectId]
  const childProjects = taskStore.projects.filter(p => p.parentId === projectId)
  childProjects.forEach(child => {
    ids.push(...getProjectAndChildren(child.id))
  })
  return ids
}

// UPDATED: projectsWithTasks now shows parent + children
const projectsWithTasks = computed(() => {
  if (taskStore.activeProjectId) {
    const projectIds = getProjectAndChildren(taskStore.activeProjectId)
    // OLD: return taskStore.projects.filter(project => project.id === taskStore.activeProjectId)
    // NEW: Show parent AND all child projects
    return taskStore.projects.filter(project => projectIds.includes(project.id))
  }
  return taskStore.projects
})
```

**Impact**: Board now displays child project swimlanes when parent is selected

---

## End-to-End Flow

```
User clicks "Work" project
  ↓
setActiveProjectId("1760370186369")
  ↓
filteredTasks computed re-runs:
  - Calls getChildProjectIds("1760370186369")
  - Gets: ["1760370186369", "1759954389147", "1760370205513"]
  - Filters: taskId.projectId IN list
  - Result: Includes "لعبوד על סרטון ליים" (projectId: 1759954389147)
  ↓
projectsWithTasks computed re-runs:
  - Calls getProjectAndChildren("1760370186369")
  - Gets: ["1760370186369", "1759954389147", "1760370205513"]
  - Filters projects to display
  - Result: Shows Work, Work/Videos, Work/Research swimlanes
  ↓
User sees the Hebrew task in the appropriate child project column!
```

---

## Key Insights

### Insight 1: Recursion is Essential
- Counting used recursion (correct)
- Filtering didn't (broken)
- This caused 2/0 mismatch

### Insight 2: Two-Layer Recursion
System needs TWO separate recursive functions:
1. **getChildProjectIds()** - for task filtering
2. **getProjectAndChildren()** - for display

### Insight 3: Consistency is Critical
- Sidebar count: `getProjectTaskCount()` (recursive) ✅
- Filter: `getChildProjectIds()` (recursive) ✅
- Display: `getProjectAndChildren()` (recursive) ✅

---

## Testing Performed

✅ Created parent project "Work"
✅ Created child project "Work/Videos" under Work
✅ Added Hebrew task to Work/Videos
✅ Clicked Work project
✅ Verified task appears in board
✅ Verified recursive logic works correctly

---

## Files Modified

| File | Lines | Change |
|------|-------|--------|
| src/stores/tasks.ts | 660-667 | Added getChildProjectIds() |
| src/stores/tasks.ts | 675-483 | Updated project filter logic |
| src/views/BoardView.vue | 248-256 | Added getProjectAndChildren() |
| src/views/BoardView.vue | 260-263 | Updated projectsWithTasks logic |

---

## Sign-Off

✅ **Fix Status**: WORKING
✅ **Testing Status**: PASSED
✅ **Documentation Status**: COMPLETE
✅ **Ready for Production**: YES

**Date Completed**: October 16, 2025
**Expected Duration Before Issue Recurs**: N/A (properly fixed at root)
