# Canvas Rebuild - Implementation Phases

## Overview

7 incremental phases, each with clear deliverables and verification criteria.

---

## PHASE 1: Empty Canvas Renders

**Milestone**: `/canvas-new` route shows empty Vue Flow canvas with controls

### Files to Create

1. **`src/views/CanvasViewNew.vue`** - Basic Vue Flow setup
```vue
<template>
  <div class="canvas-container">
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :node-types="nodeTypes"
      :default-edge-options="defaultEdgeOptions"
      fit-view-on-init
      @node-drag-stop="onNodeDragStop"
    >
      <Background />
      <Controls />
      <MiniMap />
    </VueFlow>
  </div>
</template>

<script setup lang="ts">
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { useCanvasCore } from '@/composables/canvasNew/useCanvasCore'

const { nodes, edges, nodeTypes, defaultEdgeOptions, onNodeDragStop } = useCanvasCore()
</script>
```

2. **`src/stores/canvasNew.ts`** - Empty store skeleton
```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CanvasGroupNew, CanvasStateNew } from './canvas/types'

export const useCanvasNewStore = defineStore('canvasNew', () => {
  const groups = ref<CanvasGroupNew[]>([])
  const viewport = ref({ x: 0, y: 0, zoom: 1 })
  const selectedIds = ref<string[]>([])

  return {
    groups,
    viewport,
    selectedIds
  }
})
```

3. **`src/composables/canvasNew/useCanvasCore.ts`** - Vue Flow initialization
```typescript
import { ref, markRaw } from 'vue'
import { useVueFlow, type Node, type Edge } from '@vue-flow/core'

export function useCanvasCore() {
  const nodes = ref<Node[]>([])
  const edges = ref<Edge[]>([])

  const nodeTypes = {
    // Will add sectionNode and taskNode in later phases
  }

  const defaultEdgeOptions = {
    type: 'smoothstep'
  }

  function onNodeDragStop(event: any) {
    // Will implement in Phase 4
  }

  return {
    nodes,
    edges,
    nodeTypes: markRaw(nodeTypes),
    defaultEdgeOptions,
    onNodeDragStop
  }
}
```

4. **Update `src/router/index.ts`**
```typescript
{
  path: '/canvas-new',
  name: 'canvas-new',
  component: () => import('@/views/CanvasViewNew.vue'),
  meta: { requiresAuth: false }
}
```

### Verification
- [ ] Navigate to `/canvas-new`
- [ ] See empty canvas with pan/zoom
- [ ] Background grid visible
- [ ] Controls (zoom buttons) visible
- [ ] MiniMap visible
- [ ] No console errors

---

## PHASE 2: Groups Appear

**Milestone**: Groups load from Supabase and display on canvas

### Files to Create/Update

1. **`src/components/canvasNew/GroupNodeNew.vue`**
```vue
<template>
  <div
    class="group-node"
    :style="{
      width: `${data.dimensions?.width || 300}px`,
      height: `${data.dimensions?.height || 200}px`,
      backgroundColor: data.color || '#3b82f6'
    }"
  >
    <div class="group-header">
      <span class="group-name">{{ data.name }}</span>
    </div>
    <NodeResizer :min-width="200" :min-height="150" />
  </div>
</template>

<script setup lang="ts">
import { NodeResizer } from '@vue-flow/node-resizer'
import type { CanvasGroupNew } from '@/stores/canvas/types'

defineProps<{
  data: CanvasGroupNew
}>()
</script>
```

2. **`src/composables/canvasNew/useCanvasGroups.ts`**
```typescript
import { computed } from 'vue'
import { useCanvasNewStore } from '@/stores/canvasNew'
import { useSupabaseDatabaseV2 } from '@/composables/useSupabaseDatabaseV2'
import type { Node } from '@vue-flow/core'

export function useCanvasGroups() {
  const store = useCanvasNewStore()
  const { fetchGroups, saveGroup, deleteGroup } = useSupabaseDatabaseV2()

  async function loadGroups() {
    const groups = await fetchGroups()
    store.groups = groups
  }

  const groupNodes = computed<Node[]>(() => {
    return store.groups.map(group => ({
      id: `section-${group.id}`,
      type: 'sectionNode',
      position: { x: group.position.x, y: group.position.y },
      data: { ...group },
      style: {
        width: `${group.dimensions?.width || 300}px`,
        height: `${group.dimensions?.height || 200}px`
      }
    }))
  })

  return {
    loadGroups,
    groupNodes
  }
}
```

3. **Update `useCanvasCore.ts`** - Add node type
```typescript
import GroupNodeNew from '@/components/canvasNew/GroupNodeNew.vue'

const nodeTypes = {
  sectionNode: markRaw(GroupNodeNew)
}
```

### Verification
- [ ] Existing groups appear on canvas
- [ ] Group positions match database
- [ ] Group colors display correctly
- [ ] Groups are draggable
- [ ] Groups can be resized
- [ ] Positions persist on refresh

---

## PHASE 3: Tasks in Inbox

**Milestone**: Tasks show in inbox panel, tasks on canvas display

### Files to Create

1. **`src/components/canvasNew/CanvasInbox.vue`**
```vue
<template>
  <div class="canvas-inbox">
    <h3>Inbox</h3>
    <div class="task-list">
      <div
        v-for="task in inboxTasks"
        :key="task.id"
        class="inbox-task"
        draggable="true"
        @dragstart="onDragStart($event, task)"
      >
        {{ task.title }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTaskStore } from '@/stores/tasks'

const taskStore = useTaskStore()

const inboxTasks = computed(() =>
  taskStore.tasks.filter(t => t.isInInbox)
)

function onDragStart(event: DragEvent, task: any) {
  event.dataTransfer?.setData('taskId', task.id)
}
</script>
```

2. **`src/components/canvasNew/TaskNodeNew.vue`**
```vue
<template>
  <div class="task-node">
    <div class="task-title">{{ data.task.title }}</div>
    <div class="task-priority" :class="data.task.priority">
      {{ data.task.priority }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Task } from '@/types/tasks'

defineProps<{
  data: { task: Task }
}>()
</script>
```

3. **`src/composables/canvasNew/useCanvasNodes.ts`**
```typescript
import { computed } from 'vue'
import { useVueFlow, type Node } from '@vue-flow/core'
import { useCanvasNewStore } from '@/stores/canvasNew'
import { useTaskStore } from '@/stores/tasks'

export function useCanvasNodes() {
  const canvasStore = useCanvasNewStore()
  const taskStore = useTaskStore()
  const { setNodes } = useVueFlow()

  const taskNodes = computed<Node[]>(() => {
    return taskStore.tasks
      .filter(t => !t.isInInbox && t.canvasPosition)
      .map(task => ({
        id: `task-${task.id}`,
        type: 'taskNode',
        position: task.canvasPosition!,
        data: { task }
      }))
  })

  function syncNodes() {
    const allNodes = [
      ...groupNodes.value,
      ...taskNodes.value
    ]
    setNodes(allNodes)
  }

  return {
    taskNodes,
    syncNodes
  }
}
```

### Verification
- [ ] Inbox panel shows on left side
- [ ] Inbox shows tasks with `isInInbox: true`
- [ ] Tasks on canvas show with `isInInbox: false`
- [ ] Task positions match stored `canvasPosition`
- [ ] Task details (title, priority) display correctly

---

## PHASE 4: Drag Task to Canvas

**Milestone**: Drag task from inbox, drop on canvas, position persists

### Files to Create

1. **`src/composables/canvasNew/useCanvasDrag.ts`**
```typescript
import { useVueFlow, type Node } from '@vue-flow/core'
import { useTaskStore } from '@/stores/tasks'
import { useSupabaseDatabaseV2 } from '@/composables/useSupabaseDatabaseV2'

export function useCanvasDrag() {
  const { project, findNode } = useVueFlow()
  const taskStore = useTaskStore()
  const { updateTask } = useSupabaseDatabaseV2()

  async function onDrop(event: DragEvent) {
    event.preventDefault()

    const taskId = event.dataTransfer?.getData('taskId')
    if (!taskId) return

    // Convert drop position to canvas coordinates
    const canvasEl = (event.target as HTMLElement).closest('.vue-flow')
    if (!canvasEl) return

    const rect = canvasEl.getBoundingClientRect()
    const position = project({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    })

    // Update task
    await taskStore.updateTask(taskId, {
      isInInbox: false,
      canvasPosition: { x: position.x, y: position.y }
    })

    // Sync to Supabase
    await updateTask(taskId, {
      isInInbox: false,
      canvasPosition: { x: position.x, y: position.y }
    })
  }

  async function onNodeDragStop(event: { node: Node }) {
    const node = event.node
    const taskId = node.id.replace('task-', '')

    // Save new position
    await taskStore.updateTask(taskId, {
      canvasPosition: { x: node.position.x, y: node.position.y }
    })

    await updateTask(taskId, {
      canvasPosition: { x: node.position.x, y: node.position.y }
    })
  }

  return {
    onDrop,
    onNodeDragStop
  }
}
```

### Update CanvasViewNew.vue
```vue
<VueFlow
  @drop="onDrop"
  @dragover.prevent
  @node-drag-stop="onNodeDragStop"
>
```

### Verification
- [ ] Drag task from inbox to canvas
- [ ] Task appears at drop position
- [ ] `isInInbox` changes to `false`
- [ ] Drag task to new position on canvas
- [ ] Refresh page - position persists
- [ ] No position jumping
- [ ] Console shows no errors

---

## PHASE 5: Parent-Child Works

**Milestone**: Drag task into group, moves with parent

### Implementation

```typescript
// In useCanvasDrag.ts

async function attachToParent(taskId: string, parentId: string) {
  const task = findNode(`task-${taskId}`)
  const parent = findNode(parentId)

  if (!task || !parent) return

  // 1. Calculate relative position
  const relativePos = {
    x: task.computedPosition.x - parent.computedPosition.x,
    y: task.computedPosition.y - parent.computedPosition.y
  }

  // 2. Set extent BEFORE parentNode (prevents jump)
  task.extent = 'parent'

  // 3. Set parentNode
  task.parentNode = parentId

  // 4. Set relative position
  task.position = relativePos

  // 5. Clear extent after nextTick
  await nextTick()
  task.extent = undefined

  // 6. Save to store (absolute position for persistence)
  await taskStore.updateTask(taskId, {
    parentGroupId: parentId.replace('section-', ''),
    canvasPosition: task.computedPosition
  })
}

function detachFromParent(taskId: string) {
  const task = findNode(`task-${taskId}`)
  if (!task) return

  // Save absolute position
  const absolutePos = { ...task.computedPosition }

  // Remove parent
  task.parentNode = undefined
  task.position = absolutePos

  // Update store
  taskStore.updateTask(taskId, {
    parentGroupId: null,
    canvasPosition: absolutePos
  })
}
```

### Containment Detection
```typescript
function isInsideGroup(taskPos: XYPosition, group: Node): boolean {
  const groupPos = group.computedPosition
  const groupDim = group.data.dimensions || { width: 300, height: 200 }

  return (
    taskPos.x >= groupPos.x &&
    taskPos.x <= groupPos.x + groupDim.width &&
    taskPos.y >= groupPos.y &&
    taskPos.y <= groupPos.y + groupDim.height
  )
}
```

### Verification
- [ ] Drag task into group - stays at drop position
- [ ] Drag group - task moves WITH group
- [ ] Drag task out of group - stays at new position
- [ ] Refresh - all relationships persist
- [ ] Nested groups work (group inside group)
- [ ] Task count in group header updates

---

## PHASE 6: Feature Parity

**Milestone**: All canvas features working

### Features Checklist

1. **Context menus (right-click)**
   - Task context menu
   - Group context menu
   - Edge context menu
   - Canvas background context menu

2. **Multi-select**
   - Shift+click to add to selection
   - Drag rectangle to select multiple
   - Delete selected items

3. **Group creation/editing**
   - Create new group (context menu)
   - Edit group name/color
   - Delete group (with confirmation)

4. **Group resize**
   - Resize handles on groups
   - Min/max constraints
   - Persist dimensions

5. **Keyboard shortcuts**
   - Delete key removes selected
   - Escape clears selection
   - Ctrl+A select all

6. **Zoom controls**
   - Mouse wheel zoom
   - Zoom buttons
   - Fit to view

7. **Minimap**
   - Shows all nodes
   - Click to navigate

### Verification
- [ ] All existing canvas functionality works
- [ ] No regressions from old canvas
- [ ] Performance acceptable with 50+ nodes

---

## PHASE 7: Swap & Cleanup

**Milestone**: New canvas replaces old, old code deleted

See [06-CLEANUP.md](./06-CLEANUP.md) for complete file list.

### Actions
1. Update router: `/canvas` -> `CanvasViewNew.vue`
2. Update all integration points (see [02-INTEGRATION-MAP.md](./02-INTEGRATION-MAP.md))
3. Delete old canvas files
4. Rename new files to standard names:
   - `CanvasViewNew.vue` -> `CanvasView.vue`
   - `canvasNew.ts` -> `canvas.ts`
   - `canvasNew/` -> `canvas/`

### Verification
- [ ] `/canvas` shows new canvas
- [ ] All tests pass
- [ ] No imports reference old canvas
- [ ] Build succeeds
- [ ] No runtime errors
