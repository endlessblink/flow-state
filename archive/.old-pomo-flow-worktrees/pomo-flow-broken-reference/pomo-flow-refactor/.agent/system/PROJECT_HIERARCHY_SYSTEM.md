# Project Hierarchy and Filtering System Architecture

## Core Architecture

The Pomo-Flow project system uses a hierarchical structure where projects can have parent-child relationships.

### Key Data Structures

```typescript
interface Project {
  id: string                    // Unique identifier
  name: string                  // Project name (e.g., "Work")
  parentId?: string | null      // ID of parent project (hierarchy)
  color?: string                // Project color
  // Additional properties...
}

interface Task {
  id: string                    // Unique identifier
  title: string                 // Task title
  status: 'planned' | 'in_progress' | 'done'
  projectId: string             // CRITICAL: Must match a project ID
  priority?: 'high' | 'medium' | 'low'
  parentTaskId?: string         // Parent task ID (for nesting)
  // Additional properties...
}
```

### Project Hierarchy Example

```
My Tasks (ID: 1)
├─ Work (ID: 1760370186369, parentId: 1)
│  ├─ Work/Videos (ID: 1759954389147, parentId: 1760370186369)
│  │  └─ Tasks: لعبوד על סרטון ליים
│  └─ Work/Research (ID: 1760370205513, parentId: 1760370186369)
└─ Personal (ID: personal)
```

---

## Filtering Flow

### 1. getChildProjectIds() - Recursive Collection

**Location**: `src/stores/tasks.ts:660-667`

```typescript
const getChildProjectIds = (projectId: string): string[] => {
  const ids = [projectId]  // Start with the project itself
  const childProjects = projects.value.filter(p => p.parentId === projectId)
  childProjects.forEach(child => {
    ids.push(...getChildProjectIds(child.id))  // Recursive!
  })
  return ids
}
```

**Example**:
- Input: "1760370186369" (Work project)
- Output: ["1760370186369", "1759954389147", "1760370205513"]

### 2. filteredTasks - Core Filtering

**Location**: `src/stores/tasks.ts:659-708`

Uses `getChildProjectIds()` to include parent AND all descendants:

```typescript
if (activeProjectId.value) {
  const projectIds = getChildProjectIds(activeProjectId.value)
  filtered = filtered.filter(task => projectIds.includes(task.projectId))
}
```

### 3. projectsWithTasks - Display Logic

**Location**: `src/views/BoardView.vue:248-268`

Also uses recursion to show all relevant project swimlanes:

```typescript
const getProjectAndChildren = (projectId: string): string[] => {
  const ids = [projectId]
  const childProjects = taskStore.projects.filter(p => p.parentId === projectId)
  childProjects.forEach(child => {
    ids.push(...getProjectAndChildren(child.id))
  })
  return ids
}
```

---

## Data Flow Example

**Scenario**: User clicks "Work" project

1. **User Action** → `ProjectTreeItem.vue` detects click
2. **State Update** → `taskStore.setActiveProjectId("1760370186369")`
3. **Filtering** → `filteredTasks` computed re-evaluates:
   - Calls `getChildProjectIds("1760370186369")`
   - Gets: `["1760370186369", "1759954389147", "1760370205513"]`
   - Returns tasks with projectId in this list
4. **Display** → `projectsWithTasks` computed re-evaluates:
   - Calls `getProjectAndChildren("1760370186369")`
   - Gets: `["1760370186369", "1759954389147", "1760370205513"]`
   - Displays these as swimlanes
5. **Rendering** → User sees all tasks grouped by child project

---

## Critical Implementation Details

### Recursive vs Non-Recursive

**BROKEN** (Non-Recursive):
```typescript
// Only includes tasks from Work, NOT from child projects
filtered = tasks.filter(t => t.projectId === activeProjectId)
```

**FIXED** (Recursive):
```typescript
// Includes tasks from Work AND all child projects
const childIds = getChildProjectIds(activeProjectId)
filtered = tasks.filter(t => childIds.includes(t.projectId))
```

### Type Safety

**Critical**: Ensure projectId types are consistent

```
Task.projectId: "1759954389147" (string)
Project.id: "1759954389147" (string) ✓ MATCH

Task.projectId: 1759954389147 (number)
Project.id: "1759954389147" (string) ✗ NO MATCH
```

---

## Files Modified

| File | Lines | Change |
|------|-------|--------|
| src/stores/tasks.ts | 660-667 | Added getChildProjectIds() |
| src/stores/tasks.ts | 675-483 | Updated project filter logic |
| src/views/BoardView.vue | 248-256 | Added getProjectAndChildren() |
| src/views/BoardView.vue | 260-263 | Updated projectsWithTasks logic |

---

## Performance Considerations

- **Time Complexity**: O(n) where n = number of projects
- **For 100 projects**: ~100 iterations
- **For 1,000 projects**: ~1,000 iterations
- **Acceptable**: Yes, for typical use cases
