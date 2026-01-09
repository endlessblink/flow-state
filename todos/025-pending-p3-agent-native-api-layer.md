---
status: pending
priority: p3
issue_id: 025
tags: [code-review, architecture, agent-native]
dependencies: []
---

# No Agent API Layer for Programmatic Access

## Problem Statement

The application has no formal agent/tool API layer. All features rely on UI interactions with underlying store methods. While Pinia stores expose CRUD operations, there's no explicit agent API, system prompt documentation, or tool definitions.

**Why it matters:** Agents cannot programmatically discover or interact with the app without injecting into Vue's runtime context.

## Findings

**Source:** Agent-Native Reviewer Agent

**Current State:**
- 9/12 UI actions have store-level equivalents
- 0/12 actions are exposed via formal agent API
- 3/12 actions (zoom controls) require Vue context and cannot be triggered externally

**UI Actions with Store Equivalents:**
| UI Action | Store Method | Agent Accessible |
|-----------|--------------|------------------|
| Add Task | `taskStore.createTask()` | Via store only |
| Create Group | `canvasStore.createGroup()` | Via store only |
| Delete Task | `taskStore.deleteTask()` | Via store only |
| Toggle Filters | Direct ref assignment | Via store only |
| Bulk Delete | `taskStore.bulkDeleteTasks()` | Via store only |

**UI Actions WITHOUT Store Equivalents:**
| UI Action | Current Implementation | Issue |
|-----------|----------------------|-------|
| Zoom In | `useVueFlow().zoomIn()` | Requires Vue context |
| Zoom Out | `useVueFlow().zoomOut()` | Requires Vue context |
| Fit View | `useVueFlow().fitView()` | Requires Vue context |

## Proposed Solutions

### Solution 1: Create Agent API Layer (Recommended)

Expose store actions via global object.

```typescript
// src/api/agentApi.ts
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'

export const createAgentApi = () => {
  const taskStore = useTaskStore()
  const canvasStore = useCanvasStore()

  return {
    // Task primitives
    createTask: (data) => taskStore.createTask(data),
    updateTask: (id, data) => taskStore.updateTask(id, data),
    deleteTask: (id) => taskStore.deleteTask(id),
    getTasks: () => taskStore.tasks,

    // Group primitives
    createGroup: (data) => canvasStore.createGroup(data),
    updateGroup: (id, data) => canvasStore.updateGroup(id, data),
    deleteGroup: (id) => canvasStore.deleteGroup(id),
    getGroups: () => canvasStore.groups,

    // Filter primitives
    setHideOverdueTasks: (hide) => { taskStore.hideCanvasOverdueTasks = hide },
    setHideCompletedTasks: (hide) => { taskStore.toggleCanvasDoneTasks() },

    // State queries
    getSelectedItems: () => canvasStore.selectedNodeIds,
    getViewport: () => canvasStore.viewport,
  }
}

// Initialize and expose globally
export function initAgentApi() {
  if (typeof window !== 'undefined') {
    window.__pomoflowAgent = createAgentApi()
  }
}
```

**Pros:** Clean API, discoverable, typed
**Cons:** Additional maintenance surface
**Effort:** Medium (3-4 hours)
**Risk:** Low

### Solution 2: Add Viewport Control to Canvas Store

Store VueFlow instance ref and expose methods.

```typescript
// In canvas.ts
const vueFlowInstance = ref<VueFlowInstance | null>(null)

const setVueFlowInstance = (instance: VueFlowInstance) => {
  vueFlowInstance.value = instance
}

const zoomIn = () => vueFlowInstance.value?.zoomIn({ duration: 300 })
const zoomOut = () => vueFlowInstance.value?.zoomOut({ duration: 300 })
const fitView = () => vueFlowInstance.value?.fitView({ padding: 0.2, duration: 400 })

return {
  setVueFlowInstance,
  zoomIn,
  zoomOut,
  fitView,
  // ...
}
```

**Pros:** Viewport accessible without Vue context
**Cons:** Need to wire up instance on mount
**Effort:** Small (1 hour)
**Risk:** Low

### Solution 3: Document Agent-Accessible Methods

Add JSDoc annotations for agent discovery.

```typescript
/**
 * @agent-accessible
 * @description Create a new task with the given properties
 */
const createTask = (data: Partial<Task>) => { ... }
```

**Pros:** Self-documenting, no runtime changes
**Cons:** No actual API, just documentation
**Effort:** Small
**Risk:** None

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**New Files:**
- src/api/agentApi.ts

**Affected Files:**
- src/stores/canvas.ts (add vueFlowInstance)
- src/views/CanvasView.vue (wire up instance)
- src/main.ts or App.vue (initialize agent API)

**TypeScript Declaration:**
```typescript
declare global {
  interface Window {
    __pomoflowAgent?: ReturnType<typeof createAgentApi>
  }
}
```

## Acceptance Criteria

- [ ] Agent can programmatically create/update/delete tasks
- [ ] Agent can programmatically create/update/delete groups
- [ ] Agent can control viewport (zoom, fit)
- [ ] Agent can read current state (tasks, groups, selection)

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-09 | Finding identified | Agent-Native review |

## Resources

- Similar pattern: `window.__notificationApi` for toast notifications
- Agent-native architecture principles
