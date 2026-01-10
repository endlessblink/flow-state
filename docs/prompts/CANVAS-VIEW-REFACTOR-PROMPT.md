# Canvas System Deep Refactor Prompt

## Overview

**Current State:**
- CanvasView.vue: **388 LOC** ✅ (reduced from 2,098)
- Canvas Composables: **34 files, 6,962 LOC**
- Position Lock Bandaid: **452 LOC** (masks real sync bug)
- Dead Code: **1,312 LOC** (unused composables + duplicates)
- Console.log: **133+ statements**
- `any` Types: **57 instances**
- Bug Workarounds: **8+ in code comments**

**Target:**
- Remove dead code: -1,312 LOC
- Fix root sync issue: Remove position lock bandaid
- Console.log: 0
- Type safety: 0 `any` types
- Health Score: 6.0/10 → 8.5+/10

---

## ⚠️ CRITICAL: Vue Flow Rules (DO NOT VIOLATE)

**NEVER extract from CanvasView.vue:**
- `v-model:nodes` and `v-model:edges` bindings
- Vue Flow event handlers (`@node-drag-stop`, etc.)
- `useVueFlow()` composable usage
- Node/edge synchronization core logic

---

## Phase 1: Delete Dead Code (1,312 LOC)

### 1A. Delete Unused Composables (746 LOC)

These files have **zero imports** anywhere:

```bash
# Verify they're unused:
for f in useCanvasFiltering useCanvasInteractionHandlers useCanvasInteractivity useCanvasResourceManager; do
  echo "=== $f ==="
  grep -r "$f" src/ --include="*.ts" --include="*.vue" | grep -v "composables/canvas/$f"
done

# Delete if confirmed unused:
rm src/composables/canvas/useCanvasFiltering.ts
rm src/composables/canvas/useCanvasInteractionHandlers.ts
rm src/composables/canvas/useCanvasInteractivity.ts
rm src/composables/canvas/useCanvasResourceManager.ts
```

### 1B. Delete Duplicate Sync Folder (566 LOC)

The `sync/` subfolder is never imported:

```bash
# Verify:
grep -r "canvas/sync" src/

# Delete:
rm -rf src/composables/canvas/sync/
```

---

## Phase 2: Fix Root Cause - Sync Race Condition

### Problem

The **7-second position lock** (`src/utils/canvasStateLock.ts`, 452 LOC) exists because:

1. User drags a node
2. Supabase sync pulls stale data before local push completes
3. `syncNodes()` overwrites with old position

The lock is a **bandaid** that masks the real bug.

### Solution: Optimistic Updates with Conflict Resolution

Replace the lock system with proper optimistic updates:

```typescript
// src/composables/canvas/useCanvasOptimisticSync.ts

export function useCanvasOptimisticSync() {
  // Track pending local changes
  const pendingChanges = new Map<string, {
    type: 'task' | 'group',
    position: { x: number, y: number },
    timestamp: number,
    synced: boolean
  }>()

  // When user drags a node:
  const trackLocalChange = (id: string, type: 'task' | 'group', position: { x: number, y: number }) => {
    pendingChanges.set(id, {
      type,
      position,
      timestamp: Date.now(),
      synced: false
    })
  }

  // When receiving sync data:
  const shouldAcceptRemoteChange = (id: string, remoteTimestamp: number): boolean => {
    const pending = pendingChanges.get(id)
    if (!pending) return true // No local change, accept remote

    // If remote is newer than our local change, accept it
    if (remoteTimestamp > pending.timestamp) {
      pendingChanges.delete(id)
      return true
    }

    // Our local change is newer, reject remote
    return false
  }

  // When local push succeeds:
  const markSynced = (id: string) => {
    const pending = pendingChanges.get(id)
    if (pending) {
      pending.synced = true
      // Remove after confirmation window
      setTimeout(() => pendingChanges.delete(id), 1000)
    }
  }

  return {
    trackLocalChange,
    shouldAcceptRemoteChange,
    markSynced,
    pendingChanges
  }
}
```

### Migration Steps

1. Create `useCanvasOptimisticSync.ts`
2. Integrate with `useCanvasSync.ts` and `useCanvasDragDrop.ts`
3. Test: drag node, verify position persists without 7s lock
4. Delete `src/utils/canvasStateLock.ts` (452 LOC)

---

## Phase 3: Remove Console Pollution (133 statements)

### Files with Console Statements

```bash
# Get counts per file:
grep -rn "console\.\(log\|warn\|error\|debug\)" src/composables/canvas/*.ts | \
  cut -d: -f1 | sort | uniq -c | sort -rn
```

### Removal Strategy

**Keep**: Error handling that uses `handleError()` utility
**Remove**: All debugging logs

```typescript
// REMOVE patterns like:
console.log('[CanvasCore] Syncing nodes:', { groups, tasks })
console.log(`🔒 [CANVAS-LOCK] Task ${taskId} locked...`)
console.log(`✅ [TASK-158] Delete completed...`)

// KEEP patterns that use proper error handling:
import { handleError, ErrorCategory } from '@/utils/errorHandler'
handleError(error, ErrorCategory.CANVAS, 'Operation failed')
```

---

## Phase 4: Fix Type Safety (57 `any` types)

### Find All Instances

```bash
grep -rn ": any\|as any\|<any>" src/composables/canvas/*.ts
```

### Common Patterns to Fix

```typescript
// BEFORE
const handleEvent = (event: any) => { ... }

// AFTER
import type { NodeDragEvent } from '@vue-flow/core'
const handleEvent = (event: NodeDragEvent) => { ... }
```

```typescript
// BEFORE
const nodes = ref<any[]>([])

// AFTER
import type { Node } from '@vue-flow/core'
const nodes = ref<Node[]>([])
```

---

## Phase 5: Clean Up Bug Workarounds

### Bug References Still in Code

| Bug ID | File | Action |
|--------|------|--------|
| BUG-007 | useCanvasEvents.ts | Verify fixed, remove comment |
| BUG-022 | useCanvasConnections.ts | Verify fixed, remove comment |
| BUG-025 | useCanvasGroupDrag.ts | Verify fixed, remove comment |
| BUG-047 | useCanvasTaskCounts.ts | Verify fixed, remove comment |
| BUG-091 | useCanvasGroupActions.ts | Verify fixed, remove comment |
| BUG-152 | useCanvasEvents.ts (6x) | Consolidate fixes, clean comments |
| BUG-153 | useNodeAttachment.ts | Verify fixed, remove comment |
| BUG-184 | useCanvasDragDrop.ts | Verify fixed, remove comment |

### For Each Bug:

1. Check if the bug is in MASTER_PLAN and marked DONE
2. If DONE: Remove the `// BUG-XXX FIX:` comments
3. If NOT DONE: Keep comment, add to MASTER_PLAN if missing

---

## Phase 6: Verification Checklist

After all phases:

- [ ] **Build passes**: `npm run build`
- [ ] **No dead code**: `rm -rf` commands executed
- [ ] **No console.log**: `grep -r "console\." src/composables/canvas/ | wc -l` = 0
- [ ] **No position lock file**: `ls src/utils/canvasStateLock.ts` = not found
- [ ] **Type safety**: `grep -r ": any\|as any" src/composables/canvas/ | wc -l` = 0

### Functional Tests

- [ ] Drag task to new position → refresh → position persists
- [ ] Drag group → child tasks move with it
- [ ] Create edge between nodes → edge persists
- [ ] Delete group → tasks return to inbox
- [ ] Resize group → new size persists

---

## Success Criteria

| Metric | Before | Target |
|--------|--------|--------|
| Dead code | 1,312 LOC | 0 |
| Console.log | 133+ | 0 |
| Position lock bandaid | 452 LOC | 0 (deleted) |
| `any` types | 57 | 0 |
| Bug workaround comments | 8+ | 0 |
| Health Score | 6.0/10 | 8.5+/10 |

---

## Order of Operations

1. **Phase 1**: Delete dead code (lowest risk, immediate -1,312 LOC)
2. **Phase 3**: Remove console.log (low risk)
3. **Phase 5**: Clean bug comments (low risk)
4. **Phase 4**: Fix `any` types (medium risk)
5. **Phase 2**: Fix sync race condition (highest risk, most impactful)

---

## Files Summary

### Delete

| File | LOC | Reason |
|------|-----|--------|
| `useCanvasFiltering.ts` | 98 | Unused |
| `useCanvasInteractionHandlers.ts` | 360 | Unused |
| `useCanvasInteractivity.ts` | 69 | Unused |
| `useCanvasResourceManager.ts` | 219 | Unused |
| `sync/useCanvasNodeSync.ts` | 467 | Duplicate |
| `sync/useCanvasEdgeSync.ts` | 99 | Duplicate |
| `canvasStateLock.ts` | 452 | Bandaid (after Phase 2) |
| **Total** | **1,764** | |

### Create

| File | Purpose |
|------|---------|
| `useCanvasOptimisticSync.ts` | Proper sync conflict resolution |

### Modify (Console Cleanup)

All 26 composables with console statements.
