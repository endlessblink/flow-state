# Project Filtering Logic - Standard Operating Procedure

## Overview
This document describes the end-to-end project filtering system, specifically how nested projects are filtered and displayed across all views.

## Problem Statement (Original Issue)
When clicking on the "Work" project (a parent project), no tasks appeared even though:
- The task count showed "2 tasks"
- The Work project had child projects containing tasks
- The same project tree showed child projects in other contexts

**Root Cause**: Mismatch between counting logic (recursive, includes children) and filtering logic (direct comparison, children excluded)

---

## Solution Architecture

### Three-Layer Filtering System

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Task Filtering (Pinia Store - tasks.ts)        │
│  - Determines which tasks to include based on filters    │
│  - Uses recursive child project detection               │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Project Selection (BoardView.vue)              │
│  - Decides which project swimlanes to display            │
│  - Shows parent project + ALL child projects             │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 3: UI Rendering                                   │
│  - Displays tasks grouped by project                     │
│  - User sees all child projects' tasks                   │
└─────────────────────────────────────────────────────────┘
```

---

## Layer 1: Task Filtering (src/stores/tasks.ts)

### The `filteredTasks` Computed Property

**Location**: `tasks.ts:659-708`

**Key Helper Function**: `getChildProjectIds(projectId: string)`

```typescript
const getChildProjectIds = (projectId: string): string[] => {
  const ids = [projectId]  // Include the parent
  const childProjects = projects.value.filter(p => p.parentId === projectId)
  childProjects.forEach(child => {
    ids.push(...getChildProjectIds(child.id))  // Recursive: include all descendants
  })
  return ids
}
```

**How It Works**:
1. When `activeProjectId` is set (user clicks a project), get its ID
2. Call `getChildProjectIds()` to get parent + ALL descendants recursively
3. Filter tasks where `task.projectId` is IN this list (not just === parent)
4. Return only tasks that match the expanded project list

**Example**:
```
Work (ID: 1760370186369)
  ├─ Work/Videos (ID: 1759954389147)
  └─ Work/Research (ID: 1760370205513)

If user clicks "Work":
  getChildProjectIds("1760370186369") returns:
  ["1760370186369", "1759954389147", "1760370205513"]

  Then filters tasks where projectId matches ANY of these
```

---

## Layer 2: Project Selection (src/views/BoardView.vue)

### The `projectsWithTasks` Computed Property

**Location**: `BoardView.vue:248-268`

**Key Helper Function**: `getProjectAndChildren(projectId: string)`

```typescript
const getProjectAndChildren = (projectId: string): string[] => {
  const ids = [projectId]
  const childProjects = taskStore.projects.filter(p => p.parentId === projectId)
  childProjects.forEach(child => {
    ids.push(...getProjectAndChildren(child.id))  // Recursive!
  })
  return ids
}
```

---

## Debugging Checklist

If filtering isn't working, check these in order:

### 1. **Verify Project Hierarchy**
```javascript
// In browser console
const taskStore = window.__store_tasks
console.log('All projects:', taskStore.projects)
```

### 2. **Check Recursive Function**
```javascript
const childIds = getChildProjectIds("1760370186369")
console.log('Child IDs:', childIds)
```

### 3. **Check Task ProjectIds**
```javascript
const hebrewTask = taskStore.tasks.find(t => t.title.includes("לעבוד"))
console.log('Hebrew task projectId:', hebrewTask.projectId)
console.log('Is in child list:', childIds.includes(hebrewTask.projectId))
```

---

## Common Issues and Solutions

### Issue 1: Task shows in console logs but not in UI
**Cause**: BoardView not displaying child project swimlanes
**Solution**: Check `projectsWithTasks` is using recursive function

### Issue 2: Count shows "2" but filtering shows "1"
**Cause**: Count uses one filter logic, filtering uses another
**Solution**: Ensure both use the same `getChildProjectIds` recursive function

### Issue 3: Nested child projects not showing
**Cause**: Recursive function only goes one level deep
**Solution**: Verify the `forEach` loop calls `getChildProjectIds` recursively
