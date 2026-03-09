# Tauri Parity Testing Strategy

## Context

### Original Request
Create a comprehensive testing strategy to catch WebKitGTK behavioral differences that cause recurring production bugs in the Tauri desktop app. Currently there is ZERO Tauri-specific test coverage.

### Interview Summary
- User chose **maximum coverage** — all 6 phases, no shortcuts
- Pre-deploy gate required: tests must pass before Tauri deploy
- Must work in CI without real Tauri runtime (GitHub Actions ubuntu-latest)

### Research Findings

**Current state (verified via codebase analysis):**

| Area | Status |
|------|--------|
| Playwright WebKit project | Commented out (lines 51-58 of `playwright.config.ts`) |
| CI pipeline (`.github/workflows/ci.yml`) | Runs lint, type-check, build, safety tests — NO E2E, NO WebKit |
| `src/utils/platform.ts` | Has `_resetPlatformCache()` test helper, zero tests use it |
| `src/test/setup.ts` | Mocks `matchMedia`, `localStorage`, `indexedDB` — no `__TAURI__` setup |
| Tauri parity Storybook stories | 7 stories in `src/stories/tauri-parity/` — manual only |
| `readCacheDB.test.ts` | Uses `fake-indexeddb` but no structured clone edge cases |
| `useDragAndDrop.ts` | Has Tauri-specific branches (deferred ghost, line 198) — no unit tests |
| `contextMenuCoordinates.ts` | Has `getLinuxTauriScaleFactor()` — no unit tests |
| `notificationDelivery.ts` | Has Tauri branch (notify-send) — no unit tests |
| `overflow: clip` usage | 2 files: `MobileQuickSortView.vue`, `canvas-view-layout.css` |
| `perspective` usage | 2 files: `QuickSortView.vue`, `MobileQuickSortView.vue` |
| `backdrop-filter` usage | 764 occurrences across 211 files (massive surface area) |
| `isTauri`/`isNative`/`detectPlatform` imports | 37 files across `src/` |
| `setDragImage`/`dataTransfer` usage | 18 files |
| `structuredClone`/`IndexedDB` usage | 18 files |

**Known WebKitGTK differences that have caused production bugs:**
1. `overflow: clip` not supported (calendar grid collapse)
2. `dataTransfer.getData()` returns empty in drop events (catalog drag broken)
3. `DataCloneError` storing Vue reactive proxies in IndexedDB (spam errors)
4. Path concatenation bugs (session file forbidden path)
5. Context menu coordinate scale-factor differences (BUG-1116)
6. `Notification.requestPermission()` hangs WebKitGTK (BUG-1303)
7. `backdrop-filter` rendering differences
8. `perspective` creates containing block for `position: fixed` descendants (BUG-1453)
9. Ghost drag image (`setDragImage`) doesn't work in WebKitGTK

---

## Work Objectives

### Core Objective
Build a multi-layer Tauri parity testing strategy that catches WebKitGTK behavioral differences before they reach production, using Playwright WebKit + unit tests + CSS static analysis + CI gates.

### Deliverables
1. WebKit enabled in Playwright E2E suite (immediate regression detection)
2. Unit test suite for all Tauri-specific code paths (~37 files)
3. CSS static analysis tests (overflow: clip, perspective, backdrop-filter safety)
4. Tauri simulation E2E tests (window.__TAURI_INTERNALS__ injection)
5. `npm run test:tauri-parity` pre-deploy gate script
6. Ongoing maintenance tooling (linter rules, checklists, reference doc)

### Definition of Done
- All 6 phases implemented and passing in CI
- `npm run test:tauri-parity` exits 0 on clean codebase
- Deploy script (`deploy-tauri-update.sh`) refuses to proceed if parity tests fail
- At least 1 test covering each of the 9 known WebKitGTK differences
- CSS scanner catches `overflow: clip` without fallback + `perspective` with fixed descendants

---

## Guardrails

### Must Have
- All tests must run without a real Tauri runtime (jsdom + fake-indexeddb + Playwright WebKit)
- Tests must be fast enough for CI (< 3 minutes total for unit tests, < 5 minutes for E2E)
- Existing test suite must not break
- Platform detection (`_resetPlatformCache()`) must be properly isolated between tests
- CSS scanner must be allowlist-based (not block all usage — many are intentional)

### Must NOT Have
- No Tauri binary in CI (too heavy, requires GTK deps)
- No mocking that hides real bugs (e.g., don't mock `dataTransfer` to always succeed)
- No breaking changes to existing drag-and-drop behavior
- No new npm dependencies beyond what's already available (Playwright, Vitest, fake-indexeddb)
- No changes to production code in this plan (testing only, unless a fix is trivially needed to make a test pass)

---

## Task Flow and Dependencies

```
Phase 1 (Quick Wins) ─────────────────────────────┐
                                                    │
Phase 2 (Unit Tests) ──────────────────────────────┤
                                                    ├──> Phase 5 (Pre-Deploy Gate)
Phase 3 (CSS Safety Tests) ────────────────────────┤         │
                                                    │         v
Phase 4 (Tauri Simulation E2E) ────────────────────┘   Phase 6 (Maintenance)
```

Phases 1-4 are independent and can be worked in parallel.
Phase 5 depends on all of 1-4.
Phase 6 depends on Phase 5.

---

## Phase 1: Quick Wins — Enable WebKit in Playwright

**Complexity:** LOW
**Dependencies:** None
**Estimated effort:** 1-2 hours

### TODO 1.1: Uncomment WebKit project in Playwright config
**File:** `playwright.config.ts`
**Action:** Uncomment lines 56-58, add storageState support matching chromium project.

```typescript
{
  name: 'webkit',
  use: {
    ...devices['Desktop Safari'],
    ...(hasAuth ? { storageState: authFile } : {}),
  },
},
```

**Acceptance criteria:** `npx playwright test --project=webkit` runs (even if some tests fail).

### TODO 1.2: Install WebKit browser deps in CI
**File:** `.github/workflows/ci.yml`
**Action:** Add `npx playwright install webkit --with-deps` step. Add E2E test job (optional/non-blocking initially).

**Acceptance criteria:** CI job installs WebKit deps without failure on ubuntu-latest.

### TODO 1.3: Run existing E2E suite in WebKit, catalog failures
**Action:** Run full suite, document which tests fail and why. Create a failure catalog markdown file.
**Output file:** `tests/tauri-parity/WEBKIT_FAILURES.md`

**Acceptance criteria:** Failure catalog exists with at least file, test name, error, and root cause category for each failure.

### TODO 1.4: Fix or skip WebKit-specific failures
**Action:** For each failure from 1.3:
- If fixable without production code changes: fix the test
- If requires production fix: create a TASK-XXX in MASTER_PLAN.md, skip test with `test.skip` and comment referencing the task
- If WebKit limitation irrelevant to Tauri: skip with comment explaining why

**Acceptance criteria:** `npx playwright test --project=webkit` exits 0 (all pass or intentionally skipped).

---

## Phase 2: Unit Tests for Tauri Code Paths

**Complexity:** MEDIUM-HIGH
**Dependencies:** None
**Estimated effort:** 4-6 hours

### TODO 2.1: Create platform detection test suite
**File to create:** `tests/unit/utils/platform.test.ts`
**File under test:** `src/utils/platform.ts`

Test cases:
- `detectPlatform()` returns `'tauri'` when `window.__TAURI_INTERNALS__` exists
- `detectPlatform()` returns `'tauri'` when `window.__TAURI__` exists
- `detectPlatform()` returns `'tauri'` when `window.isTauri === true`
- `detectPlatform()` returns `'browser'` when none of the above
- `detectPlatform()` returns `'pwa'` when `matchMedia('(display-mode: standalone)')` matches
- `_resetPlatformCache()` allows re-detection after environment change
- `isTauri()`, `isNative()`, `isDesktopNative()` return correct booleans
- Cache works (second call doesn't re-detect)

**Acceptance criteria:** All platform detection paths have 100% branch coverage.

### TODO 2.2: Create drag-and-drop Tauri-mode test suite
**File to create:** `tests/unit/composables/useDragAndDrop.test.ts`
**File under test:** `src/composables/useDragAndDrop.ts`

Test cases:
- When `isTauri() === true`: ghost pill creation is deferred via `requestAnimationFrame` (not synchronous)
- When `isTauri() === true`: `setDragImage` is NOT called (line ~198-210)
- When `isTauri() === false`: `setDragImage` IS called with 1x1 transparent image
- Singleton fallback: when `dataTransfer.getData()` returns empty string, drag data is retrieved from `dragState` ref
- Safety net cleanup fires even when source element is removed from DOM
- Ghost pill is removed on `endDrag()`

**Acceptance criteria:** Both Tauri and non-Tauri drag paths tested. Singleton fallback verified.

### TODO 2.3: Create IndexedDB structured clone safety tests
**File to create:** `tests/unit/services/offline/readCacheDB-tauri.test.ts`
**File under test:** `src/services/offline/readCacheDB.ts`

Test cases:
- `cacheTasks()` with Vue `reactive()` proxy objects does NOT throw `DataCloneError`
- `cacheTasks()` with nested reactive proxies (task with reactive subtasks array) succeeds
- `cacheTasks()` with `ref()` wrapped values succeeds
- `cacheGroups()` with reactive proxies succeeds
- `cacheProjects()` with reactive proxies succeeds
- Verify `JSON.parse(JSON.stringify(toRaw(t)))` stripping works (the production fix)
- Edge case: object with circular reference throws but is caught (doesn't crash)

**Acceptance criteria:** Reactive proxy → IndexedDB round-trip works without DataCloneError. Uses `fake-indexeddb`.

### TODO 2.4: Create context menu coordinates test suite
**File to create:** `tests/unit/utils/contextMenuCoordinates.test.ts`
**File under test:** `src/utils/contextMenuCoordinates.ts`

Test cases:
- `isTauri()` returns true when `window.__TAURI__` is set
- `isLinuxTauri()` returns true when Tauri + Linux platform string
- `getLinuxTauriScaleFactor()` returns 1.0 for non-Tauri
- `getLinuxTauriScaleFactor()` returns 1.0 when DPR matches screenRatio
- `getLinuxTauriScaleFactor()` returns correction when DPR !== screenRatio (> 0.1 threshold)
- `getViewportCoordinates()` extracts clientX/clientY from MouseEvent
- `getViewportCoordinates()` extracts from TouchEvent
- `getPlatformDiagnostics()` returns expected shape

**Acceptance criteria:** All scale factor correction logic tested with mocked window properties.

### TODO 2.5: Create notification delivery test suite
**File to create:** `tests/unit/utils/notificationDelivery.test.ts`
**File under test:** `src/utils/notificationDelivery.ts`

Test cases:
- Non-Tauri, non-Capacitor: uses Browser Notification API
- Tauri + Linux: attempts `notify-send` first, falls back to Browser API
- Tauri + non-Linux: goes directly to Browser API
- BUG-1303: In Tauri, `Notification.requestPermission()` is SKIPPED (never called)
- Capacitor native: uses Capacitor Local Notifications
- Permission already granted: delivers immediately
- Permission denied: returns false without hanging

**Acceptance criteria:** All 3 delivery paths tested. BUG-1303 WebKitGTK hang prevention verified.

### TODO 2.6: Create test helper for Tauri environment simulation
**File to create:** `tests/tauri-parity/helpers/tauri-env.ts`

Provides:
- `simulateTauri()`: sets `window.__TAURI_INTERNALS__` + `window.__TAURI__`
- `simulateBrowser()`: removes Tauri markers
- `simulateLinuxTauri()`: sets Tauri + mocks `navigator.userAgentData.platform = 'linux'`
- `withTauriEnv(fn)`: wrapper that sets up Tauri env, runs fn, then cleans up
- `withPlatformReset(fn)`: wrapper that calls `_resetPlatformCache()` after fn

**Acceptance criteria:** Helper is used by TODO 2.1-2.5 tests. Environment is properly cleaned up between tests.

---

## Phase 3: CSS Safety Tests

**Complexity:** MEDIUM
**Dependencies:** None
**Estimated effort:** 2-3 hours

### TODO 3.1: Create `overflow: clip` scanner test
**File to create:** `tests/safety/css-webkit-compat.test.ts`

Scanner logic:
- Find all CSS files + Vue `<style>` blocks containing `overflow: clip` or `overflow-x: clip` or `overflow-y: clip`
- For each occurrence, check if a `overflow: hidden` fallback exists in the same rule (preceding line)
- **Allowlist**: Files where `overflow: clip` is intentionally used with known-safe context (e.g., mobile-only views that never run in Tauri)
- Report violations with file path and line number

Current known usages (from grep):
- `src/mobile/views/MobileQuickSortView.vue` — mobile only, safe (allowlist)
- `src/assets/canvas-view-layout.css` — DESKTOP, needs fallback check

**Acceptance criteria:** Test fails if new `overflow: clip` is added without `overflow: hidden` fallback (outside allowlist).

### TODO 3.2: Create `perspective` + `position: fixed` scanner
**File to create:** Same file as 3.1 (`tests/safety/css-webkit-compat.test.ts`)

Scanner logic:
- Find all CSS rules containing `perspective` (currently: `QuickSortView.vue`, `MobileQuickSortView.vue`)
- Check if any descendant elements (same component) use `position: fixed`
- If so, flag as potential BUG-1453 risk (perspective creates containing block in WebKitGTK)

**Acceptance criteria:** Test flags `perspective` + `position: fixed` combinations. Known-safe usages allowlisted.

### TODO 3.3: Create `.tauri-app` CSS override audit
**Action:** Verify that `src/assets/styles.css` or equivalent has `.tauri-app` class overrides for known WebKitGTK gaps.

Check for:
- `backdrop-filter` fallback (solid bg when `backdrop-filter` is unsupported or degraded)
- `overflow: clip` → `overflow: hidden` override
- Any WebKitGTK-specific `-webkit-` prefix requirements

**Acceptance criteria:** Test verifies `.tauri-app` overrides exist in the CSS for known problem areas.

### TODO 3.4: Extend existing `css-syntax.test.ts` with WebKit compat checks
**File to modify:** `tests/safety/css-syntax.test.ts`

Add test case:
- `it('should flag overflow: clip usage without hidden fallback')` — leverages the existing file scanning infrastructure in this file
- Reuses `extractCSSFromVueFiles()` and `findStyleFiles()` helpers already in the file

**Acceptance criteria:** Integrated into existing CSS safety test infrastructure.

---

## Phase 4: Tauri Simulation E2E Tests

**Complexity:** HIGH
**Dependencies:** None (but benefits from Phase 2 helpers)
**Estimated effort:** 4-6 hours

### TODO 4.1: Create "tauri-mode" Playwright project
**File to modify:** `playwright.config.ts`

Add a third project:
```typescript
{
  name: 'tauri-sim',
  use: {
    ...devices['Desktop Safari'],  // WebKit = closest to WebKitGTK
    ...(hasAuth ? { storageState: authFile } : {}),
  },
  testDir: './tests/tauri-parity/e2e',
  testMatch: '**/*.spec.ts',
},
```

**Acceptance criteria:** `npx playwright test --project=tauri-sim` runs tests from `tests/tauri-parity/e2e/`.

### TODO 4.2: Create Tauri injection fixture
**File to create:** `tests/tauri-parity/e2e/fixtures/tauri-page.ts`

Fixture that:
- Uses `page.addInitScript()` to inject `window.__TAURI_INTERNALS__ = {}` and `window.__TAURI__ = {}`
- Sets `window.isTauri = true`
- Mocks `@tauri-apps/api` imports that would fail outside Tauri (returns stubs)
- Exports `tauriTest` and `tauriExpect` wrappers

**Acceptance criteria:** Any page navigated in `tauri-sim` project detects as Tauri platform.

### TODO 4.3: Create drag-and-drop E2E parity test
**File to create:** `tests/tauri-parity/e2e/drag-and-drop.spec.ts`

Test cases:
- Board view: drag task between columns (SortableJS path)
- All Tasks view: drag task row to reorder
- Calendar view: drag task to different day
- Verify ghost pill appears and follows cursor
- Verify drag completes (task position updated) — confirms singleton fallback works when `dataTransfer.getData()` returns empty

**Acceptance criteria:** All drag operations complete successfully in WebKit with Tauri simulation.

### TODO 4.4: Create IndexedDB E2E parity test
**File to create:** `tests/tauri-parity/e2e/indexeddb-cache.spec.ts`

Test cases:
- Navigate to tasks view, verify tasks load
- Check `FlowStateReadCache` IndexedDB database exists
- Verify no `DataCloneError` in console (attach console listener)
- Force offline (disconnect network), reload — verify cached data appears

**Acceptance criteria:** No DataCloneError in console. Cache populated after initial load.

### TODO 4.5: Create notification E2E parity test
**File to create:** `tests/tauri-parity/e2e/notifications.spec.ts`

Test cases:
- Start a Pomodoro timer, let it complete — verify no hang on notification delivery
- Verify `Notification.requestPermission()` is NOT called (console log check for BUG-1303 skip message)

**Acceptance criteria:** Timer completion does not hang the page. No `requestPermission` call in Tauri mode.

### TODO 4.6: Create view rendering parity tests
**File to create:** `tests/tauri-parity/e2e/view-rendering.spec.ts`

Test cases:
- Board view renders without layout collapse
- Calendar view renders without `overflow: clip` grid collapse
- Canvas view renders with correct group positioning
- Quick Sort view renders without `perspective` containment issues

**Acceptance criteria:** All 4 views render without visual breakage in WebKit. Screenshots captured for visual comparison baseline.

---

## Phase 5: Pre-Deploy Gate

**Complexity:** LOW
**Dependencies:** Phases 1-4
**Estimated effort:** 1-2 hours

### TODO 5.1: Create `npm run test:tauri-parity` script
**File to modify:** `package.json`

Add scripts:
```json
{
  "test:tauri-parity:unit": "vitest run tests/unit/**/platform.test.ts tests/unit/**/useDragAndDrop.test.ts tests/unit/**/readCacheDB-tauri.test.ts tests/unit/**/contextMenuCoordinates.test.ts tests/unit/**/notificationDelivery.test.ts tests/safety/css-webkit-compat.test.ts",
  "test:tauri-parity:e2e": "playwright test --project=tauri-sim",
  "test:tauri-parity": "npm run test:tauri-parity:unit && npm run test:tauri-parity:e2e"
}
```

**Acceptance criteria:** `npm run test:tauri-parity` runs all Tauri parity tests (unit + E2E) and exits 0 on clean codebase.

### TODO 5.2: Add pre-deploy check to `deploy-tauri-update.sh`
**File to modify:** `scripts/deploy-tauri-update.sh`

Add to pre-flight checks section:
```bash
echo "Running Tauri parity tests..."
npm run test:tauri-parity:unit || { echo "FAIL: Tauri parity unit tests failed"; exit 1; }
```

Note: Only unit tests in pre-deploy (E2E requires dev server). Full suite runs in CI.

**Acceptance criteria:** Deploy script refuses to build if parity unit tests fail.

### TODO 5.3: Add Tauri parity job to CI
**File to modify:** `.github/workflows/ci.yml`

Add new job (non-blocking initially, with `continue-on-error: true`):
```yaml
tauri-parity:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    - run: npm ci
    - run: npx playwright install webkit --with-deps
    - name: Tauri parity unit tests
      run: npm run test:tauri-parity:unit
    - name: Tauri parity E2E tests
      run: npm run test:tauri-parity:e2e
      continue-on-error: true  # Remove after stabilization
```

**Acceptance criteria:** CI runs parity tests on every push to master. Initially non-blocking, becomes blocking after stabilization.

---

## Phase 6: Ongoing Maintenance

**Complexity:** LOW
**Dependencies:** Phase 5
**Estimated effort:** 1-2 hours

### TODO 6.1: Create WebKitGTK gotchas reference document
**File to create:** `docs/sop/SOP-XXX-webkit-gtk-gotchas.md`

Contents:
- Table of all 9 known WebKitGTK differences with symptoms, root cause, fix pattern
- "Before you use" warnings for: `overflow: clip`, `perspective`, `setDragImage`, `dataTransfer.getData()`, `Notification.requestPermission()`, `structuredClone`/IndexedDB with reactive proxies
- Link to `tests/tauri-parity/` test suite
- Link to Tauri parity Storybook stories

**Acceptance criteria:** Document covers all 9 known differences with actionable guidance.

### TODO 6.2: Create Tauri parity checklist template
**File to create:** `docs/sop/checklists/tauri-parity-checklist.md`

Template for feature development:
- [ ] Does this feature use `overflow: clip`? Add `overflow: hidden` fallback
- [ ] Does this feature use `perspective`? Check for `position: fixed` descendants
- [ ] Does this feature use drag-and-drop? Test with `dataTransfer.getData()` returning empty
- [ ] Does this feature use `setDragImage`? Use ghost pill pattern instead
- [ ] Does this feature cache data in IndexedDB? Use `toRaw()` + `JSON.parse(JSON.stringify())`
- [ ] Does this feature request notification permission? Skip in Tauri (use notify-send)
- [ ] Does this feature use `backdrop-filter`? Verify it degrades gracefully

**Acceptance criteria:** Checklist is referenceable from CLAUDE.md for new feature development.

### TODO 6.3: Add `overflow: clip` to safety test allowlist system
**File to modify:** `tests/safety/css-webkit-compat.test.ts` (created in Phase 3)

Create an allowlist mechanism:
```typescript
const OVERFLOW_CLIP_ALLOWLIST = [
  'src/mobile/views/MobileQuickSortView.vue', // Mobile only, never runs in Tauri
]
```

New files using `overflow: clip` must either:
1. Be added to the allowlist with a comment explaining why it's safe
2. Include an `overflow: hidden` fallback

**Acceptance criteria:** Allowlist system works. Adding `overflow: clip` to a new file without allowlisting or fallback fails the test.

### TODO 6.4: Add CLAUDE.md reference
**File to modify:** `CLAUDE.md`

Add to Key Development Rules:
```
15. **Tauri/WebKitGTK Parity** - Before using `overflow: clip`, `perspective`, `setDragImage`, or `Notification.requestPermission()`, check `docs/sop/SOP-XXX-webkit-gtk-gotchas.md`. Run `npm run test:tauri-parity` before any Tauri deploy.
```

**Acceptance criteria:** CLAUDE.md references the parity testing system.

---

## Commit Strategy

| Phase | Commit(s) |
|-------|-----------|
| Phase 1 | 1 commit: "feat(test): enable WebKit in Playwright E2E suite" |
| Phase 2 | 2 commits: "feat(test): add Tauri environment simulation helpers" + "feat(test): add Tauri code path unit tests" |
| Phase 3 | 1 commit: "feat(test): add CSS WebKit compatibility safety tests" |
| Phase 4 | 1 commit: "feat(test): add Tauri simulation E2E test suite" |
| Phase 5 | 1 commit: "feat(ci): add Tauri parity pre-deploy gate and CI job" |
| Phase 6 | 1 commit: "docs: add WebKitGTK gotchas SOP and parity checklist" |

Total: ~7 commits, each independently functional.

---

## Success Criteria

| Criterion | Measurement |
|-----------|-------------|
| All 9 known WebKitGTK differences have at least 1 test | Count tests tagged with BUG-XXXX references |
| `npm run test:tauri-parity` exits 0 | CI green |
| Deploy script blocks on parity failure | Manual test: introduce `overflow: clip` without fallback, verify deploy refuses |
| WebKit E2E suite passes | `npx playwright test --project=webkit` exits 0 |
| Tauri simulation E2E suite passes | `npx playwright test --project=tauri-sim` exits 0 |
| CSS scanner catches new violations | Add `overflow: clip` to test file, verify test fails |
| No new npm dependencies added | `package.json` diff shows zero new deps |
| Total parity test runtime < 8 min | CI timing |

---

## File Summary

### Files to Create (12)
| File | Phase | Purpose |
|------|-------|---------|
| `tests/tauri-parity/helpers/tauri-env.ts` | 2 | Tauri environment simulation helpers |
| `tests/unit/utils/platform.test.ts` | 2 | Platform detection unit tests |
| `tests/unit/composables/useDragAndDrop.test.ts` | 2 | Drag-and-drop Tauri path tests |
| `tests/unit/services/offline/readCacheDB-tauri.test.ts` | 2 | Structured clone safety tests |
| `tests/unit/utils/contextMenuCoordinates.test.ts` | 2 | Scale factor correction tests |
| `tests/unit/utils/notificationDelivery.test.ts` | 2 | Notification delivery path tests |
| `tests/safety/css-webkit-compat.test.ts` | 3 | CSS WebKit compatibility scanner |
| `tests/tauri-parity/e2e/fixtures/tauri-page.ts` | 4 | Playwright Tauri injection fixture |
| `tests/tauri-parity/e2e/drag-and-drop.spec.ts` | 4 | E2E drag parity tests |
| `tests/tauri-parity/e2e/indexeddb-cache.spec.ts` | 4 | E2E IndexedDB parity tests |
| `tests/tauri-parity/e2e/notifications.spec.ts` | 4 | E2E notification parity tests |
| `tests/tauri-parity/e2e/view-rendering.spec.ts` | 4 | E2E view rendering parity tests |
| `tests/tauri-parity/WEBKIT_FAILURES.md` | 1 | WebKit failure catalog |
| `docs/sop/SOP-XXX-webkit-gtk-gotchas.md` | 6 | WebKitGTK reference doc |
| `docs/sop/checklists/tauri-parity-checklist.md` | 6 | Feature development checklist |

### Files to Modify (5)
| File | Phase | Change |
|------|-------|--------|
| `playwright.config.ts` | 1, 4 | Uncomment WebKit, add tauri-sim project |
| `.github/workflows/ci.yml` | 1, 5 | Add WebKit deps, add parity job |
| `package.json` | 5 | Add `test:tauri-parity` scripts |
| `scripts/deploy-tauri-update.sh` | 5 | Add pre-flight parity check |
| `CLAUDE.md` | 6 | Add Tauri parity rule |
| `tests/safety/css-syntax.test.ts` | 3 | Add WebKit compat check (optional, if integrated) |
