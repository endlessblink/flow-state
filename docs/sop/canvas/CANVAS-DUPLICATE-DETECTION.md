# Canvas Duplicate Detection System (TASK-260)

## Overview

Comprehensive diagnostic system to detect and trace duplicate task/group IDs across the entire data pipeline from Supabase to Vue Flow nodes.

## Problem Definition

**Duplicate bug**: Two or more Vue Flow nodes representing the same underlying `task.id` or `group.id`, where only one should exist (not the intentional "Duplicate task" feature).

## Data Flow Pipeline

```
┌──────────────┐    ┌─────────────────────┐    ┌──────────────────┐    ┌────────────┐
│  Supabase    │ → │   Task Store        │ → │  Canvas Sync     │ → │ Vue Flow   │
│  (tasks DB)  │    │   (_rawTasks ref)   │    │  (node builder)  │    │ (nodes)    │
└──────────────┘    └─────────────────────┘    └──────────────────┘    └────────────┘
```

## Diagnostic Tags by Layer

| Layer | Console Tag | File | Meaning |
|-------|-------------|------|---------|
| **Supabase Load** | `[SUPABASE-DUPLICATES]` | `invariants.ts` | DB returned duplicate task IDs |
| **Supabase Load** | `[SUPABASE-GROUP-DUPLICATES]` | `invariants.ts` | DB returned duplicate group IDs |
| **Realtime Sync** | `[SYNC-DUPLICATE-CREATED]` | `tasks.ts` | Realtime tried to push duplicate |
| **Realtime Sync** | `[SYNC-DUPLICATE-UNEXPECTED]` | `tasks.ts` | Duplicate appeared unexpectedly |
| **Store Watcher** | `[STORE-DUPLICATE-DETECTED]` | `taskStates.ts` | Store contains duplicate task IDs |
| **Canvas Pre-Build** | `[ASSERT-FAILED] Duplicate groupIds` | `useCanvasSync.ts` | Groups have duplicates before node creation |
| **Canvas Pre-Build** | `[ASSERT-FAILED] Duplicate taskIds` | `useCanvasSync.ts` | Tasks have duplicates before node creation |
| **Node Builder** | `[DUPLICATE-NODES]` | `useCanvasSync.ts` | Final nodes contain duplicates |

## Debugging Workflow

1. Open browser DevTools → Console
2. Filter by: `DUPLICATE` or `ASSERT-FAILED`
3. Reproduce the duplication scenario
4. The **first tag that fires** indicates where duplicates originate

### Interpretation Guide

| First Tag | Root Cause Location |
|-----------|---------------------|
| `[SUPABASE-DUPLICATES]` | Database has duplicate rows → Run cleanup SQL |
| `[SYNC-DUPLICATE-CREATED]` | Realtime subscription race condition |
| `[STORE-DUPLICATE-DETECTED]` | Store mutation bug in `createTask`/`loadFromDatabase` |
| `[ASSERT-FAILED]` in useCanvasSync | Bug in how tasks/groups are passed to sync |
| `[DUPLICATE-NODES]` only | Node building logic issue |

## Database Cleanup (Manual)

If duplicates exist in Supabase, run these queries in SQL Editor:

### Find Duplicates
```sql
-- Tasks
SELECT id, COUNT(*) AS cnt FROM tasks GROUP BY id HAVING COUNT(*) > 1;

-- Groups
SELECT id, COUNT(*) AS cnt FROM groups GROUP BY id HAVING COUNT(*) > 1;
```

### Remove Duplicates (Keep Latest)
```sql
-- Tasks
WITH duplicates AS (
  SELECT id, ctid, ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC) as rn
  FROM tasks WHERE id IN (SELECT id FROM tasks GROUP BY id HAVING COUNT(*) > 1)
)
DELETE FROM tasks WHERE ctid IN (SELECT ctid FROM duplicates WHERE rn > 1);

-- Groups
WITH duplicates AS (
  SELECT id, ctid, ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC) as rn
  FROM groups WHERE id IN (SELECT id FROM groups GROUP BY id HAVING COUNT(*) > 1)
)
DELETE FROM groups WHERE ctid IN (SELECT ctid FROM duplicates WHERE rn > 1);
```

## Key Files

- `src/utils/canvas/invariants.ts` - Central `assertNoDuplicateIds()` helper
- `src/stores/tasks.ts` - Realtime sync duplicate prevention
- `src/stores/tasks/taskStates.ts` - Store watcher
- `src/composables/canvas/useCanvasSync.ts` - Node builder checks

## Race Condition Fix

The realtime handler in `tasks.ts:updateTaskFromSync` prevents duplicate push:

```typescript
// Before push, verify task doesn't already exist (race protection)
const existingCount = _rawTasks.value.filter(t => t.id === id).length
if (existingCount > 0) {
  // UPDATE instead of PUSH - logs [SYNC-DUPLICATE-CREATED]
}
```

---

**Created**: TASK-260 (January 2026)
**Status**: Active diagnostic system
