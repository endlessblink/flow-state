# Architect Tasks: Execution Order & Summary

**Created**: January 11, 2026
**Total Prompts**: 9
**Estimated Total Time**: 5-6 hours

---

## Quick Reference

| # | Prompt | Priority | Time | Errors Fixed |
|---|--------|----------|------|--------------|
| 01 | Test Configuration | P0 | 15 min | 63 test failures |
| 02 | Dead Imports | P0 | 30 min | 7 TS errors |
| 03 | Archive Exclusion | P1 | 5 min | 15 TS errors |
| 04 | Vue Flow Types | P1 | 45 min | 6 TS errors |
| 05 | Calendar Components | P1 | 30 min | 8 TS errors |
| 06 | Inbox Components | P1 | 30 min | 4 TS errors |
| 07 | Task Components | P1 | 45 min | 7 TS errors |
| 08 | Misc Components | P2 | 20 min | 3 TS errors |
| 09 | Circular Dependencies | P2 | 2+ hrs | 156 cycles |

---

## Recommended Execution Order

### Phase 1: Quick Wins (20 minutes)
```bash
# Execute in order:
1. 01-FIX-TEST-CONFIGURATION.md  # Unblocks test suite
2. 03-FIX-ARCHIVE-EXCLUSION.md   # Removes 15 errors instantly
```

### Phase 2: Import Fixes (30 minutes)
```bash
3. 02-FIX-DEAD-IMPORTS.md        # Fixes broken imports
```

### Phase 3: Type Fixes (2.5 hours)
```bash
# Can be done in parallel by different agents:
4. 04-FIX-VUE-FLOW-TYPES.md      # Canvas composables
5. 05-FIX-CALENDAR-COMPONENTS.md  # Calendar views
6. 06-FIX-INBOX-COMPONENTS.md     # Inbox panel
7. 07-FIX-TASK-COMPONENTS.md      # Task components
8. 08-FIX-MISC-COMPONENTS.md      # Tiptap, Auth
```

### Phase 4: Structural (2+ hours)
```bash
9. 09-FIX-CIRCULAR-DEPENDENCIES.md  # Requires analysis first
```

---

## Verification After Each Phase

### After Phase 1:
```bash
npm test  # Should run without Playwright errors
npx vue-tsc --noEmit 2>&1 | grep "error" | wc -l  # Should be ~43
```

### After Phase 2:
```bash
npx vue-tsc --noEmit 2>&1 | grep "TS2307" | wc -l  # Should be 0
```

### After Phase 3:
```bash
npx vue-tsc --noEmit  # Should report 0 errors
npm run build         # Should complete successfully
```

### After Phase 4:
```bash
npm test -- tests/safety/dependencies.test.ts  # Should pass
npm test  # All tests should pass
```

---

## Final Verification

```bash
# Complete check:
npm run build && npm test

# Expected output:
# ✓ built in ~12s
# Test Files  X passed (X)
# Tests       X passed (X)
```

---

## Files Index

```
docs/prompts/architect-tasks-11.1.26-10-21/
├── 00-EXECUTION-ORDER.md          # This file
├── 01-FIX-TEST-CONFIGURATION.md   # Vitest/Playwright conflict
├── 02-FIX-DEAD-IMPORTS.md         # Deleted files still imported
├── 03-FIX-ARCHIVE-EXCLUSION.md    # Exclude archive from TS
├── 04-FIX-VUE-FLOW-TYPES.md       # positionAbsolute, selected
├── 05-FIX-CALENDAR-COMPONENTS.md  # Duplicate identifiers
├── 06-FIX-INBOX-COMPONENTS.md     # Priority type mismatches
├── 07-FIX-TASK-COMPONENTS.md      # Missing props, type errors
├── 08-FIX-MISC-COMPONENTS.md      # Tiptap, SignupForm
└── 09-FIX-CIRCULAR-DEPENDENCIES.md # 156 import cycles
```

---

## Success Criteria (Final)

- [ ] `npm run build` passes with no errors
- [ ] `npx vue-tsc --noEmit` reports 0 errors
- [ ] `npm test` passes all tests
- [ ] `npx playwright test` runs E2E tests
- [ ] Application starts and works correctly
- [ ] No console errors in dev mode
