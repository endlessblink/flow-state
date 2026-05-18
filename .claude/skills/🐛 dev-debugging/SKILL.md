---
name: dev-debugging
description: UNIFIED DEBUGGER - Use when tasks disappear, data is lost, things are broken, or bugs need fixing. Debug Vue.js reactivity, Pinia state, task store CRUD, keyboard shortcuts, canvas positions, drag-drop, cache, memory leaks, and performance. Invoke for "not working", "broken", "fix bug", "debug", "tasks missing", "shortcuts not working", "state not updating".
---

## Automatic Skill Chaining

**IMPORTANT**: After completing debugging work, automatically invoke these skills:

1. **After fixing a bug** → Use `Skill(qa-testing)` to verify the fix with proper tests
2. **If canvas issues** → Use `Skill(vue-flow-debug)` for specialized Vue Flow debugging
3. **If Supabase issues** → Use `Skill(supabase-debugger)` for database/auth debugging

## When to Defer to Specialized Skills

| Issue Type | Use This Skill Instead |
|------------|------------------------|
| Canvas/Vue Flow issues | `Skill(vue-flow-debug)` |
| Supabase/Auth problems | `Skill(supabase-debugger)` |
| Port/server conflicts | `Skill(ops-port-manager)` |

**Use THIS skill** for: general Vue reactivity, Pinia state bugs, task store CRUD, keyboard shortcuts, memory leaks, performance issues, cross-cutting bugs spanning multiple systems.

---

## Debugging Methodology

Always follow this systematic approach — don't jump to conclusions:

1. **Identify**: Gather specific symptoms, error messages, and reproduction steps
2. **Isolate**: Use binary search to narrow down the root cause. Check the git log for recent changes that correlate with when the bug appeared.
3. **Verify**: After fixing, ensure the solution works AND doesn't introduce regressions
4. **Document**: Update MASTER_PLAN.md and relevant SOPs with the fix

---

## FlowState-Specific Debugging Knowledge

### Task Disappearing / Data Loss — The Kill Chain (BUG-1211)

This is a known and critical pattern. When tasks vanish after deletion or sync:

1. **Check `useSyncOrchestrator.ts`** — The sync queue has historically used wrong column names (`_soft_deleted` vs `is_deleted`). If soft-delete fails, the fallback hard-DELETE + tombstone causes permanent loss.
2. **Check `supabaseMappers.ts`** — Field mapping between Pinia camelCase and Supabase snake_case. Bypassing mappers causes silent failures.
3. **Check Realtime subscriptions** — A hard DELETE broadcasts to all devices via Supabase Realtime, causing every connected client to splice the task out.
4. **Check `taskStore.tasks` vs `taskStore._rawTasks`** — `tasks` is actually `filteredTasks` (applies view/project filters). Components that need ALL tasks must use `_rawTasks`.

### Keyboard Shortcuts Not Working

FlowState has **two parallel keyboard systems**:
- `src/composables/app/useAppShortcuts.ts` — App-level shortcuts (Ctrl+Z, etc.)
- `src/utils/globalKeyboardHandlerSimple.ts` — Global handler

Both have `shouldIgnoreElement` guards that suppress shortcuts when input/textarea is focused. Common causes:
- An orphaned overlay element stealing focus
- The async undo singleton (`useUndoRedo`) not initialized yet
- VueUse `useMagicKeys` is used ONLY for canvas modifier tracking, NOT for app shortcuts

### Canvas Position Issues

Read `docs/sop/canvas/CANVAS-POSITION-SYSTEM.md` for the full invariants. Key rules:
- Only drag handlers may change `parentId`, `canvasPosition`, `position`
- `useCanvasSync.ts` is READ-ONLY — must NEVER call `updateTask()` or `updateGroup()`
- `useCanvasOverdueCollector.ts` is QUARANTINED — do NOT re-enable (causes position drift)
- Dynamic node extent (`useCanvasFilteredState.ts`) must include BOTH task AND group positions, or groups near boundaries hit invisible walls (BUG-1310)

### Pinia-Supabase Sync Debugging

When diagnosing sync issues between Pinia stores and Supabase:
- **Direct save is PRIMARY** — VPS Supabase is source of truth, IndexedDB sync queue is backup only
- **Never remove direct saves** in favor of queue-only writes (BUG-1207 lesson)
- Echo protection uses `pendingWrites` (120s timeout, tied to sync completion)
- Duplicate key errors: sync queue CREATE should use `.upsert({ onConflict: 'id' })`, not `.insert()` (BUG-1212)

### Drag-Drop Issues (Kanban / Mobile)

- **vuedraggable bare boolean attrs** — Vue 3 `$attrs` passes bare booleans as `""` (falsy). SortableJS treats `""` as false. ALWAYS use `:force-fallback="true"` not `force-fallback` (BUG-1335)
- **Mobile touch events** — NEVER `preventDefault()` in `touchstart` (Android Chrome drops the gesture). Defer to `touchmove` after 10px lock threshold. Use `{ passive: true }` on touchstart. (BUG-1453)

---

## Canvas Testing Requirements

**ZERO TOLERANCE POLICY**: Never claim canvas fixes work without comprehensive visual testing.

Before claiming success, MANDATORY:
1. Start dev server (`npm run dev`, port 5546)
2. Test mouse events (click, drag, hover)
3. Test node selection (single and multi)
4. Test drag/drop (nodes move and drop correctly)
5. Test viewport (zoom, pan, transformations)
6. Test edge cases and boundary conditions

---

## Production & CDN Debugging

### When to Use
- App works locally but fails in production
- Chromium browsers fail, Firefox works
- `curl` shows correct response but browser fails
- MIME type errors in browser console

### Cloudflare Cache MIME Type Issue (CRITICAL)

**Symptom**: Chromium shows MIME type errors for CSS/JS, but `curl` returns correct content-type.

**Root Cause**: Cloudflare caches by URL only. Chromium's preload scanner sends `Accept: text/html`, and Cloudflare serves cached HTML instead of CSS/JS.

**Quick Diagnostic**:
```bash
curl -sI "https://in-theflow.com/assets/index.css" | grep -iE "vary|content-type"
# Must include: vary: Accept-Encoding, Accept
```

**Fix**: Add to Caddyfile on VPS:
```
@static path /assets/*
header @static Vary "Accept-Encoding, Accept"
```

### Browser-Specific Issues

| Works | Fails | Likely Cause |
|-------|-------|--------------|
| Firefox | Chrome/Brave | Cloudflare cache + preload scanner |
| curl | All browsers | Service Worker cache |
| Incognito | Normal mode | Browser cache |

### Chunk Load Failure (BUG-1184)

When user reports blank page/chunk errors:
1. Check CI/CD: `gh run list --limit 5` — common cause: uncommitted imported file
2. Three-layer hash comparison: Cloudflare vs VPS filesystem vs SW precache
3. Fix: redeploy if stale assets, purge CF cache if CDN mismatch

**Full reference**: `references/production-cdn-debugging.md`

---

## User Verification Protocol (MANDATORY)

**NEVER claim a bug is "fixed", "resolved", or "working" without user confirmation.**

1. **Technical verification**: Run tests, check console, take screenshots
2. **Ask the user** to verify with specific things to check
3. **Wait for confirmation** before marking complete
4. If user reports issues: continue debugging, repeat cycle

The user is the final authority on whether something is fixed. No exceptions.

---

## Test Infrastructure (March 2026)

### Test Suites Overview

| Suite | Command | Engine | What it catches |
|-------|---------|--------|-----------------|
| **Vitest (unit)** | `npm run test` | Node.js | Logic, CSS safety, mappers |
| **Playwright (E2E)** | `./scripts/run-e2e.sh` | Chromium + Apple WebKit | Functional UI, CRUD, navigation |
| **WebDriver (Tauri)** | `npx wdio tests/webdriver/wdio.conf.ts` | Real WebKitGTK | Tauri-specific rendering bugs |

### Playwright E2E — Critical Notes

- **Config**: `playwright.config.ts` — `testDir: './tests/e2e'`, `testMatch: '**/*.spec.ts'`
- **Auth**: Global setup creates test user `playwright@test.flowstate`, saves auth to `tests/.auth/user.json`
- **Must use** `./scripts/run-e2e.sh` (auto-fetches Supabase keys), NOT bare `npx playwright test`
- **3 projects**: chromium, webkit, tauri-simulation (all use Apple WebKit, NOT WebKitGTK)
- **602 tests** across 20 files — ~450 pass, ~126 fail, ~26 skip (as of March 2026)
- **Known limitation**: Cannot catch WebKitGTK-specific rendering bugs (BUG-1672 sidebar, BUG-1674 z-index)

### WebDriver (Real Tauri/WebKitGTK) — How to Run

```bash
# 1. Build debug binary with automation enabled
TAURI_WEBVIEW_AUTOMATION=true cargo tauri build --debug

# 2. Start tauri-driver (background)
nohup tauri-driver > /tmp/tauri-driver.log 2>&1 &

# 3. Verify it's listening
curl -s http://127.0.0.1:4444/status  # should return {"value":{"ready":true,...}}

# 4. Run tests
npx wdio tests/webdriver/wdio.conf.ts

# 5. Screenshots saved to .dev/screenshots/webdriver/
```

**Prerequisites**: `tauri-driver` (cargo install), `WebKitWebDriver` (webkit2gtk-driver package)
**Config**: `tests/webdriver/wdio.conf.ts` — uses debug binary at `src-tauri/target/debug/flow-state`
**Tests**: `tests/webdriver/specs/webkitgtk-layout-bugs.ts` — 15 tests for sidebar, z-index, CSS compat

### Confirmed WebKitGTK Bugs (caught by WebDriver, missed by Playwright)

| Bug | Test | Actual Value | Expected |
|-----|------|-------------|----------|
| **Project names clipped** (BUG-1672) | sidebar project names readable | 24px width | >100px |
| **overflow:clip hides content** | overflow:clip scrollable content | 1 element | 0 |

### Known Test False Positives

- **Font fallback test**: Matches "serif" inside "sans-serif" — needs regex fix to exclude `sans-serif`
- **View navigation tests**: Tests 4 & 5 navigate to `localhost:1420` but debug build embeds frontend — should use relative URLs or the embedded base URL

## Reference Files

Read these only when needed for the specific issue:

| File | When to read |
|------|-------------|
| `references/production-cdn-debugging.md` | Cloudflare/Caddy/VPS debugging in depth |
| `references/tauri-icon-troubleshooting.md` | Desktop icons not updating after Tauri build |
| `references/css-layout-debugging.md` | CSS shadow clipping, layout, overflow issues |

---

## Canvas "count ≠ render" diagnostic (May 2026)

When a canvas day-group shows a count like `12` but the rectangle appears empty, OR tasks float outside their group after a rotate / tidy — the data is almost always intact and the bug is a Pinia↔Vue Flow sync gap. **Don't delete or "recover" anything until you've run this checklist.**

### Quick sanity check before anything else

```bash
# Tasks updated in the last 15 min — verify canvas parent + position
ssh -i ~/.ssh/id_ed25519 root@84.46.253.137 \
  "docker exec supabase-db psql -U postgres -c \
   \"SELECT id, LEFT(title,30), due_date::date, \
            position->>'parentId' as canvas_parent, \
            position->>'x' as x, position->>'y' as y \
     FROM tasks WHERE is_deleted=false \
     AND updated_at > now() - interval '15 minutes' \
     ORDER BY updated_at DESC LIMIT 20;\""
```

**Important columns:**
- The real canvas parent is `position->>'parentId'` (text inside JSONB), **NOT** the top-level `parent_id` UUID column. The top-level column is unused by canvas — checking it will give a false "all NULL" signal.
- `is_deleted = false` confirms no actual deletion happened.
- Tombstones live in a separate `tombstones` table — query that to confirm no recent deletes:
  ```sql
  SELECT entity_id, entity_type, deleted_at
  FROM tombstones
  WHERE deleted_at > now() - interval '2 hours'
  ORDER BY deleted_at DESC LIMIT 20;
  ```

### If data is intact, the bug is rendering

Read the `vue-flow-debug` skill — the "Upstream Vue Flow gotchas" section (Discussion #1202 extent-then-parent dance, Issue #1630 change-handler race, the SMART-GROUP source bypass of BUG-1757) covers the actual fix patterns. The bug is **not** Electron-specific — it would manifest the same on the web build.

### Pattern: user thinks they deleted but the count persists

A common false alarm is "I deleted these but the count still shows them." Check:
1. Tombstones table for the time range — if zero rows, the delete never fired or never reached the queue.
2. The task rows themselves — `is_deleted = false` confirms they're still live.
3. If the user expected a soft-delete via canvas right-click "Remove from group" — that only clears `parentId`, it does not delete the task. The task moves to inbox / dateless view.

Tell the user honestly: "The tasks were never deleted — they're still in your data, just rendering in the wrong place." Don't run any recovery before confirming this.

### Source of truth tiebreaker

When Pinia store says one thing and Vue Flow renders another, **trust the DB** — that's the persisted truth. Force a `refreshRenderedNodesFromModel()` (clear-and-repopulate Vue Flow's nodes from `nodes.value`) to recover. If that doesn't help, the Pinia store itself is stale; reload the app.
