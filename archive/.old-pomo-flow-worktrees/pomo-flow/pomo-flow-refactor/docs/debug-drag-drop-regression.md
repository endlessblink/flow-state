# Drag and Drop Regression - Debug Analysis

**Date**: October 26, 2025
**Issue**: Drag and drop from inbox to canvas not working after refactoring
**Status**: Debugging in progress

---

## Problem Summary

After refactoring CanvasView.vue to use composables, drag and drop functionality is broken:

- **Symptom**: Playwright dragTo test times out after 5 seconds
- **Observed**: Task gets checkmark in inbox but doesn't move to canvas
- **Impact**: CRITICAL - Core feature completely non-functional

---

## Code Analysis

### 1. Template Event Binding ✅ CORRECT

**Location**: `src/views/CanvasView.vue:137-142`

```vue
<div
  @drop="handleDrop"
  @dragover.prevent
  @contextmenu.prevent="handleCanvasRightClick"
  class="canvas-drop-zone"
>
  <VueFlow ...>
```

**Analysis**:
- ✅ `@drop="handleDrop"` properly bound
- ✅ `@dragover.prevent` prevents default (allows drop)
- ✅ Wrapper div strategy is correct

### 2. Composable Export ✅ CORRECT

**Location**: `src/composables/canvas/useCanvasDragDrop.ts:414-420`

```typescript
return {
  handleNodeDragStart,
  handleNodeDragStop,
  handleNodeDrag,
  handleNodesChange,
  handleDrop,  // ✅ Exported
  // ...
}
```

**Analysis**:
- ✅ `handleDrop` is exported from composable
- ✅ All drag handlers are exported

### 3. CanvasView Destructuring ✅ CORRECT

**Location**: `src/views/CanvasView.vue:467-475`

```typescript
const {
  handleNodeDragStart,
  handleNodeDragStop,
  handleNodeDrag,
  handleNodesChange: dragDropNodesChange,
  handleDrop,  // ✅ Destructured
  // ...
} = useCanvasDragDrop(nodes, resizeState, syncEdges)
```

**Analysis**:
- ✅ `handleDrop` properly destructured
- ✅ All parameters passed correctly (nodes, resizeState, syncEdges)

### 4. InboxPanel Drag Start ✅ CORRECT

**Location**: `src/components/canvas/InboxPanel.vue:574-597`

```typescript
const handleDragStart = (event: DragEvent, task: any) => {
  let taskIds: string[]
  if (selectedTaskIds.value.has(task.id) && selectedTaskIds.value.size > 1) {
    taskIds = Array.from(selectedTaskIds.value)
  } else {
    taskIds = [task.id]
  }

  event.dataTransfer?.setData('application/json', JSON.stringify({
    taskIds, // Array of task IDs
    fromInbox: true
  }))
}
```

**Analysis**:
- ✅ Sets dataTransfer with correct format
- ✅ Uses `taskIds` (array) for batch operations
- ✅ Sets `fromInbox: true` flag

### 5. handleDrop Implementation ✅ CORRECT LOGIC

**Location**: `src/composables/canvas/useCanvasDragDrop.ts:371-439`

```typescript
const handleDrop = (event: DragEvent) => {
  event.preventDefault()

  const data = event.dataTransfer?.getData('application/json')
  if (!data) return

  const parsedData = JSON.parse(data)
  const { taskId, taskIds, fromInbox, source } = parsedData

  if (fromInbox || source === 'board' || source === 'sidebar') {
    // Use VueFlow's built-in coordinate transformation
    const canvasPosition = project({
      x: event.clientX,
      y: event.clientY
    })

    // Handle batch drop (multiple tasks)
    if (taskIds && Array.isArray(taskIds)) {
      taskIds.forEach((id, index) => {
        const offsetX = (index % 3) * 250
        const offsetY = Math.floor(index / 3) * 150

        taskStore.updateTaskWithUndo(id, {
          canvasPosition: { x: canvasPosition.x + offsetX, y: canvasPosition.y + offsetY },
          isInInbox: false
        })
      })
    }
    // Handle single task drop
    else if (taskId) {
      taskStore.updateTaskWithUndo(taskId, {
        canvasPosition: { x: canvasPosition.x, y: canvasPosition.y },
        isInInbox: false
      })
    }
  }
}
```

**Analysis**:
- ✅ Prevents default correctly
- ✅ Gets dataTransfer data
- ✅ Handles both `taskIds` (array) and `taskId` (single)
- ✅ Uses VueFlow's `project()` for coordinate transformation
- ✅ Updates tasks with correct position and `isInInbox: false`

---

## Hypothesis: Why It Might Not Be Working

### Theory 1: Vue Flow `project` Function Not Available

**Issue**: The `project` function from `useVueFlow()` might not be properly reactive or available at the time of drop.

**Evidence**:
```typescript
const { project } = useVueFlow()  // Line 17
```

**Possible Cause**:
- `useVueFlow()` returns functions that require Vue Flow to be mounted
- In the composable, Vue Flow might not be initialized yet
- The `project` function might return incorrect coordinates

**Test**: Add logging to see if `project` is defined and what it returns

### Theory 2: Event Bubbling / Capture Issue

**Issue**: The drop event might not be reaching the handler due to Vue Flow capturing it.

**Possible Cause**:
- Vue Flow's internal drag handlers might be preventing event propagation
- The wrapper div might not be receiving the drop event

**Test**: Add logging to see if `handleDrop` is ever called

### Theory 3: Reactive Dependency Broken

**Issue**: The `nodes`, `resizeState`, or `syncEdges` parameters might not be properly reactive.

**Possible Cause**:
- Parameters passed to composable might be unwrapped incorrectly
- References might be lost during destructuring

**Test**: Log the parameters to verify they're defined

---

## Debug Logging Added

I've instrumented the code with extensive logging to trace execution:

### InboxPanel Debug Logs

**File**: `src/components/canvas/InboxPanel.vue:574-597`

```typescript
const handleDragStart = (event: DragEvent, task: any) => {
  console.log('[InboxPanel] 🎯 handleDragStart CALLED for task:', task.id)

  // ... task selection logic ...

  console.log('[InboxPanel] Setting drag data:', dragData)
  event.dataTransfer?.setData('application/json', JSON.stringify(dragData))
  console.log('[InboxPanel] ✓ Drag data set successfully')
}
```

**Expected Output**:
```
[InboxPanel] 🎯 handleDragStart CALLED for task: task-id-123
[InboxPanel] 📦 Single task drag: ["task-id-123"]
[InboxPanel] Setting drag data: {taskIds: ["task-id-123"], fromInbox: true}
[InboxPanel] ✓ Drag data set successfully
```

### useCanvasDragDrop Debug Logs

**File**: `src/composables/canvas/useCanvasDragDrop.ts:371-439`

```typescript
const handleDrop = (event: DragEvent) => {
  console.log('[useCanvasDragDrop] 🎯 handleDrop CALLED', {
    clientX: event.clientX,
    clientY: event.clientY,
    dataTransfer: event.dataTransfer
  })

  event.preventDefault()

  const data = event.dataTransfer?.getData('application/json')
  console.log('[useCanvasDragDrop] Data from dataTransfer:', data)

  // ... rest of function with logging at each step ...
}
```

**Expected Output**:
```
[useCanvasDragDrop] 🎯 handleDrop CALLED {clientX: 500, clientY: 300, ...}
[useCanvasDragDrop] Data from dataTransfer: {"taskIds":["task-id-123"],"fromInbox":true}
[useCanvasDragDrop] Parsed data: {taskIds: ["task-id-123"], fromInbox: true}
[useCanvasDragDrop] ✓ Valid source, projecting coordinates...
[useCanvasDragDrop] Canvas position after projection: {x: 100, y: 200}
[useCanvasDragDrop] 📦 Batch drop detected, count: 1
[useCanvasDragDrop] Updating task task-id-123 at (100, 200)
[useCanvasDragDrop] ✅ Batch drop complete
```

---

## Testing Instructions

### Step 1: Open Browser DevTools

1. Navigate to `http://localhost:5546/#/canvas`
2. Open browser DevTools (F12)
3. Go to Console tab
4. Clear console

### Step 2: Perform Drag and Drop

1. Drag any task from inbox
2. Drop it onto the canvas area
3. Observe console output

### Step 3: Analyze Console Output

#### Scenario A: NO Console Logs At All
**Diagnosis**: Neither drag start nor drop handlers are firing
**Root Cause**: Event handlers not bound correctly or template not rendering
**Action**: Check if CanvasView component is properly mounted

#### Scenario B: [InboxPanel] Logs Only
**Example**:
```
[InboxPanel] 🎯 handleDragStart CALLED for task: task-id-123
[InboxPanel] Setting drag data: {taskIds: ["task-id-123"], fromInbox: true}
[InboxPanel] ✓ Drag data set successfully
```

**Diagnosis**: Drag starts but drop handler never fires
**Root Cause**:
- Drop zone not accepting drops (missing `@dragover.prevent`?)
- Event not reaching handler (Vue Flow capturing it?)
- Handler not bound to template correctly

**Action**:
1. Verify `@drop` and `@dragover.prevent` are on wrapper div
2. Check if Vue Flow is preventing event propagation
3. Try adding `@drop` directly to VueFlow component

#### Scenario C: Both Logs, But No Data
**Example**:
```
[InboxPanel] 🎯 handleDragStart CALLED for task: task-id-123
[InboxPanel] ✓ Drag data set successfully
[useCanvasDragDrop] 🎯 handleDrop CALLED {clientX: 500, clientY: 300}
[useCanvasDragDrop] Data from dataTransfer: ""
[useCanvasDragDrop] ❌ No data in dataTransfer, exiting
```

**Diagnosis**: Drop fires but dataTransfer is empty
**Root Cause**: Browser security restriction or dataTransfer cleared

**Action**: Check if drag is crossing iframe/component boundaries

#### Scenario D: Both Logs, Has Data, But Projection Fails
**Example**:
```
[InboxPanel] ✓ Drag data set successfully
[useCanvasDragDrop] 🎯 handleDrop CALLED
[useCanvasDragDrop] Data from dataTransfer: {"taskIds":["task-id-123"],"fromInbox":true}
[useCanvasDragDrop] Canvas position after projection: undefined
```

**Diagnosis**: Vue Flow's `project()` function not working
**Root Cause**: `useVueFlow()` not returning valid instance

**Action**: Move `useVueFlow()` call to CanvasView and pass `project` as parameter

#### Scenario E: Complete Flow But Task Not Updating
**Example**:
```
[InboxPanel] ✓ Drag data set successfully
[useCanvasDragDrop] ✓ Valid source, projecting coordinates...
[useCanvasDragDrop] Canvas position after projection: {x: 100, y: 200}
[useCanvasDragDrop] Updating task task-id-123 at (100, 200)
[useCanvasDragDrop] ✅ Batch drop complete
```

**Diagnosis**: Handler executes but task doesn't appear on canvas
**Root Cause**: Task store update not triggering reactivity or `syncNodes` not called

**Action**:
1. Check if `taskStore.updateTaskWithUndo` is working
2. Verify `syncNodes()` is called after update
3. Check if nodes array is reactive

---

## Next Steps

### Immediate
1. ✅ Add debug logging (DONE)
2. ⏳ Test drag and drop with console open
3. ⏳ Analyze console output based on scenarios above
4. ⏳ Identify root cause from debug output

### After Diagnosis
1. Fix the identified issue
2. Remove or reduce debug logging
3. Re-test with Playwright
4. Update integration test results
5. Document the fix in refactoring PRD

---

## Files Modified for Debugging

1. `src/composables/canvas/useCanvasDragDrop.ts`
   - Added extensive logging to `handleDrop` function

2. `src/components/canvas/InboxPanel.vue`
   - Added logging to `handleDragStart` function

---

## Rollback Instructions

If debugging needs to be removed:

### Remove InboxPanel Debug Logs

**File**: `src/components/canvas/InboxPanel.vue`

Search for and remove lines containing:
- `console.log('[InboxPanel]`

### Remove useCanvasDragDrop Debug Logs

**File**: `src/composables/canvas/useCanvasDragDrop.ts`

Search for and remove lines containing:
- `console.log('[useCanvasDragDrop]`

Or revert to git commit before debugging was added.

---

**Status**: ⏳ Waiting for manual testing to analyze console output
**Next Action**: Test drag and drop in browser and report console output
