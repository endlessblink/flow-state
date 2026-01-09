# Bug Analysis Index: Task Position Jump

**Purpose**: Central reference for task position jump bug investigation
**Status**: Complete Analysis - Ready for Investigation Phase
**Created**: January 6, 2026
**Total Analysis**: 58KB across 5 documents

---

## Quick Start (5 minute read)

**Start here**: `/BUG_SUMMARY_POSITION_JUMP.md`
- 5-minute executive summary
- Reproduction steps
- File locations
- Likely root causes ranked by probability

---

## Document Structure

### 1. BUG_SUMMARY_POSITION_JUMP.md (8.7 KB)
**Read this first** - Quick reference guide

**Contains**:
- One-sentence bug description
- Quick facts (what's confirmed vs unknown)
- Likely root causes ranked by probability
- Reproduction steps (minimal and with sections)
- Acceptance criteria
- File locations
- Key code snippets
- Next steps

**Best for**: Quick understanding, linking to other docs, status updates

**Read time**: 5-10 minutes

---

### 2. BUG_ANALYSIS_TASK_POSITION_JUMP.md (17 KB)
**Deep technical analysis** - Primary investigation document

**Contains**:
- **Architecture Analysis** (4 sections):
  - Task edit → save flow
  - Watcher chain after update
  - Position lock mechanism review
  - Containment recalculation logic

- **Edge Cases** (6 detailed scenarios):
  - Task moved out of section during edit
  - Section resize during edit
  - Property change triggers sync after edit
  - Lock expiry race (7-second window)
  - Nested group containment ambiguity
  - Task position becomes undefined

- **Timing & Async Issues** (2 patterns):
  - Multiple async watchers racing
  - Debounce/throttle masking lock status

- **Root Cause Summary** (ranked):
  1. Watcher lock check gap (80% probability)
  2. Containment recalculation (70% probability)
  3. Section bounds changed (40% probability)
  4. Float precision in bounds (40% probability)
  5. canvasPosition not preserved (20% probability)
  6. Lock expiry before async (20% probability)

- **Acceptance Criteria** (5 detailed specs):
  - Position lock honored in all sync paths
  - Float point precision handled
  - Preserved position through edit lifecycle
  - No reparenting on section bounds change
  - Lock guards all containment recalculations

- **Investigation Checklist** (8 items)

- **Files Affected** (6 files)

- **Key Learnings** (5 insights)

**Best for**: Understanding the technical details, identifying what needs investigation

**Read time**: 30-45 minutes

---

### 3. BUG_CRITICAL_GAPS.md (16 KB)
**Unknown unknowns** - Questions that MUST be answered before fixing

**Contains**:
- **12 Critical Gaps** with:
  - Question
  - Current uncertainty
  - Why it matters
  - How to resolve (with code examples)
  - Impact assessment

- **Gap Topics**:
  1. Watcher execution order (CRITICAL)
  2. Actual lock status during watchers (CRITICAL)
  3. Does line 1837 watcher actually execute? (CRITICAL)
  4. Position lock preventing sync? (CRITICAL)
  5. Containment recalculation path (CRITICAL)
  6. Float precision in bounds check (MEDIUM)
  7. TaskEditModal position preservation (HIGH)
  8. Section bounds source inconsistency (HIGH)
  9. Debounce/throttle timing (MEDIUM)
  10. Undo system interaction (MEDIUM)
  11. Multi-edit scenario accumulation (MEDIUM)
  12. Canvas state lock vs task state lock (MEDIUM)

- **Investigation Priority** (3 phases):
  - Phase 1: Must resolve (Gaps 1, 2, 3)
  - Phase 2: Likely root cause (Gaps 4, 5, 7, 8)
  - Phase 3: Supporting (Gaps 4, 6, 9, 10, 11, 12)

- **Expected Findings by Gap** (decision table)

- **Instrumentation Checklist** (10 items to add to code)

**Best for**: Identifying specific questions to answer, planning investigation

**Read time**: 40-50 minutes

---

### 4. BUG_TEST_PLAN_POSITION_JUMP.md (16 KB)
**Comprehensive testing strategy** - How to reproduce and verify fix

**Contains**:
- **Phase 1: Visual Regression Tests** (8 Playwright tests)
  1. Edit task property - baseline
  2. Edit task title - priority check
  3. Edit task status - in section
  4. Rapid sequential edits (stress test)
  5. Task near section boundary (float precision)
  6. Nested groups (complex containment)
  7. Section resized by other instance (multi-user)
  8. Task move to inbox scenario

- **Phase 2: Instrumentation Tests** (3 patterns)
  1. Watcher execution order logging
  2. Position lock state tracking
  3. Containment calculation trace

- **Phase 3: Unit Tests** (2 test suites)
  1. Floating point containment check
  2. Lock prevents containment recalc

- **Phase 4: Integration Tests** (1 full flow test)
  - Full edit flow with lock

- **Phase 5: Regression Tests** (2 tests)
  1. No break in drag-drop
  2. No break in section containment

- **Metrics & Success Criteria** (baseline vs after-fix)

- **Test Data Requirements** (table of scenarios)

- **Expected Issues & Workarounds** (4 common problems)

- **Execution Checklist** (6 phases, 65 minute estimate)

**Best for**: Running tests to identify which specific watcher/mechanism causes jump

**Read time**: 25-35 minutes

**To execute**: 60-90 minutes with Playwright

---

### 5. BUG_ANALYSIS_INDEX.md (This file)
**Navigation guide** - What to read and when

---

## How to Use These Documents

### Scenario 1: Quick Status Update
1. Read: **BUG_SUMMARY_POSITION_JUMP.md** (5 min)
2. Mention: File locations and likely causes

### Scenario 2: Full Investigation
1. Read: **BUG_SUMMARY_POSITION_JUMP.md** (5 min) - Get overview
2. Read: **BUG_ANALYSIS_TASK_POSITION_JUMP.md** (45 min) - Understand technical details
3. Read: **BUG_CRITICAL_GAPS.md** (45 min) - Identify unknowns
4. Execute: **BUG_TEST_PLAN_POSITION_JUMP.md** Phase 1-2 (45 min) - Instrument and find culprit
5. Based on findings, proceed with appropriate fix

### Scenario 3: Implementing Fix
1. Review: **BUG_CRITICAL_GAPS.md** - Understand which gap needs fixing
2. Execute: **BUG_TEST_PLAN_POSITION_JUMP.md** Phase 3-4 - Unit and integration tests
3. Verify: **BUG_TEST_PLAN_POSITION_JUMP.md** Phase 5 - Regression tests
4. Check: All acceptance criteria from **BUG_ANALYSIS_TASK_POSITION_JUMP.md**

### Scenario 4: Code Review (Verifying Fix)
1. Compare: Code changes to likely root causes in **BUG_ANALYSIS_TASK_POSITION_JUMP.md**
2. Verify: Changes address all edge cases in **BUG_ANALYSIS_TASK_POSITION_JUMP.md**
3. Ensure: All acceptance criteria are met
4. Confirm: All tests from **BUG_TEST_PLAN_POSITION_JUMP.md** pass

---

## Key Findings Summary

### Root Causes (Ranked by Probability)
| # | Cause | Probability | Difficulty |
|---|-------|---|---|
| 1 | Watcher without lock check (line 1836) | 80% | EASY |
| 2 | Containment recalc executes when shouldn't (line 195) | 70% | MEDIUM |
| 3 | Section bounds mismatch | 40% | HARD |
| 4 | Float precision in bounds check (line 210) | 40% | MEDIUM |
| 5 | canvasPosition not preserved | 20% | EASY |
| 6 | Lock expires before async completes | 15% | MEDIUM |

### Critical Questions to Answer (Priority Order)
1. **Which watcher fires during edit?** (Gap #1, #2, #3)
2. **Does containment recalc execute?** (Gap #5)
3. **Is canvasPosition preserved?** (Gap #7)
4. **Are section bounds consistent?** (Gap #8)
5. **Is lock mechanism working?** (Gap #4)

### Files Requiring Changes (If Fix Confirmed)
| File | Lines | Issue |
|------|-------|-------|
| `CanvasView.vue` | 1836-1842 | Add lock check to property hash watcher |
| `useCanvasSync.ts` | 195 | Add lock check before containment recalc |
| `TaskEditModal.vue` | 654 | Verify canvasPosition preservation |
| `useCanvasSync.ts` | 210 | Add epsilon to float comparison |
| `canvasStateLock.ts` | 55 | Consider extending lock duration |

---

## Investigation Roadmap

```
START
  ↓
[1] Read BUG_SUMMARY (5 min)
  ↓
[2] Read BUG_ANALYSIS (45 min) - Understand architecture
  ↓
[3] Read BUG_CRITICAL_GAPS (45 min) - Identify unknowns
  ↓
[4] Execute TEST_PLAN Phase 1-2 (45 min)
     ├─ Add instrumentation
     ├─ Reproduce bug with logging
     └─ Identify which watcher/mechanism is culprit
  ↓
[5] Review findings
     ├─ Gap #3 result?
     ├─ Gap #2 result?
     └─ Gap #5 result?
  ↓
[6] Based on findings:
     ├─ If line 1836 watcher → Add lock check
     ├─ If containment recalc → Add lock check to line 195
     ├─ If float precision → Add epsilon tolerance
     ├─ If canvasPosition lost → Debug modal flow
     └─ If section bounds → Track bounds source
  ↓
[7] Execute TEST_PLAN Phase 3-5 (45 min)
     ├─ Unit tests
     ├─ Integration tests
     └─ Regression tests
  ↓
[8] Verify all acceptance criteria met
  ↓
DONE
```

**Total time**: ~4-5 hours (investigation + fix + testing)

---

## Related Documentation

### In This Repository
- `docs/MASTER_PLAN.md` - Task tracking and dependencies
- `docs/sop/active/CANVAS-shift-drag-selection-fix.md` - Similar position issue
- `src/utils/canvasStateLock.ts` - Implementation of position lock
- `src/composables/canvas/useCanvasSync.ts` - Sync logic

### External References
- Vue Flow documentation: https://vueflow.dev
- Pinia documentation: https://pinia.vuejs.org
- Vue 3 Watchers: https://vuejs.org/guide/essentials/watchers.html

---

## Document Metadata

| Aspect | Value |
|--------|-------|
| Created | January 6, 2026 |
| Status | Complete Analysis - Ready for Investigation |
| Estimated Fix Time | 2-4 hours after root cause identified |
| Total Analysis Time | ~5-6 hours |
| Lines of Analysis | 3,000+ |
| Code Snippets | 50+ |
| Test Cases | 12+ |
| Edge Cases | 6+ |
| Known Gaps | 12 |
| Instrumentation Points | 10+ |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 6, 2026 | Initial complete analysis |

---

## Approval & Sign-Off

This analysis is **ready for investigation** once:
- [ ] Reviewed by project owner
- [ ] Assigned to developer for investigation
- [ ] Investigation timeline confirmed

---

## Questions?

Refer to the appropriate document:
- **"How do I understand the bug?"** → BUG_SUMMARY or BUG_ANALYSIS
- **"How do I reproduce it?"** → BUG_TEST_PLAN Phase 1
- **"What's unknown?"** → BUG_CRITICAL_GAPS
- **"How do I test the fix?"** → BUG_TEST_PLAN Phase 3-5
- **"What's the technical architecture?"** → BUG_ANALYSIS section 1-4

---

**Analysis completed by**: Claude Code AI (Haiku 4.5)
**For project**: Pomo-Flow (Vue 3 + Pinia + Canvas)
**Issue type**: Bug - Data Position/UI State
**Severity**: P1-HIGH (Affects core functionality)
