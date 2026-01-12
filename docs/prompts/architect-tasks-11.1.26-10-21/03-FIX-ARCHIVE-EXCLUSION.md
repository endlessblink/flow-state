# Fix: Exclude Archive from TypeScript Compilation

**Priority**: P1-HIGH
**Time Estimate**: 5 minutes
**Dependencies**: None

---

## Problem

15 TypeScript errors originate from `src/archive/canvas-rebuild-failed-20260110/` directory, which contains abandoned/failed refactoring code.

**Errors include**:
- Missing modules: `@/stores/canvasNew`, `@/composables/canvasNew/*`
- Missing properties: `dimensions`, `persistGroup`, `computedPosition`
- Implicit any types

---

## Fix

### Modify `tsconfig.json`

Add `src/archive/**` to the exclude array:

```json
{
  "compilerOptions": {
    // ... existing options
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": [
    "node_modules",
    "dist",
    "src/archive/**"
  ]
}
```

---

## Alternative: Delete Archive

If the archive is no longer needed:

```bash
# Option: Remove the archive entirely
rm -rf src/archive/canvas-rebuild-failed-20260110/

# Or move to docs/archive (outside src/)
mv src/archive docs/code-archive
```

---

## Verification

```bash
# After fix, check errors from archive are gone:
npx vue-tsc --noEmit 2>&1 | grep "archive"

# Expected: No output (no errors from archive)

# Full check:
npx vue-tsc --noEmit 2>&1 | grep "error TS" | wc -l

# Expected: 15 fewer errors
```

---

## Success Criteria

- [ ] No TypeScript errors from `src/archive/**`
- [ ] `tsconfig.json` explicitly excludes archive
- [ ] Build passes without archive-related errors
