---
status: pending
priority: p3
issue_id: 018
tags: [code-review, performance, code-quality]
dependencies: []
---

# Debug Logging Not Gated by Environment

## Problem Statement

TASK-141 and TASK-142 debug logging always executes string formatting operations even though the console filter suppresses output. This wastes CPU cycles in production.

**Why it matters:** While the console filter prevents logs from appearing, the string concatenation and `.map()` operations still run. This is unnecessary overhead.

## Findings

**Source:** Performance Oracle, Code Simplicity Reviewer Agents

**Affected Files:**
- `src/composables/useSupabaseDatabase.ts` (lines 217-224, 279-301)
- `src/composables/canvas/useCanvasSync.ts` (lines 138-147)

**Example - Always Executes:**
```typescript
// This runs every time, even in production:
console.log(`📥 [TASK-142] LOADED ${tasksWithPos.length} tasks with positions from Supabase:`,
    tasksWithPos.map((d: any) => ({ id: d.id?.substring(0, 8), pos: d.position })))
// The .map() runs regardless of whether log is filtered
```

## Proposed Solutions

### Solution 1: Gate with DEV Check (Recommended)

```typescript
if (import.meta.env.DEV) {
    console.log(`📥 [TASK-142] LOADED ${tasksWithPos.length} tasks...`)
}
```

**Pros:** Zero overhead in production
**Cons:** Need to add check to each log
**Effort:** Small (30 minutes)
**Risk:** None

### Solution 2: Use Lazy Evaluation Helper

```typescript
// Create helper
const devLog = (message: () => string) => {
    if (import.meta.env.DEV) {
        console.log(message())
    }
}

// Usage
devLog(() => `📥 [TASK-142] LOADED ${tasksWithPos.length} tasks...`)
```

**Pros:** Cleaner syntax, guaranteed lazy evaluation
**Cons:** Slightly more complex
**Effort:** Medium
**Risk:** None

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- src/composables/useSupabaseDatabase.ts
- src/composables/canvas/useCanvasSync.ts

**Components:** Debug logging infrastructure

**Database Changes:** None

## Acceptance Criteria

- [ ] TASK-141/142 debug logs don't execute in production
- [ ] Debug capability retained in development
- [ ] No performance regression in production builds

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-08 | Finding identified | Performance Oracle review |

## Resources

- Related Tasks: TASK-141, TASK-142
- Console Filter: src/utils/consoleFilter.ts
