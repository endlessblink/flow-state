---
status: pending
priority: p3
issue_id: 008
tags: [code-review, patterns, production, logging]
dependencies: []
---

# Stub Files Emit Console Warnings in Production

## Problem Statement

The legacy stub files (`useDatabase.ts`, `useReliableSyncManager.ts`) emit `console.warn` and `console.log` messages in production, polluting the console.

**Why it matters:** Production console should be clean; these warnings confuse users who open dev tools.

## Findings

**Source:** Code Simplicity Reviewer Agent

**Affected Files:**
- `src/composables/useDatabase.ts` (5 console.warn calls)
- `src/composables/useReliableSyncManager.ts` (2 console.log calls)

**Example:**
```typescript
clear: async () => console.warn('[useDatabase] STUB: Use Supabase directly'),
```

## Proposed Solutions

### Solution 1: Wrap in DEV Check (Recommended)

```typescript
clear: async () => {
  if (import.meta.env.DEV) {
    console.warn('[useDatabase] STUB: Use Supabase directly')
  }
},
```

**Pros:** Clean production console, helpful dev warnings
**Cons:** Slightly more verbose code
**Effort:** Small
**Risk:** None

### Solution 2: Convert to No-ops

```typescript
clear: async () => {},
```

**Pros:** Simplest solution
**Cons:** Loses dev guidance
**Effort:** Trivial
**Risk:** None

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- src/composables/useDatabase.ts
- src/composables/useReliableSyncManager.ts

## Acceptance Criteria

- [ ] No console warnings from stubs in production build
- [ ] Dev mode still shows helpful warnings
- [ ] Test: `npm run build && npm run preview`, check console

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-08 | Finding identified | Code Simplicity review |
