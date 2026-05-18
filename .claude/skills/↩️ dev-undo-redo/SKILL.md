---
name: dev-undo-redo
description: FlowState undo/redo system — operation-aware stack, sync coherence rules, delete-time toast, race avoidance for offline-first + Supabase + IndexedDB queue. Use when adding new undoable operations, debugging "restore doesn't work" / "lag after undo" symptoms, or extending the toast/Ctrl+Z UX.
---

# FlowState Undo/Redo — Real Architecture

This skill replaces an earlier draft that referenced VueUse `useManualRefHistory` as the primary system. **That is no longer accurate.** The codebase uses an operation-aware stack with a hard-won set of constraints. Read this end-to-end before touching the undo path.

## 1. The actual architecture (as of 2026-05-18)

**Source of truth:** `src/composables/undoSingleton.ts`. A module-level singleton exposes:

- `operationStack` / `redoOperationStack` (arrays of `{operation, snapshotBefore, snapshotAfter}`, capacity 30)
- `performUndo()` / `performRedo()` — pop, push to other stack, dispatch via `performSelectiveUndo()`
- Public composable wrapper: `useUnifiedUndoRedo()` (`src/composables/useUnifiedUndoRedo.ts`)
- Window singleton at `window.__pomoFlowUndoSystem` for cross-frame/Electron access
- VueUse `useManualRefHistory` still exists as a **legacy fallback** for non-operation-aware code paths. Do not extend it; route new work through the operation stack.

**Six destructive helpers** all fire a delete-time toast with an Undo button via `showDeleteToast()`:
- `deleteTaskWithUndo` (line ~898)
- `permanentlyDeleteTaskWithUndo` (line ~931) — see ⚠️ section below
- `deleteGroupWithUndo` (line ~1078)
- `bulkDeleteTasksWithUndo` (line ~1104)
- `bulkMoveToInboxWithUndo` (line ~1136) — bypasses `beginOperation`/`commitOperation`
- `pushImageDeleteUndo` (line ~1221) — synchronous, bypasses entirely

**The toast** is rendered by `src/composables/useToast.ts`. It accepts an optional `action: { label, onClick }`. The Undo callback calls `performUndo()` — same as Ctrl+Z, operates on top of operation stack. If user did another op between delete and click, the newer op gets undone (Gmail/VS Code "Undo Send" semantics).

## 2. Restore path — DO use `restoreTaskFromUndo`, NOT `createTask`

This is the single most important pattern in this skill. Get it wrong and you'll reintroduce the "15-20s after-undo lag" bug.

**Wrong (causes race):**
```ts
// ❌ DO NOT do this in performSelectiveUndo or any restore path
await taskStore.createTask(deletedTask)
```
Why: `createTask` does BOTH a direct Supabase upsert AND a queue CREATE. The queued CREATE races with any orphaned in-flight DELETE for the same id. If the orphaned DELETE lands on Supabase after our CREATE, the row is re-soft-deleted. The orchestrator's next 5s cycle reconciles, producing user-visible delays of 15-20s.

**Right (decisive, no race):**
```ts
// ✅ Single direct upsert, no queue, is_deleted=false explicit
await taskStore.restoreTaskFromUndo(deletedTask)
```
`restoreTaskFromUndo` (`src/stores/tasks/taskOperations.ts`):
1. Optimistic push into `_rawTasks` (or in-place update if already present)
2. `addPendingWrite(taskId)` to suppress our own realtime echo
3. Single direct `saveSpecificTasks([{...task, _soft_deleted: false, deletedAt: undefined}])` upsert
4. **No queue enqueue** — eliminates the CREATE-vs-DELETE race entirely
5. Tolerates direct-save failure (offline) — local optimistic state stands

For soft-delete OR hard-delete (Shift+Delete) restores, the upsert with `onConflict: 'id'` handles both because:
- Soft-deleted row exists → UPDATE flips `is_deleted=false`
- Hard-deleted row gone + tombstone present → call `clearTombstoneForUndo()` first, then upsert INSERTs the row

## 3. Sync coherence rules (the queue trap)

**The sync orchestrator (`src/composables/sync/useSyncOrchestrator.ts`) is a 5-second polling loop** with these critical properties:

- Operations: `create | update | delete`, statuses: `pending | syncing | completed | failed | conflict`
- **BUG-1534 logic is unidirectional**: when processing DELETE, it cancels pending CREATEs for the same entity. There is **no** symmetric CREATE-cancels-DELETE.
- **`deleteOperationsByType()` cannot abort in-flight ops**: rows in `status='syncing'` are skipped because the HTTP request is already in flight. There is no AbortController plumbing.
- **No per-entity mutex.** Concurrent ops for the same id race freely.
- **No event-driven enqueue.** Missing a 5s cycle costs up to 5s of latency.

These are known architectural limitations. Until they're fixed (see § 7 Backlog), avoid these patterns:
- Mixing a direct Supabase write AND a queue enqueue for the same op (the createTask trap)
- Assuming `deleteOperationsByType` will actually cancel an in-flight DELETE
- Relying on `addPendingWrite` for ordering — it only suppresses incoming echoes, not outgoing writes

The `waitForInFlightOperations()` helper in `src/services/offline/writeQueueDB.ts` polls until a `status='syncing'` op settles. Use it before any restore-style operation to ensure prior in-flight DELETEs complete before your upsert.

## 4. The 6 helpers — invariants and gotchas

| Helper | Operation type | Uses beginOperation/commit? | Notes |
|---|---|---|---|
| `deleteTaskWithUndo` | `task-delete` | Yes | Standard. Routes restore through `restoreTaskFromUndo`. |
| `permanentlyDeleteTaskWithUndo` | `task-delete` | Yes | ⚠️ Originally documented as "broken" (corrupts shared `pendingOperation`). Refactored to per-op handles. **Inbox right-click "Delete permanently" should still route through `bulkDeleteTasksWithUndo([id])`** (see `ModalManager.vue`) until this helper is fully validated. |
| `deleteGroupWithUndo` | `group-delete` | Yes | Canvas group/section delete. Existing path. |
| `bulkDeleteTasksWithUndo` | `task-bulk-delete` | Yes | The safe path for mass delete and the workaround for `permanentlyDelete*` corruption. |
| `bulkMoveToInboxWithUndo` | `task-move` | **No — bypasses** | BUG-1739: drag-settling races stole the shared `pendingOperation`. Pushes directly to `operationStack`. |
| `pushImageDeleteUndo` | `image-delete` | **No — synchronous** | TASK-1690. Image data is stored on `snapshotBefore._imageData`. |

### Why some helpers bypass beginOperation/commitOperation

The bypass pattern (used by `bulkMoveToInboxWithUndo` and `rippleShiftWithUndo`) exists for a real reason: BUG-1739. Drag-settle handlers could fire `commitOperation` between our `beginOperation` and our own `commitOperation`, stealing the shared `pendingOperation` slot. Captures its own snapshotBefore, runs mutations, captures snapshotAfter, pushes to `operationStack` directly.

**Implication for `showDeleteToast` injection:** the toast must be fired from inside EACH helper, not centralized in `commitOperation`, because the bypass helpers never call commit.

## 5. UX patterns we ship

**Delete-time toast with Undo action.** Every destructive helper calls `showDeleteToast(message)` after committing. The toast:
- 6 second duration
- "Undo" button that calls `performUndo()`
- Always shown (not gated on `showUndoRedoToasts` — that setting only controls the post-undo "Undone: X" confirmation)
- Backward-compatible: `useToast` callers that don't pass an `action` still get the plain icon+message toast

**Multi-select batch deletes are ONE undo entry.** In the inbox, `deleteSelectedTasks()` calls `bulkDeleteTasksWithUndo(ids)` instead of looping `deleteTaskWithUndo` per item. One toast, one undo press reverts all.

**Inbox right-click "Delete permanently"** is routed through `bulkDeleteTasksWithUndo([id])` via `ModalManager.vue`. The confirm modal copy says "moves to Trash, recoverable for 30 days" — be honest about semantics.

## 6. When adding a new undoable operation

Follow this template:

```ts
const myDestructiveOpWithUndo = async (entityId: string) => {
  const target = findTarget(entityId)
  if (!target) return

  const handle = await beginOperation({
    type: 'task-update',           // or whichever UndoOperationType applies
    affectedIds: [entityId],
    description: `Update ${target.title}`
  })

  try {
    await store.mutateTarget(entityId, ...)
    await nextTick()
    await commitOperation(handle)
    showDeleteToast(`Updated "${target.title}"`)  // or whichever message
  } catch (error) {
    console.error('❌ myDestructiveOpWithUndo failed:', error)
    throw error
  }
}
```

Then add the case to `performSelectiveUndo` (`undoSingleton.ts:~243`) that knows how to inverse the op from `snapshotBefore`. For task restores, **always use `restoreTaskFromUndo`** — never call `createTask` from a restore branch.

Export the helper from `getUndoSystem()` and `useUnifiedUndoRedo()`.

## 7. Known race architecture — backlog of architectural fixes

These are real but out of scope for individual feature PRs. File against TASK-XXXX:

- **AbortController plumbing.** Track an `AbortController` per queued op so `deleteOperationsByType` can abort in-flight HTTP. Supabase JS supports `.abortSignal(ac.signal)`.
- **Operation intents.** Add `intent: 'normal' | 'undo-restore' | 'force'` to `enqueue()`. Lets the orchestrator choose a different reconciliation strategy for restores. Examples in Replicache, PowerSync.
- **Per-entity mutex.** Hold a `Map<entityId, Promise>` so ops for the same id serialize. Prevents the entire class of races.
- **Event-driven queue.** Replace the 5s `setInterval` with process-on-enqueue + process-after-completion. Restores latency floor to <500ms.
- **Operation coalescing.** Collapse delete→undo→delete into a single net DELETE before enqueueing.
- **Version-aware echo gating.** Track `localVersion` per entity; ignore realtime echoes whose `updated_at` is older than the local optimistic version. Stronger than the current `pendingWrites` Set.
- **Schema-level title default.** `title text NOT NULL DEFAULT 'Untitled Task'` — prevents the "phantom Untitled Task on stale echo" bug from happening at sanitization-on-ingress time.

## 8. Symptoms → likely cause map

| Symptom | Likely cause |
|---|---|
| "15-20s lag after undo before next delete" | Race between orphaned in-flight DELETE and queued CREATE. Use `restoreTaskFromUndo` direct-only path. |
| "Phantom 'Untitled Task' appears after delete" | Stale realtime echo with `title=null` got sanitized on ingress. Check `addPendingWrite` was called BEFORE the optimistic mutation. |
| "Ctrl+Z does nothing from inbox" | Pre-existing fix — handler at `globalKeyboardHandlerSimple.ts` does NOT skip Ctrl+Z when focus is on inbox cards. If it stops working, check the dialog-skip selector list at line ~101. |
| "Toast doesn't appear on delete" | `showDeleteToast` not wired into the helper. Centralizing in `commitOperation` won't work — bypass helpers skip it. Wire to each helper individually. |
| "Permanent delete from inbox can't be undone" | `permanentlyDeleteTaskWithUndo` legacy bug. Until fully validated, route the path through `bulkDeleteTasksWithUndo([id])` (the working soft-delete path). |
| "Console filter swallows my debug logs" | `consoleFilter.ts` line ~205 filters strings containing `[TASK-`. Use `console.warn` or a different prefix. |

## 9. Forbidden patterns (will regress real bugs)

- ❌ Calling `createTask(deletedTask)` from any restore path. Use `restoreTaskFromUndo`.
- ❌ Removing the `bulkMoveToInboxWithUndo` / `rippleShiftWithUndo` bypass of `beginOperation`. BUG-1739 will return.
- ❌ Gating the delete-time toast on `showUndoRedoToasts`. That setting is for the post-undo confirmation toast, not the delete-time one. Gating breaks the only discoverable restore path.
- ❌ Looping `deleteTaskWithUndo` per item in a bulk operation. Causes N toasts and N undo entries. Use `bulkDeleteTasksWithUndo`.
- ❌ Resurrecting `permanentlyDeleteTaskWithUndo` callers without validating the singleton-corruption fix held. Route through bulk soft-delete.
- ❌ Skipping `addPendingWrite(taskId)` before an optimistic local mutation. Realtime echoes will overwrite your local state.
- ❌ Optimistic push into `_rawTasks.value` from outside the store — the type is auto-unwrapped by Pinia setup stores, accessing `.value` from outside is wrong and will silently fail or throw.

## 10. Verification checklist before claiming "done"

Always test these scenarios manually after touching undo:

1. Delete inbox task with Delete key → toast appears with "Undo" → click Undo → task reappears within ~500ms → immediately delete again → second delete also fast (< 500ms before splice).
2. Multi-select 3 inbox tasks → Delete → single toast "Deleted 3 tasks" → Undo → all 3 restored in one press.
3. Right-click inbox task → "Delete permanently" → confirm → toast appears → Undo → task back.
4. Canvas delete a group → toast → Undo → group + children restored.
5. Ctrl+Z and Ctrl+Shift+Z both still work from canvas, calendar, and all-tasks views.
6. `npm run test` passes. `npx vitest run tests/unit/composables/useToast-action.test.ts src/composables/canvas/__tests__/canvasDeleteUndo.test.ts` specifically pass.
7. vue-tsc has no NEW errors on changed files (pre-existing `supabase is possibly null` errors in `clearTombstoneForUndo` are OK).

If any step lags or fails — **do not ship**. The undo path is delicate; failures here are user-trust killers.

---

## Mandatory user verification

Before claiming any undo-related fix is done, request explicit verification from the user with concrete reproduction steps. The undo path has hit "looks fine to me, ships broken" failures multiple times. The user is the final authority — even passing tests do not constitute proof.
