# Fix: Test Configuration (Vitest/Playwright Conflict)

**Priority**: P0-CRITICAL
**Time Estimate**: 15 minutes
**Dependencies**: None

---

## Problem

Vitest is running Playwright tests, causing 63 test failures with:
```
Error: Playwright Test did not expect test.describe() to be called here.
```

**Root Cause**: `vitest.config.ts` includes pattern `tests/**/*.{test,spec}.*` which picks up Playwright's `.spec.ts` files.

---

## Files to Modify

### 1. `vitest.config.ts`

**Current** (line 17):
```typescript
include: ['tests/**/*.{test,spec}.{js,ts,jsx,tsx}', 'src/**/__tests__/**/*.{js,ts,jsx,tsx}'],
```

**Change to**:
```typescript
include: ['tests/**/*.test.{js,ts,jsx,tsx}', 'src/**/__tests__/**/*.{js,ts,jsx,tsx}'],
```

Also update the unit project include (line 28):
```typescript
// Current:
include: ['tests/**/*.{test,spec}.{js,ts,jsx,tsx}', 'src/**/__tests__/**/*.{js,ts,jsx,tsx}'],

// Change to:
include: ['tests/**/*.test.{js,ts,jsx,tsx}', 'src/**/__tests__/**/*.{js,ts,jsx,tsx}'],
```

---

## Verification

```bash
# Step 1: Run Vitest (should only run .test.ts files)
npm test

# Expected: No Playwright errors, only actual test results

# Step 2: Run Playwright separately
npx playwright test --list

# Expected: Lists all .spec.ts tests without errors
```

---

## Success Criteria

- [ ] `npm test` runs without "Playwright Test did not expect" errors
- [ ] Vitest only picks up `.test.ts` files
- [ ] Playwright tests remain available via `npx playwright test`
