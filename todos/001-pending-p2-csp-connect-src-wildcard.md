---
status: pending
priority: p2
issue_id: 001
tags: [code-review, security, csp]
dependencies: []
---

# CSP Connect-Src Uses Wildcards (Security Regression)

## Problem Statement

The Content Security Policy (CSP) `connect-src` directive now allows connections to ANY HTTP or HTTPS endpoint using broad wildcards (`'http:'`, `'https:'`). This defeats the purpose of CSP for network request control and represents a **security regression**.

**Why it matters:** This enables potential data exfiltration to attacker-controlled servers, allows XSS payloads to beacon to arbitrary endpoints, and permits SSRF-like attacks from the client side.

## Findings

**Source:** Security Sentinel Agent

**Affected Files:**
- `src/utils/cspManager.ts` (lines 97-98, 192)
- `src/utils/securityHeaders.ts` (line 51)

**Previous State (Secure):**
```typescript
'connect-src': [
  "'self'",
  'http://84.46.253.137:5984', // CouchDB server - SPECIFIC
  // Note: httpbin.org removed in TASK-1258
]
```

**Current State (Insecure):**
```typescript
'connect-src': [
  "'self'",
  'http:', // Development: allow HTTP connections - WILDCARD
  'https:', // Allow HTTPS connections - WILDCARD
]
```

## Proposed Solutions

### Solution 1: Restore Explicit Allowlist (Recommended)
Replace wildcards with explicit allowed domains.

```typescript
'connect-src': [
  "'self'",
  'wss:',
  'https://*.supabase.co',  // Supabase API and Realtime
  'https://api.github.com',
  'https://raw.githubusercontent.com'
]
```

**Pros:** Proper security, explicit trust boundaries
**Cons:** Requires updating when adding new external services
**Effort:** Small
**Risk:** Low

### Solution 2: Environment-Based CSP
Use different CSP for dev vs production.

```typescript
const connectSrc = import.meta.env.DEV
  ? ["'self'", 'http:', 'https:']  // Permissive for dev
  : ["'self'", 'https://*.supabase.co', 'wss:']  // Strict for prod
```

**Pros:** Development flexibility, production security
**Cons:** More complex CSP logic
**Effort:** Medium
**Risk:** Low

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- src/utils/cspManager.ts
- src/utils/securityHeaders.ts

**Components:** CSP configuration

**Database Changes:** None

## Acceptance Criteria

- [ ] Production CSP does not include `'http:'` or `'https:'` wildcards
- [ ] All legitimate external services are explicitly allowlisted
- [ ] Application works correctly with restricted CSP
- [ ] No CORS/CSP violations in console during normal use

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-08 | Finding identified | Security Sentinel review of uncommitted changes |

## Resources

- PR/Issue: N/A (uncommitted changes review)
- MDN CSP Reference: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
