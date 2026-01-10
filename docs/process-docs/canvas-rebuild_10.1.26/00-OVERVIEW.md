# Canvas Fresh Rebuild - Overview

**Date**: January 10, 2026
**Status**: Planning Complete, Implementation Starting
**Task ID**: TASK-175

---

## Quick Links

| Document | Description |
|----------|-------------|
| [01-ARCHITECTURE.md](./01-ARCHITECTURE.md) | Architecture principles, file structure |
| [02-INTEGRATION-MAP.md](./02-INTEGRATION-MAP.md) | Complete swap map (100+ touchpoints) |
| [03-IMPLEMENTATION.md](./03-IMPLEMENTATION.md) | 7 phases with code examples |
| [04-TECHNICAL-DECISIONS.md](./04-TECHNICAL-DECISIONS.md) | Position storage, parent-child, sync |
| [05-VERIFICATION.md](./05-VERIFICATION.md) | Playwright tests, success criteria |
| [06-CLEANUP.md](./06-CLEANUP.md) | Files to delete after verification |

---

## Summary

**Goal**: Replace 22,500+ lines of complex canvas code with ~2,550 lines of maintainable, Vue Flow-native code.

**Approach**: Fresh rebuild in parallel, verify, then swap.

---

## Why Fresh Rebuild (Not Patch)

| Current Problem | Root Cause | Rebuild Solution |
|----------------|------------|------------------|
| ~1,200 lines coordinate conversion | "World-Space-First" fights Vue Flow | Trust Vue Flow's native `parentNode` |
| 22 competing watchers | Over-engineered reactivity | Explicit function calls only |
| Position locks (7s timeout) | Bandaid for race conditions | Single sync path, no races |
| Double-conversion bug | Store + Vue Flow both convert | Store = absolute, Vue Flow handles relative |
| 3,468 line CanvasView.vue | Monolithic, untestable | ~500 lines, composables do work |

---

## Implementation Milestones

| Phase | Milestone | Key Deliverable |
|-------|-----------|-----------------|
| 1 | Empty Canvas Renders | `/canvas-new` route works |
| 2 | Groups Appear | Groups load from Supabase |
| 3 | Tasks in Inbox | Inbox panel with tasks |
| 4 | Drag Task to Canvas | Position persists on refresh |
| 5 | Parent-Child Works | Tasks move with groups |
| 6 | Feature Parity | All canvas features work |
| 7 | Swap & Cleanup | Old canvas deleted |

---

## Code Impact

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Total Lines | ~22,500 | ~2,550 | -88% |
| Composable Files | 23 | 5 | -78% |
| Component Files | 25 | 3 | -88% |
| Deep Watchers | 22 | 0 | -100% |

---

## Risk Mitigation

- **Parallel Development**: Old canvas stays until new is verified
- **Same Data Layer**: Uses existing Supabase tables/mappers
- **Incremental Swap**: Update one integration at a time
- **Feature Checklist**: Must pass all 15 features before swap
