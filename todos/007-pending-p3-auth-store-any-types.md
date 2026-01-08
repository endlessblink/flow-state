---
status: pending
priority: p3
issue_id: 007
tags: [code-review, patterns, typescript, type-safety]
dependencies: []
---

# Auth Store Still Uses `catch (e: any)` Pattern

## Problem Statement

The `src/stores/auth.ts` file still uses the legacy `catch (e: any)` pattern in 7 locations, while `useSupabaseDatabase.ts` has been properly migrated to `catch (e: unknown)`.

**Why it matters:** Inconsistent error handling, type safety issues, and doesn't follow TypeScript best practices.

## Findings

**Source:** Pattern Recognition Specialist Agent

**Affected File:** `src/stores/auth.ts` (lines 73, 142, 169, 186, 207, 239, 258)

**Legacy Pattern:**
```typescript
} catch (e: any) {
    error.value = e
    throw e
}
```

**Correct Pattern (from useSupabaseDatabase.ts):**
```typescript
} catch (e: unknown) {
    handleError(e, 'context')
}

const handleError = (error: unknown, context: string) => {
    const err = error instanceof Error ? error : new Error(String(error))
    // ...
}
```

## Proposed Solutions

### Solution 1: Migrate to `unknown` with Type Guard (Recommended)

```typescript
// Add helper function
const handleAuthError = (error: unknown, context: string): Error => {
  const err = error instanceof Error ? error : new Error(String(error))
  console.error(`Auth error (${context}):`, err.message)
  return err
}

// Usage
} catch (e: unknown) {
    error.value = handleAuthError(e, 'signIn')
    throw error.value
}
```

**Pros:** Type-safe, consistent with other stores
**Cons:** Requires changes to 7 catch blocks
**Effort:** Small
**Risk:** Low

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- src/stores/auth.ts

## Acceptance Criteria

- [ ] All `catch (e: any)` replaced with `catch (e: unknown)`
- [ ] Proper type narrowing applied
- [ ] Error handling still works correctly
- [ ] Build passes with no type errors

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-08 | Finding identified | Pattern Recognition review |

## Resources

- TypeScript handbook: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
