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

## Reference Files

Read these only when needed for the specific issue:

| File | When to read |
|------|-------------|
| `references/production-cdn-debugging.md` | Cloudflare/Caddy/VPS debugging in depth |
| `references/tauri-icon-troubleshooting.md` | Desktop icons not updating after Tauri build |
| `references/css-layout-debugging.md` | CSS shadow clipping, layout, overflow issues |
