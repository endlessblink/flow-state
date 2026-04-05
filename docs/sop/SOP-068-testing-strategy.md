# SOP-065: Comprehensive Testing Strategy

**Created:** 2026-03-21
**Status:** Active
**Scope:** All FlowState testing — unit, integration, E2E, static analysis

## Overview

FlowState has 1806+ tests across 75 files covering 28+ testing categories. This SOP documents the testing architecture, how to run tests, and how to add new tests.

## Quick Commands

```bash
npm run test              # Run all unit tests (1806 tests, ~7s)
npm run test:e2e          # Run Playwright E2E tests (requires local Supabase)
npm run test -- --coverage # Run with coverage report (HTML in ./coverage/)
npm run test -- --grep "TASK-1584" # Run specific test suite
npm run test -- tests/unit/sync/   # Run tests in directory
```

## Test Architecture

### Unit Tests (Vitest)

| Directory | Purpose | Count |
|-----------|---------|-------|
| `tests/unit/sync/` | Sync orchestrator, conflict resolution, websocket | ~115 |
| `tests/unit/stores/` | All Pinia stores (tasks, timer, auth, etc.) | ~130 |
| `tests/unit/tauri-parity/` | WebKitGTK/Tauri compatibility | ~125 |
| `tests/unit/components/` | Base/common Vue component tests | ~100 |
| `tests/unit/ui/` | Z-index, layout, RTL, canvas nodes, Naive UI | ~100 |
| `tests/unit/views/` | View smoke tests, route coverage | ~70 |
| `tests/unit/accessibility/` | WCAG compliance scanning | ~30 |
| `tests/unit/security/` | XSS, secrets scanning | ~15 |
| `tests/unit/performance/` | Store benchmarks, bundle analysis | ~25 |
| `tests/unit/chaos/` | Fault injection, error resilience | ~15 |
| `tests/unit/notifications/` | Notification delivery logic | ~20 |
| `tests/unit/drag-drop/` | 4 drag-and-drop systems | ~30 |
| `tests/unit/canvas/` | Canvas composable logic | ~30 |
| `tests/unit/error-recovery/` | Network/auth failure handling | ~20 |
| `tests/unit/cache/` | Cache invalidation logic | ~10 |
| `tests/unit/sw/` | Service worker configuration | ~15 |
| `tests/unit/config/` | Setting combinations | ~15 |
| `tests/unit/i18n/` | Localization completeness | ~10 |
| `tests/unit/routes/` | Deep link, route validation | ~10 |

### Contract Tests

| Directory | Purpose | Count |
|-----------|---------|-------|
| `tests/contract/api-contract.test.ts` | Field names match DB columns | 10 |
| `tests/contract/rls-enforcement.test.ts` | Row-level security enforcement | 10 |
| `tests/contract/database-safety.test.ts` | Migration safety, schema validation | 15 |

### Integration Tests

| Directory | Purpose | Count |
|-----------|---------|-------|
| `tests/integration/task-sync-flow.test.ts` | Task → sync → DB data flow | 20 |

### Regression Tests

| Directory | Purpose | Count |
|-----------|---------|-------|
| `tests/regression/known-bugs.test.ts` | Guards for BUG-1211, 1212, 1335, 1453, 1184 | 13 |

### E2E Tests (Playwright)

| Directory | Purpose |
|-----------|---------|
| `tests/e2e/view-loading.spec.ts` | All views render without errors |
| `tests/e2e/dropdown-z-index.spec.ts` | Dropdowns/popovers appear above content |
| `tests/e2e/` (existing) | Sync, morning dashboard, mobile, etc. |

### Safety Tests

| Directory | Purpose | Count |
|-----------|---------|-------|
| `tests/safety/build-safety.test.ts` | Import resolution, secrets, version parity | 5 |
| `tests/safety/` (existing) | CSS syntax, dependencies, vue imports | ~10 |

## Test Infrastructure

### Factories (`tests/factories/index.ts`)

```typescript
import { createMockTask, createMockProject, createMockTimerSession } from '../factories'

const task = createMockTask({ title: 'Test', priority: 'high' })
const project = createMockProject({ name: 'Work' })
```

### Helpers (`tests/helpers/selectors.ts`)

```typescript
import { testIds } from '../helpers/selectors'
// testIds.taskCard('uuid'), testIds.kanbanColumn('done'), etc.
```

### Setup (`tests/setup.ts`)

Global `window.matchMedia` mock. Applied automatically via `vitest.config.ts` `setupFiles`.

## Adding New Tests

### When adding a feature:
1. Write unit tests for new stores/composables
2. Add component tests if new UI components created
3. Add E2E test for the user workflow
4. Run `npm run test` to verify no regressions

### When fixing a bug:
1. Add a regression test in `tests/regression/` documenting the root cause
2. Name it with the BUG-XXXX ID
3. Test the exact failure condition that would re-introduce the bug

### When modifying Tauri/WebKitGTK code:
1. Check `tests/unit/tauri-parity/` for existing guards
2. Add new CSS/behavior guards if introducing platform-specific code
3. Run `npm run test:tauri-parity` to verify

## Priority Levels

| Level | Meaning | Coverage Target |
|-------|---------|----------------|
| P0 | Data loss risk | 80%+ |
| P1 | Feature broken | 60%+ |
| P2 | UX degraded | 40%+ |
| P3 | Nice-to-have | Any |

## MASTER_PLAN Tracking

All testing tasks are tracked as TASK-1584 to TASK-1640 in `docs/MASTER_PLAN.md`.
