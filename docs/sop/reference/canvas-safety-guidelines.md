# SOP: Canvas Development Safety Guidelines

**Date**: December 4, 2025
**Status**: Active - MUST READ before modifying CanvasView.vue
**Related**: `docs/🐛 debug/sop/canvas-implementation/README.md`

---

## Overview

This SOP documents critical lessons learned from the December 2-4, 2025 canvas debugging crisis. Following these guidelines prevents the reintroduction of bugs that caused multi-day debugging sessions.

**Context**: After Dec 1 checkpoint, multiple commits broke canvas drag-drop functionality. It took 3 days and extensive debugging to identify root causes and restore working functionality.

---

## Patterns That BREAK Canvas (NEVER DO THESE)

| Anti-Pattern | Why It Breaks Things | What Happened |
|--------------|---------------------|---------------|
| `watch()` with `deep: true` on task arrays | Causes infinite loops, performance death | Dec 2 regression |
| `watchEffect()` for initial task loading | Fires before data ready, timing issues | Commit `2513465` broke canvas |
| Direct DOM manipulation in Vue Flow | Vue Flow loses track of state | Commit `7b7392b` required disabling `cleanupStaleNodes` |
| Bundling unrelated changes | Impossible to rollback cleanly | Commit `55fb45d` = 557 lines, couldn't cherry-pick |
| Adding new sync mechanisms | Competing systems cause race conditions | Multiple sync paths = chaos |
| Bypassing guard flags | Sync during drag = glitches | Guards exist for a reason |

### Detailed Explanations

#### 1. Deep Watchers on Task Arrays

```typescript
// ❌ NEVER DO THIS
watch(
  () => taskStore.tasks,
  () => syncNodes(),
  { deep: true }  // DISASTER: infinite loops, performance death
)
```

**Why it breaks**: Deep watchers traverse entire object trees on every change. When `syncNodes()` updates nodes, Vue detects changes, triggers watcher again, creating infinite loops.

#### 2. watchEffect for Initial Loading

```typescript
// ❌ NEVER DO THIS
watchEffect(() => {
  if (taskStore.tasks.length > 0) {
    syncNodes()  // DISASTER: fires before Vue Flow ready
  }
})
```

**Why it breaks**: `watchEffect` runs immediately and on every dependency change. It fires before Vue Flow is initialized, before data is fully loaded, causing timing chaos.

#### 3. Direct DOM Manipulation

```typescript
// ❌ NEVER DO THIS
const cleanupStaleNodes = () => {
  document.querySelectorAll('.vue-flow__node').forEach(el => {
    if (!nodeExists(el.id)) el.remove()  // DISASTER: Vue Flow loses track
  })
}
```

**Why it breaks**: Vue Flow maintains its own virtual DOM state. Direct DOM manipulation desynchronizes Vue Flow's internal state from actual DOM.

#### 4. Bundled Commits

```bash
# ❌ NEVER DO THIS
git commit -m "fix: calendar + canvas + cleanup"  # 557 lines, 3 unrelated systems
```

**Why it breaks**: When something breaks, you can't isolate which change caused it. Cherry-picking becomes impossible. Rollback means losing all changes.

---

## Safe Patterns (ALWAYS USE THESE)

| Safe Pattern | Why It Works | Example |
|--------------|--------------|---------|
| Hash-based watchers | Single string comparison, no deep traversal | `tasks.map(t => \`${t.id}:${t.status}\`).join('|')` |
| `flush: 'post'` | Lets Vue Flow finish its updates first | All canvas watchers use this |
| `batchedSyncNodes()` | Respects all guards, proper batching | Never call `syncNodes()` directly |
| `resourceManager.addWatcher()` | Proper cleanup on unmount | Prevents memory leaks |
| One feature per commit | Easy rollback, clear history | Test between each commit |

### Safe Watcher Implementation

```typescript
// ✅ CORRECT: Hash-based watcher
resourceManager.addWatcher(
  watch(
    // Hash of relevant properties - single string comparison
    () => taskStore.tasks.map(t => `${t.id}:${t.title}:${t.status}:${t.priority}`).join('|'),
    () => {
      batchedSyncNodes('normal')  // Uses batching and respects guards
    },
    { flush: 'post' }  // Lets Vue Flow finish first
  )
)
```

### Safe Cache Hash Implementation

```typescript
// ✅ CORRECT: Include mutable properties in cache hash
const currentHash = currentTasks.map(t => `${t.id}:${t.isInInbox}:${t.status}`).join('|')

// ❌ WRONG: Only using IDs misses property changes
const currentHash = currentTasks.map(t => t.id).join('|')
```

---

## Git History Reference (Debugging Hell Commits)

These commits caused or contributed to the Dec 2-4 crisis:

| Commit | What Went Wrong | Lesson |
|--------|-----------------|--------|
| `2513465` | "fix: Add watchEffect for canvas initial task loading" - broke timing | Don't use watchEffect for canvas sync |
| `7b7392b` | Had to disable `cleanupStaleNodes` due to DOM manipulation issues | Never manipulate DOM directly |
| `55fb45d` | Bundled 557 lines of CanvasView.vue + calendar = rollback impossible | One feature per commit |

---

## Perplexity-Validated Safety Rules

These rules were validated through Perplexity research during the debugging process:

1. **Hash-based watchers are safe** - No loops if callback doesn't modify source data
2. **Cache hashes MUST include mutable properties** - Vue only knows what you check
3. **`flush: 'post'` is correct** - Allows Vue Flow to complete first
4. **Vue Flow needs array replacement** - Not mutation, for change detection

### Perplexity Research Summary

| Question Asked | Answer | Confidence |
|----------------|--------|------------|
| Is hash-based watcher safe from loops? | YES - no loops if callback doesn't modify source | High |
| Should cache hash include mutable props? | YES - Vue only knows about properties you check | High |
| Does Vue Flow need array replacement? | YES - tracks node reference changes | High |
| Is `flush: 'post'` correct? | YES - allows Vue Flow to finish first | High |

---

## Pre-Flight Checklist: Before Touching CanvasView.vue

**MANDATORY**: Complete this checklist before making ANY changes to `src/views/CanvasView.vue`:

### 1. Create Backup Point
```bash
git stash push -m "pre-canvas-change-backup-$(date +%Y%m%d-%H%M%S)"
# OR
git commit -m "checkpoint: before canvas changes"
```

### 2. Verify Current Behavior
```bash
# Kill existing processes and start fresh
npm run kill && PORT=5546 npm run dev
```

Then test with Playwright or manually:
- [ ] Drag task from inbox to canvas - task appears immediately
- [ ] Edit task title - updates on canvas node
- [ ] Change task status - visual updates
- [ ] Change task priority - indicator updates
- [ ] CPU usage stays normal (< 30% idle)

### 3. Make ONE Small Change
- Maximum 10-20 lines per commit
- Touch only ONE system at a time
- Never bundle canvas + calendar + anything else

### 4. Test Immediately After Change
- [ ] Repeat all tests from step 2
- [ ] Check browser console for errors
- [ ] Verify no performance degradation

### 5. If Broken - Rollback Immediately
```bash
# Option 1: Stash pop
git stash pop

# Option 2: Checkout file
git checkout -- src/views/CanvasView.vue

# Option 3: Reset to last good commit
git reset --hard HEAD~1
```

### 6. Commit Single Feature
```bash
git add src/views/CanvasView.vue
git commit -m "fix(canvas): [single specific change description]"
```

---

## Guard Flags Reference

CanvasView.vue uses these guard flags to prevent race conditions. **NEVER bypass them**:

| Flag | Purpose | Location |
|------|---------|----------|
| `isNodeDragging` | Prevents sync during drag operations | Line ~2562 |
| `isSyncing` | Prevents concurrent sync operations | Line ~2480 |
| `isHandlingNodeChange` | Prevents recursive node change handling | Line ~2520 |

### Correct Usage

```typescript
// ✅ CORRECT: Check guards before sync
const batchedSyncNodes = (priority: 'high' | 'normal' | 'low') => {
  if (isNodeDragging.value) return  // Respect guard
  if (isSyncing.value) return       // Respect guard
  // ... proceed with sync
}

// ❌ WRONG: Bypassing guards
const forceSync = () => {
  syncNodes()  // Ignores all guards - WILL cause bugs
}
```

---

## Canvas Auto-Update Fix Reference (Dec 4, 2025)

The successful fix that resolved the auto-update issues:

### Fix 1: Cache Hash (Line ~664)
```typescript
// Include isInInbox and status in hash to detect property changes
const currentHash = currentTasks.map(t => `${t.id}:${t.isInInbox}:${t.status}`).join('|')
```

### Fix 2: Property Watcher (After Line ~2039)
```typescript
resourceManager.addWatcher(
  watch(
    () => taskStore.tasks.map(t => `${t.id}:${t.title}:${t.status}:${t.priority}`).join('|'),
    () => batchedSyncNodes('normal'),
    { flush: 'post' }
  )
)
```

**Commit Reference**: `d41c834` - "fix(canvas): Auto-update canvas without page refresh - restoration checkpoint"

---

## Testing Requirements

### Regression Test Suite

After ANY canvas change, verify ALL of these:

| Test | Expected Result |
|------|-----------------|
| Drag task on canvas | Smooth, no glitches |
| Multi-select tasks | Works correctly |
| Section collapse/expand | Works correctly |
| Undo/redo | Works correctly |
| Create new task | Appears correctly |
| Delete task | Disappears correctly |
| CPU during idle | < 30% |
| Console errors | None |

### Playwright Test Commands

```bash
# Run canvas-specific tests
npx playwright test tests/canvas*.spec.ts

# Run with visual feedback
npx playwright test tests/canvas*.spec.ts --headed
```

---

## Emergency Recovery

If canvas is completely broken and normal rollback fails:

### Option 1: Restore from Known Good Checkpoint
```bash
git checkout d41c834 -- src/views/CanvasView.vue
```

### Option 2: Full Reset to Last Known Good State
```bash
git reset --hard d41c834  # Dec 4, 2025 checkpoint
npm run kill && PORT=5546 npm run dev
```

### Option 3: Compare Against Backup
```bash
# List available backups
ls src/views/CanvasView.vue.backup*

# Diff against backup
diff src/views/CanvasView.vue src/views/CanvasView.vue.backup
```

---

## Summary: The Golden Rules

1. **Use hash-based watchers** - Never `deep: true`
2. **Always `flush: 'post'`** - Let Vue Flow finish first
3. **Never bypass guards** - They prevent race conditions
4. **One feature per commit** - Enable clean rollback
5. **Test after every change** - Catch regressions immediately
6. **Never touch DOM directly** - Vue Flow owns the DOM

---

**Last Updated**: December 4, 2025
**Maintained By**: Development Team
**Safe Checkpoint**: `d41c834` (Dec 4, 2025)
