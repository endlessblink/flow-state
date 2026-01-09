---
status: pending
priority: p1
issue_id: 019
tags: [code-review, data-integrity, canvas, race-condition]
dependencies: []
---

# Zombie Group Prevention Has 10-Second Race Window

## Problem Statement

The `recentlyDeletedGroups` Set with a 10-second timeout creates a dangerous race condition window. If Supabase delete takes longer than 10 seconds (network issues), the timeout clears the protection, and a sync cycle could recreate the group from stale cached data.

**Why it matters:** Users may see deleted groups reappear after 10 seconds in poor network conditions, causing confusion and data inconsistency.

## Findings

**Source:** Security Sentinel, Data Integrity Guardian, Architecture Strategist Agents

**Affected Files:**
- `src/composables/canvas/useCanvasActions.ts` (lines 240-248, 379, 419)

**Problematic Code:**
```typescript
// TASK-149 FIX: Add to recentlyDeletedGroups BEFORE any delete operation
if (deps.recentlyDeletedGroups) {
    deps.recentlyDeletedGroups.value.add(section.id)
    setTimeout(() => {
        deps.recentlyDeletedGroups?.value.delete(section.id)
    }, 10000)  // 10 second cleanup - RACE CONDITION
}
```

**Issues:**
1. **Network delay > 10s**: If Supabase delete takes > 10 seconds, protection is removed prematurely
2. **HMR/Tab refresh**: If app refreshes during the 10s window, Set is cleared but group might still be loading from stale source
3. **No persistence**: In-memory Set lost on page refresh
4. **Multiple timers**: Rapid deletions create multiple accumulated timeouts

## Proposed Solutions

### Solution 1: Persist to localStorage (Recommended)

Store deleted IDs in localStorage until confirmed by server.

```typescript
const DELETED_GROUPS_KEY = 'pomoflow-deleted-groups'

function markGroupDeleted(groupId: string) {
    const deleted = JSON.parse(localStorage.getItem(DELETED_GROUPS_KEY) || '[]')
    deleted.push({ id: groupId, deletedAt: Date.now() })
    localStorage.setItem(DELETED_GROUPS_KEY, JSON.stringify(deleted))
}

function isGroupDeleted(groupId: string): boolean {
    const deleted = JSON.parse(localStorage.getItem(DELETED_GROUPS_KEY) || '[]')
    return deleted.some(d => d.id === groupId)
}

function confirmGroupDeleted(groupId: string) {
    const deleted = JSON.parse(localStorage.getItem(DELETED_GROUPS_KEY) || '[]')
    const filtered = deleted.filter(d => d.id !== groupId)
    localStorage.setItem(DELETED_GROUPS_KEY, JSON.stringify(filtered))
}
```

**Pros:** Survives page refresh, no arbitrary timeout
**Cons:** Additional localStorage usage
**Effort:** Medium (2-3 hours)
**Risk:** Low

### Solution 2: Await Supabase Confirmation

Only clear from protection Set after Supabase confirms deletion.

```typescript
try {
    deps.recentlyDeletedGroups.value.add(section.id)
    await canvasStore.deleteSection(section.id)  // Already awaited
    // Clear after confirmed success
    deps.recentlyDeletedGroups.value.delete(section.id)
} catch (e) {
    // Keep in set on failure - will retry later
}
```

**Pros:** Ties cleanup to actual completion
**Cons:** Set could grow unbounded if deletes keep failing
**Effort:** Small (1 hour)
**Risk:** Low-Medium

### Solution 3: Extend Timeout + Exponential Backoff

Increase timeout and add cleanup on component unmount.

```typescript
const ZOMBIE_TIMEOUT = 60000  // 60 seconds instead of 10

// On component unmount, clear all pending timeouts
onBeforeUnmount(() => {
    // Store timeout IDs and clear them
})
```

**Pros:** Simple change
**Cons:** Still arbitrary, just longer window
**Effort:** Small (30 minutes)
**Risk:** Medium

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- src/composables/canvas/useCanvasActions.ts
- src/views/CanvasView.vue (recentlyDeletedGroups ref)

**Components:** Canvas actions, group deletion

**Database Changes:** None

## Acceptance Criteria

- [ ] Deleted groups do not reappear after refresh
- [ ] Deleted groups do not reappear during slow network conditions
- [ ] Protection persists across page refresh
- [ ] No memory leak from accumulated timeouts

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-09 | Finding identified | Security and Data Integrity review |

## Resources

- Related Tasks: TASK-149 (zombie group prevention)
- Similar Pattern: canvasStateLock.ts (uses localStorage for persistence)
