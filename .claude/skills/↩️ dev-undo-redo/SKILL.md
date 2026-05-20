---
name: dev-undo-redo
description: FIX conflicting undo/redo implementations with VueUse + Pinia and DESIGN robust patterns for complex applications. Use for both stabilizing existing systems and implementing advanced undo/redo architecture.
---

# FlowState Undo/Redo Unification

## Instructions

### **MANDATORY: Use VueUse + Pinia System Only**

**ALWAYS** use this exact pattern for FlowState undo/redo:

```typescript
import { useManualRefHistory } from '@vueuse/core'

const {
  history,
  undo,
  redo,
  canUndo,
  canRedo,
  commit
} = useManualRefHistory(unifiedState, {
  capacity: 50,
  deep: true,
  clone: true
})

// Pattern: Save state before and after every change
const saveState = (description: string) => {
  commit() // VueUse handles everything
}
```

### **Implementation Rules**

1. **NEVER** create custom undo/redo implementations
2. **NEVER** use manual JSON serialization
3. **NEVER** create multiple history managers
4. **ALWAYS** call `saveState()` before and after state changes
5. **ALWAYS** use the unified composable `useUnifiedUndoRedo()`
6. **ALWAYS** handle both stores (tasks, canvas, timer) in one system

### **Store Action Pattern**

```typescript
actions: {
  createTask(taskData: Partial<Task>) {
    const undoRedo = useUnifiedUndoRedo()
    undoRedo.saveState('Before task creation')

    // Your logic here
    this.tasks.push(newTask)

    undoRedo.saveState('After task creation')
    return newTask
  }
}
```

### **Component Pattern**

```vue
<script setup>
const { canUndo, canRedo, undo, redo } = useUnifiedUndoRedo()

// Keyboard shortcuts handled automatically
// UI shows correct button states
</script>

<template>
  <button @click="undo" :disabled="!canUndo">↶ Undo</button>
  <button @click="redo" :disabled="!canRedo">↷ Redo</button>
</template>
```

This skill ensures ONE consistent undo/redo system across FlowState, eliminating all conflicts and providing reliable functionality.

---

## Debugging Broken Undo/Redo: Evidence First

### Rule: Do Not Infer Success From Clean Tests

When the user reports undo/redo is still broken, passing unit tests or a generic Playwright path is not evidence that the real bug is fixed. The user-visible path is authoritative. Before changing behavior again, instrument the exact failing route and prove where time is spent.

Use this workflow when repeated delete -> Ctrl+Z, second Ctrl+Z lag, missing restore, phantom tasks, canvas inbox delete, toast Undo, or keyboard undo issues are reported.

### Ranked Root-Cause Hypotheses

1. Async race between local restore, Supabase realtime, IndexedDB write queue, tombstones, and in-flight delete operations. First undo starts clean; second undo happens while the queue/realtime layer still contains dirty state.
2. Canvas inbox or VueFlow watcher/render storm. Restoring `_rawTasks` can trigger canvas sync, filtered computed state, VueFlow nodes, selection, and inbox visibility recomputation.
3. Undo stack desync. Another operation may be pushed between delete and Ctrl+Z, so `performUndo()` pops the wrong operation.
4. Main-thread blocking. `cacheTasks`, full-array clones, filters, IndexedDB, or render work can block even when calls are fire-and-forget.
5. Keyboard/focus path mismatch. Playwright `keyboard.press()` may not match the real Electron focus path, especially inside VueFlow, modals, inputs, contenteditable, or panels.

### Mandatory Instrumentation Before More Fixes

Add a temporary debug flag instead of permanent noisy logs:

```typescript
const DEBUG_UNDO = import.meta.env.DEV && (
  localStorage.getItem('__UNDO_DEBUG') === 'true' ||
  Boolean((window as unknown as { __UNDO_DEBUG__?: boolean }).__UNDO_DEBUG__)
)
```

Instrument these points with `performance.mark()` and concise grouped logs gated by `DEBUG_UNDO`:

- Global keyboard handler: Ctrl+Z entry, active element, bail reason, undo call start/end.
- `performUndo()`: stack length, popped operation type, affected IDs, description, timestamp.
- `performSelectiveUndo()`: operation start/end, task ID, snapshot presence, branch taken.
- `deleteTaskWithUndo()` and `bulkDeleteTasksWithUndo()`: snapshot before/after, commit timing, affected IDs.
- `taskStore.deleteTask()`: before splice, after splice, queue delete enqueue start/end.
- `restoreTaskFromUndo()`: local upsert start/end, whether authenticated, queue restore enqueue start/end, `triggerCanvasSync()` timing.
- Realtime callback for tasks: task ID, deleted flag, pending-write status, action taken.
- Write queue: pending/syncing/failed operations for the task ID before delete, after delete, before undo, after undo.

Use marker names that include task ID and phase:

```typescript
performance.mark(`undo:${taskId}:keyboard:start`)
performance.mark(`undo:${taskId}:performUndo:start`)
performance.mark(`undo:${taskId}:restore:local-upsert:end`)
performance.mark(`undo:${taskId}:visible:end`)
```

### Required State Snapshot For Each Repro Step

For the exact failing task, capture this after each action: initial, after delete, after first Ctrl+Z, after second delete, after second Ctrl+Z, and 5 seconds later.

```typescript
window.__inspectUndoTask = async (taskId: string) => {
  const root = document.querySelector('#app') as any
  const pinia = root?.__vue_app__?._context.config.globalProperties.$pinia
  const taskStore = pinia?._s.get('tasks')
  const undo = await import('/src/composables/undoSingleton.ts')
  const rawTask = taskStore?._rawTasks?.find((task: any) => task.id === taskId)

  return {
    rawExists: Boolean(rawTask),
    rawTask,
    visibleExists: taskStore?.tasks?.some((task: any) => task.id === taskId),
    rawCount: taskStore?._rawTasks?.length,
    visibleCount: taskStore?.tasks?.length,
    pendingWrite: taskStore?.isPendingWrite?.(taskId),
    operationStack: undo.getUndoSystem().getOperationStack?.(),
    redoStack: undo.getUndoSystem().getRedoOperationStack?.(),
    activeElement: document.activeElement?.outerHTML?.slice(0, 300),
  }
}
```

If `rawExists=true` and `visibleExists=false`, do not keep changing restore. Debug filters and view eligibility. Check: `isInInbox`, `canvasDismissed`, `canvasPosition`, `parentId`, `_soft_deleted`, `deletedAt`, `status`, active project, active workspace, active smart view, due filters, and hidden done settings.

### Prove Or Disprove Wrong Operation Undo

In `performUndo()`, log the operation before popping. The expected second Ctrl+Z must pop a delete operation for the same task ID.

Evidence of stack desync:

- Top operation is not `task-delete` or `task-bulk-delete`.
- Top operation has a different task ID.
- Stack length changes between delete and Ctrl+Z before user action.
- Canvas sync, selection, drag settling, modal close, or bulk helper pushed an intervening operation.

Do not alter stack pop/push behavior until this is proven.

### Prove Or Disprove Keyboard/Focus Failure

Instrument the global keyboard handler:

```typescript
if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
  console.log('[UNDO-KB]', {
    key: event.key,
    shift: event.shiftKey,
    target: (event.target as HTMLElement)?.outerHTML?.slice(0, 300),
    activeElement: document.activeElement?.outerHTML?.slice(0, 300),
    defaultPrevented: event.defaultPrevented,
  })
}
```

Evidence of keyboard/focus issue:

- Log appears but no `performUndo()` log follows.
- Log appears twice for one physical keypress.
- Handler bails because active element is input, textarea, contenteditable, dialog, or VueFlow wrapper.
- Playwright passes because it focuses `body`, while the user is focused inside canvas inbox/modal/UI chrome.

### Prove Or Disprove Sync/Re-Delete Race

Add task-ID-specific logs in realtime and write queue processing. Look for this sequence:

1. Local restore adds task to `_rawTasks`.
2. Realtime or queue receives `is_deleted=true`/delete after restore.
3. Task is removed or marked hidden again.

Inspect IndexedDB write queue for the task ID in the browser console. If the Dexie instance is not exposed, temporarily expose a debug helper behind `__UNDO_DEBUG`:

```typescript
window.__undoQueueForTask = async (taskId: string) => {
  const { getOperationsForEntity } = await import('@/services/offline/writeQueueDB')
  return getOperationsForEntity('task', taskId)
}
```

Evidence of sync race:

- Pending or syncing `delete` remains after restore.
- `deleteOperationsByType()` skips a syncing delete.
- A realtime event with `is_deleted=true` arrives after local restore.
- `pendingWrites` expires before the echo arrives.
- Restore update queues but processes after a delete.

### Prove Or Disprove Watcher/Render Storm

Use Chrome/Electron DevTools Performance while reproducing the real path. Start recording before the first delete, stop after the second Ctrl+Z visibly resolves or stalls.

Evidence of render storm:

- Long tasks over 100ms after local restore.
- Repeated Vue component updates, style recalculation, layout, or VueFlow node work.
- `triggerCanvasSync()` followed by many computed/filter recalculations.
- `_rawTasks` mutation is fast but DOM visibility takes seconds.
- Large task list/filter computation dominates flame chart.

If this is proven, reduce or gate canvas/inbox recomputation. Do not add arbitrary `nextTick()` or `setTimeout()` hacks.

### Playwright Must Match The Real Failing Path

Generic tests are insufficient. A valid regression must use the exact surface the user reports.

For canvas inbox bugs, the Playwright test must:

- Navigate to canvas.
- Seed task fields matching canvas inbox visibility.
- Focus the same panel or VueFlow surface the user focuses.
- Delete via the same user action: Delete key, context menu, modal, or toast path.
- Press real Ctrl+Z twice, not only call store helpers.
- Assert both raw store state and visible DOM state.
- Pre-seed dirty queue state if the real bug only appears after pending/syncing operations.
- Use enough task volume to expose filter/render cost.

The test should fail if second visible restore exceeds 500ms or if `_rawTasks` and DOM visibility diverge.

### Forbidden Blind Changes During Undo Debugging

- Do not claim fixed without the user confirming the real failing path.
- Do not infer fixed from passing unit tests or generic Playwright tests.
- Do not add more `nextTick()`, debounce, or `setTimeout(0)` without timing evidence.
- Do not remove queue/realtime behavior globally to hide the symptom.
- Do not alter undo stack pop/push behavior until stack logs prove wrong-operation undo.
- Do not change filtering/view eligibility until `rawExists=true` and `visibleExists=false` is observed.
- Do not reintroduce `createTask(deletedTask)` in restore paths.
- Do not call full-list `saveTasksToStorage()` for authenticated undo restore unless evidence requires it.

### Minimal Next Debugging Loop

1. Enable `localStorage.__UNDO_DEBUG = 'true'` in the user’s real Electron/browser session.
2. Reproduce `delete -> Ctrl+Z -> delete same task -> Ctrl+Z` in the exact failing view.
3. Capture `__inspectUndoTask(taskId)` after each step.
4. Record DevTools Performance for the sequence.
5. Inspect Supabase realtime WS frames for the task ID.
6. Inspect write queue entries for the task ID.
7. Only then choose the fix based on evidence: sync race, filter invisibility, stack desync, keyboard focus, or render storm.

---

## Advanced Architecture Patterns

For complex applications requiring enhanced undo/redo capabilities, consider these advanced patterns:

### Command Pattern Implementation

Use the Command Pattern for complex operations requiring granular control:

```typescript
interface Command {
  execute(): void | Promise<void>
  undo(): void | Promise<void>
  getDescription(): string
  canExecute(): boolean
}

class OptimizedHistory {
  private undoStack: HistoryEntry[] = []
  private redoStack: HistoryEntry[] = []

  async execute(command: Command): Promise<void> {
    await command.execute()
    this.undoStack.push({ command, timestamp: Date.now() })
    this.redoStack = []
    this.optimizeMemory()
  }
}
```

### Application-Specific Commands

Create domain-specific commands for all mutable operations:

```typescript
// Task Management Commands
class CreateTaskCommand extends BaseCommand {
  constructor(private taskStore: any, private taskData: any) {
    super(`Create task: ${taskData.title}`)
  }

  async execute(): Promise<void> {
    this.generatedId = await this.taskStore.createTask(this.taskData)
  }

  async undo(): Promise<void> {
    if (this.generatedId) {
      await this.taskStore.deleteTask(this.generatedId)
    }
  }
}

// Canvas Interaction Commands
class MoveNodeCommand extends BaseCommand {
  constructor(
    private canvasStore: any,
    private nodeId: string,
    private fromPos: Position,
    private toPos: Position
  ) {
    super(`Move node ${nodeId}`)
  }

  async execute(): Promise<void> {
    await this.canvasStore.updateNodePosition(this.nodeId, this.toPos)
  }

  async undo(): Promise<void> {
    await this.canvasStore.updateNodePosition(this.nodeId, this.fromPos)
  }
}
```

### Performance Optimizations

For large-scale applications, implement these optimizations:

#### Memory Management
- Automatic cleanup of old history entries
- Delta compression for state changes
- Circular buffer for fixed-size history

#### Batch Operations
- Group related operations into single commands
- Transaction-like behavior for complex changes
- Rollback capability for failed operations

#### Asynchronous Operations
- Support for async/await in command execution
- Progress tracking for long-running operations
- Error recovery and retry mechanisms

### Key Requirements for Advanced Systems
- Always implement both `execute()` and `undo()` methods
- Use async/await for operations that might be slow
- Include descriptive messages for debugging and user feedback
- Handle circular references in state serialization
- Implement memory management for large histories
- Use delta compression for performance optimization

### Common Advanced Patterns
- **Batch Commands**: Group related operations together
- **Checkpoint Commands**: Create application state snapshots
- **Delta Storage**: Store only changes, not full state
- **Memory Management**: Automatic cleanup and compression
- **Error Recovery**: Graceful handling of failed operations

### When to Use Advanced Patterns

Use Command Pattern and advanced architecture when:
- Building new undo/redo systems from scratch
- Need granular control over individual operations
- Working with complex state changes across multiple stores
- Implementing transaction-like behavior
- Requiring advanced memory management and optimization

### When to Use VueUse + Pinia

Use the VueUse approach (from primary section above) when:
- Fixing existing FlowState undo/redo issues
- Working with Vue 3 + Pinia stack
- Need rapid implementation with proven patterns
- Managing state within single store or related stores
- Prioritizing development speed over architectural complexity

This comprehensive approach ensures robust, scalable undo/redo systems that maintain consistency across complex applications while optimizing performance and memory usage.

---

## MANDATORY USER VERIFICATION REQUIREMENT

### Policy: No Fix Claims Without User Confirmation

**CRITICAL**: Before claiming ANY issue, bug, or problem is "fixed", "resolved", "working", or "complete", the following verification protocol is MANDATORY:

#### Step 1: Technical Verification
- Run all relevant tests (build, type-check, unit tests)
- Verify no console errors
- Take screenshots/evidence of the fix

#### Step 2: User Verification Request
**REQUIRED**: Use the `AskUserQuestion` tool to explicitly ask the user to verify the fix:

```
"I've implemented [description of fix]. Before I mark this as complete, please verify:
1. [Specific thing to check #1]
2. [Specific thing to check #2]
3. Does this fix the issue you were experiencing?

Please confirm the fix works as expected, or let me know what's still not working."
```

#### Step 3: Wait for User Confirmation
- **DO NOT** proceed with claims of success until user responds
- **DO NOT** mark tasks as "completed" without user confirmation
- **DO NOT** use phrases like "fixed", "resolved", "working" without user verification

#### Step 4: Handle User Feedback
- If user confirms: Document the fix and mark as complete
- If user reports issues: Continue debugging, repeat verification cycle

### Prohibited Actions (Without User Verification)
- Claiming a bug is "fixed"
- Stating functionality is "working"
- Marking issues as "resolved"
- Declaring features as "complete"
- Any success claims about fixes

### Required Evidence Before User Verification Request
1. Technical tests passing
2. Visual confirmation via Playwright/screenshots
3. Specific test scenarios executed
4. Clear description of what was changed

**Remember: The user is the final authority on whether something is fixed. No exceptions.**
