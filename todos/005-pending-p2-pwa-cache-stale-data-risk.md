---
status: pending
priority: p2
issue_id: 005
tags: [code-review, architecture, pwa, caching, supabase]
dependencies: []
---

# PWA Caching May Serve Stale Supabase Data

## Problem Statement

The PWA configuration caches Supabase REST API responses for 24 hours. This can cause stale task data to be served after Supabase Realtime pushes updates, creating data inconsistency.

**Why it matters:** Users may see outdated task data after syncing, defeating the purpose of real-time sync.

## Findings

**Source:** Architecture Strategist Agent

**Affected File:** `vite.config.ts` (lines 43-84)

**Current Configuration:**
```typescript
{
  urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
  handler: 'NetworkFirst',
  options: {
    cacheName: 'supabase-api-cache',
    networkTimeoutSeconds: 3,
    expiration: {
      maxEntries: 100,
      maxAgeSeconds: 86400  // 24 hours - TOO LONG!
    }
  }
}
```

**Issues:**
1. 24-hour cache expiry for task data is too long
2. Supabase Realtime pushes updates, but cached responses don't reflect them
3. WebSocket connections not explicitly excluded from caching

## Proposed Solutions

### Solution 1: Reduce Cache TTL (Recommended)

```typescript
{
  urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
  handler: 'NetworkFirst',
  options: {
    cacheName: 'supabase-api-cache',
    networkTimeoutSeconds: 3,
    expiration: {
      maxEntries: 100,
      maxAgeSeconds: 300  // 5 minutes instead of 24 hours
    }
  }
}
```

**Pros:** Reduces stale data window significantly
**Cons:** More network requests when offline
**Effort:** Small
**Risk:** Low

### Solution 2: Use StaleWhileRevalidate for Reads

```typescript
{
  urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
  handler: 'StaleWhileRevalidate',  // Serve cache, update in background
  options: {
    cacheName: 'supabase-api-cache',
    expiration: { maxAgeSeconds: 300 }
  }
}
```

**Pros:** Fast response + background freshness
**Cons:** Brief window of stale data
**Effort:** Small
**Risk:** Low

### Solution 3: Exclude Task Endpoints from Caching

```typescript
// Don't cache task data at all - rely on Supabase Realtime
{
  urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/tasks.*/i,
  handler: 'NetworkOnly'
}
```

**Pros:** Always fresh task data
**Cons:** No offline support for tasks
**Effort:** Small
**Risk:** Medium (affects offline UX)

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- vite.config.ts (PWA workbox configuration)

**Components:** Service worker, offline caching

## Acceptance Criteria

- [ ] Task data cache TTL reduced to ≤5 minutes
- [ ] Real-time updates not overridden by stale cache
- [ ] Offline functionality still works for reasonable period
- [ ] Test: Edit task on device A, verify device B sees update within cache window

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-08 | Finding identified | Architecture Strategist review |

## Resources

- Workbox strategies: https://developer.chrome.com/docs/workbox/modules/workbox-strategies/
