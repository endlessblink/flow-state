# CLAUDE.md

**Development Standards**: Read [`~/.claude/knowledge/constitution.md`](~/.claude/knowledge/constitution.md) for universal development rules that apply across all projects.

# ALWAYS USE THE CORRECT SKILL FOR THE TASK

# Project-Local Superpowers

This repo uses the official Codex `superpowers@openai-curated` plugin for automatic skill discovery, plus guarded project-local Superpowers skills under `.claude/skills/superpowers-*`.
Use them as support workflows for systematic debugging, TDD, verification, code review, and planning when they fit.
They do **not** override `AGENTS.md`, this `CLAUDE.md`, MASTER_PLAN tracking, OMX workflow state, branch safety, or Electron-first shipping requirements.
The FlowState router is the project-specific entrypoint. If upstream `using-superpowers`, worktree, or branch-finishing guidance conflicts with FlowState rules, follow FlowState.

**Auto-routing**: at the start of bugs, fixes, behavior changes, reviews, planning, and completion checks, use `.claude/skills/superpowers-flowstate-auto-router/SKILL.md` to choose the relevant `superpowers-*` support skill. Keep the router subordinate to FlowState rules and skip it for trivial chat or when a higher-priority workflow already clearly applies.

# MANDATORY Pre-Read for Major Work

**Before ANY major feature, refactoring, architecture decision, or multi-file change**, read these documents first:

- **System Architecture**: [`docs/claude-md-extension/system-architecture.md`](docs/claude-md-extension/system-architecture.md) — All views, stores, composables, services, features, data flow, and architectural constraints
- **Design System**: [`docs/claude-md-extension/design-system.md`](docs/claude-md-extension/design-system.md) — All design tokens, base/common components with props, button patterns, glass morphism rules

These are the source of truth for the app's current state. When delegating to agents, include: "Read docs/claude-md-extension/system-architecture.md and design-system.md first."

# MASTER_PLAN Workflow (MANDATORY)

**IMPORTANT: Follow this workflow for EVERY task:**

1. **Before starting**: Run `./scripts/utils/get-next-task-id.cjs` to get a unique ID, then add task to `docs/MASTER_PLAN.md` with proper ID format (TASK-XXX, BUG-XXX, etc.)
2. **During work**: Update progress and meaningful steps in MASTER_PLAN.md
3. **After completion**: Mark as ✅ DONE with strikethrough on ID **IN ALL LOCATIONS**

**CRITICAL - Marking Tasks Done:**
Tasks appear in **3 places** in MASTER_PLAN.md. Update ALL of them:
1. **Summary table** (~lines 100-200) - Change `📋 **PLANNED**` to `✅ **DONE**`, add strikethrough to ID
2. **Subtasks lists** - Add `~~strikethrough~~` and ✅ to bullet point
3. **Detailed section** - Update `(📋 PLANNED)` to `(✅ DONE)` in the `####` header

**Quick check**: After marking done, run `grep "TASK-XXX" docs/MASTER_PLAN.md` to verify all occurrences are updated.

Never begin implementation until the task is documented in MASTER_PLAN.md.

---

## Project Overview

**FlowState** - Vue 3 productivity app combining task management across Board, Calendar, and Canvas views with an integrated Pomodoro timer. Uses Supabase for persistence/auth with glass morphism design.

## Current Status

| Component | Status |
|-----------|--------|
| Canvas | ✅ Working |
| Board | ✅ Working |
| Calendar | ⚠️ Partial (resize issues) |
| Supabase Sync | ⚠️ Working (offline-first in progress: TASK-1177) |
| Backup System | ✅ Hardened (Smart Layers 1-3) |
| Timer Sync | ✅ Working (cross-device via Supabase Realtime) |
| KDE Widget | ✅ Working (packages/kde-widget/) |
| Electron Desktop | ✅ Working (Linux/Win/Mac releases) |
| VPS Production | ✅ Live (Contabo VPS, set VITE_SITE_URL) |
| Build/CI | ✅ Passing |
| AI Chat | ✅ Working (Groq/Ollama) |
| Gamification | ✅ Working (XP, achievements, shop) |
| Offline Sync | 🔄 In Progress (TASK-1177) |

**Full Tracking**: `docs/MASTER_PLAN.md`

## Essential Commands

```bash
# Development
npm run dev          # Start dev server (port 5546) - validates JWT keys first
npm run kill         # Kill all FlowState processes (CRITICAL - DO NOT REMOVE)
npm run build        # Production build
npm run test         # Run unit tests (Vitest)
npm run test:e2e     # Run E2E tests (Playwright) - auto-fetches Supabase keys
# LOW CPU E2E (use this to avoid PC lag):
# nice -n 15 npm run test:e2e -- --workers=2
npm run lint         # Lint code
npm run storybook    # Component docs (port 6006)
npm run generate:keys  # Regenerate Supabase JWT keys if they drift

# Electron Desktop
npm run electron:build  # Build desktop app (AppImage/deb/exe)
./scripts/deploy-electron-update.sh --notes "TASK-XXX: description"  # Build + deploy to VPS

# Deployment (auto via CI/CD on push to master)
# Manual deploy: npm run build && rsync -avz dist/ ${VPS_USER:-root}@${VPS_HOST}:/var/www/flowstate/
```

## Direct Database Operations (for data actions, cleanup, queries)

**Execute SQL** against local Supabase (no app needed):
```bash
# Single query
docker exec supabase_db_flow-state psql -U postgres -c "SQL_HERE"

# Multi-line
docker exec supabase_db_flow-state psql -U postgres <<'SQL'
SELECT * FROM tasks WHERE is_deleted = false LIMIT 5;
SQL
```

**User ID**: `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11`

**Key tables**: `tasks` (main), `projects`, `groups` (canvas), `timer_sessions`, `tombstones`, `pinned_tasks`, `notifications`, `user_gamification`, `user_settings`, `user_challenges`

**Task columns (most used)**: `id` (uuid), `title`, `status` (planned/in_progress/done/backlog/on_hold), `priority` (low/medium/high/NULL), `project_id` (uuid FK), `due_date` (timestamptz), `is_deleted` (bool), `deleted_at`, `is_in_inbox` (bool), `parent_id` (text, canvas group), `order` (int), `tags` (text[]), `subtasks` (jsonb), `created_at`, `updated_at`

**Safety protocol**:
1. ALWAYS run SELECT first to preview affected rows
2. Prefer soft-delete: `SET is_deleted = true, deleted_at = now()` over DELETE
3. On hard delete: also insert tombstone: `INSERT INTO tombstones (user_id, entity_type, entity_id) VALUES ('a0eebc99-...', 'task', 'TASK_UUID')`
4. ALWAYS set `updated_at = now()` on updates to trigger sync
5. Production DB queries need explicit user approval

**Full cookbook** (duplicates, orphans, bulk ops, stats): [`docs/claude-md-extension/database-operations.md`](docs/claude-md-extension/database-operations.md)

## Development Server

**With Doppler (production Supabase):** `doppler run -- npm run dev`
**Without Doppler (local Supabase):** `npm run dev` (requires manual `.env.local`)

**Rules:** Never edit `.env.local` manually (Doppler overwrites it). Never edit `.env` for Supabase URLs (use Doppler dashboard). Never run `npm run dev` alone when connecting to production.

## Tech Stack

- **Vue 3** + TypeScript + Vite + Pinia
- **Tailwind CSS** + Naive UI + Glass morphism
- **Vue Flow** for canvas, **Vuedraggable** for drag-drop
- **Supabase** (Postgres + Auth + Realtime) - Self-hosted on VPS
- **TipTap** for rich text editing
- **Electron** for desktop distribution (Linux, Windows, macOS)
- **Caddy** reverse proxy + auto-SSL
- **Cloudflare** DNS + CDN + Origin Certificates
- **Doppler** for secrets management (CI/CD + production)

## Electron Desktop Distribution & Auto-Updater

**Full SOP:** [SOP-065](docs/sop/SOP-065-electron-desktop-app.md) (builds, updater, deployment)

**Deploy command (MANDATORY after code changes):**
```bash
./scripts/deploy-electron-update.sh --notes "TASK-XXX: description"
```
Options: `--skip-deploy` (build only), `--dry-run` (preview).

**Release workflow:** Bump version in 2 files (package.json, electron-builder.yml) → git tag → CI/CD auto-builds.
**Auto-updater endpoint:** `${VITE_SITE_URL}/updates/latest.json` — checks on app launch, shows toast with "Download" button. Auto-update toggle in Settings > About.
**Signing:** No signing key required for Linux AppImage auto-updates.

## VPS Production Deployment

```
User (HTTPS) → Cloudflare (DNS/CDN) → Contabo VPS (Caddy) → Self-hosted Supabase
                                              ↓
                                      PWA Static Files (/var/www/flowstate)
```

**URLs:** Set via `VITE_SITE_URL` env var | **VPS:** Set `VPS_HOST` env var
**SSH:** `ssh -i ~/.ssh/id_ed25519 ${VPS_USER:-root}@${VPS_HOST}`

**Deployment:** CI/CD auto-deploys on push to master. Manual: `doppler run -- npm run build && rsync -avz --delete --exclude='updates/' dist/ ${VPS_USER:-root}@${VPS_HOST}:/var/www/flowstate/`

**Secrets:** NEVER store in `.env` on VPS — use Doppler. `.env` and `.env.production` are gitignored. Full SOP: [SOP-030](docs/sop/SOP-030-doppler-secrets-management.md).

**Local dev setup:** Copy `.env.example` to `.env.local`, run `supabase status` for keys.

**Caching facts** (affects deploy troubleshooting):
- `rsync --delete` removes old chunks immediately
- Cloudflare caches `/assets/*` for 1 year (immutable). `index.html` and `sw.js` are `no-cache`
- Workbox SW precaches chunk list at install time

**Chunk Load Failure Runbook (BUG-1184):** When user reports blank page/chunk errors:
1. Check CI/CD: `gh run list --limit 5` — common cause: uncommitted imported file
2. Three-layer hash comparison: Cloudflare vs VPS filesystem vs SW precache (details in MEMORY.md BUG-1184 section)
3. Fix: redeploy if stale assets, purge CF cache if CDN mismatch. Router auto-recovery unregisters stale SW.

**Full SOPs:** [VPS-DEPLOYMENT](docs/sop/deployment/VPS-DEPLOYMENT.md), [SOP-026](docs/sop/SOP-026-custom-domain-deployment.md), [SOP-031-CORS](docs/sop/SOP-031-cors-configuration.md), [PWA-CHECKLIST](docs/sop/deployment/PWA-DEPLOYMENT-CHECKLIST.md)

Both **VPS (web PWA)** and **Electron (desktop)** distributions are active and production-ready.

## Playwright E2E Testing (TASK-1457) — MANDATORY FOR ALL UI DEBUGGING

**CRITICAL: When using Playwright (debugging, screenshots, testing), you MUST use this infrastructure. Do NOT launch raw Playwright browsers — they will have no auth, no data, and you will waste time.**

**Run:** `npm run test:e2e` or `./scripts/run-e2e.sh` (auto-fetches Supabase keys from local instance)

**Run specific tests:** `npm run test:e2e -- --grep "Morning Dashboard"`

**Quick Playwright debug session** (authenticated, with seeded data):
```bash
# First ensure global-setup has run (creates test user + seeds data):
npm run test:e2e -- --grep "NEVER_MATCH" 2>/dev/null

# Then use the saved auth state in any Playwright script:
# storageState: 'tests/.auth/user.json' gives you an authenticated browser
```

**What you get:** An authenticated `playwright@test.flowstate` user with 2 projects (Work + Personal), 8 tasks (mixed statuses/priorities), 2 canvas groups, and user settings. All seeded automatically by `tests/global-setup.ts`.

**Test fixtures:**
- `tests/fixtures/auth.ts` — test user credentials, re-exports `test`/`expect`
- `tests/fixtures/test-ids.ts` — fixed UUIDs for all seeded data (projects, tasks, groups)

**Writing tests or debug scripts:**
```typescript
import { test, expect } from '../fixtures/auth'
import { TEST_TASKS, TEST_PROJECTS } from '../fixtures/test-ids'

test('tasks are visible', async ({ page }) => {
  // page is already authenticated — storageState is auto-loaded by playwright.config.ts
  await page.goto('/#/tasks')
  await expect(page.getByText(TEST_TASKS.designLandingPage.title)).toBeVisible()
})
```

**How it works internally:**
1. `global-setup.ts` creates/reuses the test user via Supabase Admin API (like any real user)
2. Wipes and re-seeds its data each run (clean slate)
3. Signs in via Supabase REST API, injects session into browser localStorage
4. Saves `storageState` to `tests/.auth/user.json` (gitignored)
5. `playwright.config.ts` auto-loads this storageState for all tests

**Required env vars** (auto-set by `npm run test:e2e`):
- `SUPABASE_SERVICE_ROLE_KEY` — for user creation and data seeding (bypasses RLS)
- `VITE_SUPABASE_ANON_KEY` — for browser auth

## Key Development Rules

Universal rules (completion, atomic tasks, design tokens, type safety, database safety, no demo data) are in the [Constitution](~/.claude/knowledge/constitution.md). FlowState-specific rules:

1. **Test with Playwright First** - Use `npm run test:e2e` with the seeded test user. NEVER launch unauthenticated Playwright browsers.
2. **Preserve npm kill script** - NEVER remove from package.json
3. **Check Task Dependencies** - See Task Dependency Index in `docs/MASTER_PLAN.md`
4. **Canvas Geometry Invariants** - Only drag handlers may change positions/parents. Sync is read-only. (see below)
5. **Version Bump Protocol** - When releasing: update 2 files (package.json, electron-builder.yml) + create git tag
6. **Auto-Updater Delivery (MANDATORY)** - After code changes, ALWAYS bump the version in `package.json` (patch increment) AND run `./scripts/deploy-electron-update.sh --notes "TASK-XXX: description"` to build and deploy to VPS. The Electron auto-updater only triggers when the version is higher than the installed one. Never skip the bump. Never just offer `npm run dev` or local install as the final delivery. See [SOP-065](docs/sop/SOP-065-electron-desktop-app.md).
7. **Electron Build On Every Production Push (MANDATORY)** - Whenever you push to production (CI/CD `master` deploy, manual `rsync` of `dist/`, or any `VITE_SITE_URL` web deploy), you MUST also build and deploy an Electron update in the same release:
    1. Bump `package.json` and `electron-builder.yml` version (patch increment).
    2. Run `./scripts/deploy-electron-update.sh --notes "TASK-XXX: description"`.
    3. Verify `${VITE_SITE_URL}/updates/latest.json` reflects the new version.

    Web PWA and Electron desktop share the same codebase. Shipping web-only leaves desktop users behind and silently breaks auto-update expectations. This extends rule 6 — it applies even when no Electron-specific code changed. Never ship web-only.
8. **No Client-Side API Keys (BUG-1131)** - Build-time guard (`scripts/check-vite-secrets.cjs`) blocks non-allowlisted VITE_ vars. Cloud API keys go through Supabase Edge Function proxies.
9. **No Images in Project Root** - Save to `.dev/screenshots/` instead. PreToolUse hook enforces this.
10. **WebKitGTK Parity (legacy, Tauri era)** - Tauri was replaced by Electron. Some patterns (`:force-fallback="true"` on vuedraggable, `dragData` singleton, deep-cloning for IndexedDB) may still be relevant. Full reference: [`docs/sop/SOP-060-webkitgtk-gotchas.md`](docs/sop/SOP-060-webkitgtk-gotchas.md).

## Completion Protocol — See [Constitution](~/.claude/knowledge/constitution.md#completion-protocol) for full rules.

**FlowState-specific:** Deploy via `./scripts/deploy-electron-update.sh`. Judge Agent: `localhost:6010/api/judge/evaluate`.

## Design Token Usage — See [Constitution](~/.claude/knowledge/constitution.md#frontend-standards) for universal rules.

**FlowState tokens:** `src/assets/design-tokens.css`. Full reference: [`docs/claude-md-extension/design-system.md`](docs/claude-md-extension/design-system.md).
Tailwind classes: `.btn-primary` (glass+teal), `.btn-secondary` (surface+border), `.btn-ghost` (transparent).

## Atomic Task Breakdown — See [Constitution](~/.claude/knowledge/constitution.md#atomic-task-breakdown) for full rules.

## Database Safety — See [Constitution](~/.claude/knowledge/constitution.md#database-safety) for universal rules.

**FlowState-specific:**
- `supabase db reset` / `supabase db push --force` -- PERMANENTLY BLOCKED
- Backup before migration: `supabase db dump > supabase/backups/backup-$(date +%Y%m%d-%H%M%S).sql`
- Auto-backup every 5 min via `npm run dev`, recovery in Settings > Storage. Details: [`backup-system.md`](docs/claude-md-extension/backup-system.md).

## Supabase Architecture

**Database Layer:** `useSupabaseDatabase.ts` (single source of truth for core CRUD). Type mappers: `supabaseMappers.ts`. Auth: `src/services/auth/supabase.ts` + `src/stores/auth.ts`.

**32 tables** (all RLS-enabled): 8 core (tasks, groups, projects, timer_sessions, pomodoro_history, notifications, user_settings, quick_sort_sessions), 2 data integrity (tombstones, task_dedup_audit), 7 gamification, 2 challenges, 5 workspace (workspaces, workspace_members, workspace_invites, task_comments, workspace_activity), 3 AI (ai_conversations, ai_usage_log, ai_work_profiles), 2 integrations (push_subscriptions, whatsapp_conversations), 2 additional (pinned_tasks, task_audit_log), 1 arena (arena_runs). Full schema: see [`system-architecture.md`](docs/claude-md-extension/system-architecture.md).

**Access patterns:** Core → `useSupabaseDatabase.ts` | Gamification → `stores/gamification.ts` (intentional bypass) | Sync → `useSyncOrchestrator.ts`

## Timer Cross-Device Sync

Device leadership model: one device leads countdown, others follow. Vue App (WebSocket) = leader-capable, KDE Widget (REST polling 2s) = follower. Leader heartbeat every 10s, 30s timeout for leadership claim. User actions take precedence.

**CRITICAL:** Timer store MUST wait for auth before loading session (auth-aware init pattern, see [SOP-050](docs/sop/SOP-050-store-auth-initialization.md)). Key file: `src/stores/timer.ts`. Full SOP: [TIMER-sync-architecture](docs/sop/active/TIMER-sync-architecture.md).

## Timer Active Task Highlighting

Running timer highlights task with amber glow + pulse. Pattern: `isTimerActive = computed(() => timerStore.isTimerActive && timerStore.currentTaskId === task.id)`, bind `{ 'timer-active': isTimerActive }`. Tokens: `--timer-active-border`, `--timer-active-glow`. Full details: [SOP-012](docs/sop/SOP-012-timer-active-highlight.md).

## Supabase JWT Key Validation

Local and production use DIFFERENT JWT secrets — never mix them. `npm run dev` auto-validates local keys. If mismatch: run `npm run generate:keys`. For production 401 errors: check Doppler keys match VPS keys, see [SOP-036](docs/sop/SOP-036-supabase-jwt-key-regeneration.md).

## Canvas Position Persistence (CRITICAL)

**DO NOT** add code that causes canvas positions to reset.

**Architecture Rules:**
- `useCanvasSync.ts` is the SINGLE source of sync for canvas nodes (READ-ONLY)
- NEVER add watchers in `canvas.ts` that call `syncTasksToCanvas()`
- Vue Flow positions are authoritative for existing nodes
- Position locks (7s timeout) must be respected during sync

**Before modifying canvas sync:** Run `npm run test -- --grep "Position Persistence"` + manual drag/refresh test.
**~29 composables** in `src/composables/canvas/` — see `ls src/composables/canvas/` or [`system-architecture.md`](docs/claude-md-extension/system-architecture.md).

## Canvas Geometry Invariants (CRITICAL)

Full SOP: [CANVAS-POSITION-SYSTEM](docs/sop/canvas/CANVAS-POSITION-SYSTEM.md)

1. **Single Writer** — Only drag handlers may change `parentId`, `canvasPosition`, `position`
2. **Sync is Read-Only** — `useCanvasSync.ts` MUST NEVER call `updateTask()` or `updateGroup()`
3. **Metadata Only** — Smart-Groups update `dueDate`/`status`/`priority`, NEVER geometry

**Quarantined:** `useCanvasOverdueCollector.ts` — DO NOT RE-ENABLE (violates geometry invariants, causes position drift).

## MASTER_PLAN.md Task ID Format

| Prefix | Usage |
|--------|-------|
| `TASK-XXX` | Active work features/tasks |
| `BUG-XXX` | Bug fixes |
| `ROAD-XXX` | Roadmap items |
| `IDEA-XXX` | Ideas |
| `ISSUE-XXX` | Known issues |

**Rules:**
- IDs must be sequential (TASK-001, TASK-002...)
- Completed items: `~~TASK-001~~` with strikethrough
- **NEVER reuse IDs** - Always run `./scripts/utils/get-next-task-id.cjs` first

## Watchpost

AI orchestration dashboard at `http://localhost:6010`. Start: `./watchpost.sh`. Check: `curl -s localhost:6010/api/status`. Skill: `watchpost`.

**MASTER_PLAN.md Parsing:** Task headers use `### TASK-XXX: Title (STATUS)`. Completed: `### ~~TASK-XXX~~: Title (✅ DONE)`. Status keywords: `DONE`/`✅`, `IN PROGRESS`/`🔄`, `PAUSED`/`⏸️`, `REVIEW`/`👀`. Completed tasks need BOTH `~~strikethrough~~` AND `✅ DONE`. Full SOP: [SOP-049](docs/sop/SOP-049-watchpost-parser.md).

**Watchpost CLI** (installed at `~/.local/bin/watchpost`, works from any project directory):

| Command | Purpose |
|---------|---------|
| `watchpost tui` | Terminal kanban board |
| `watchpost archive` | Archive DONE tasks >14 days old to `MASTER_PLAN_ARCHIVE.md` |
| `watchpost archive --dry-run` | Preview archive without writing |
| `watchpost archive --days=30` | Custom age threshold |

## UI Component Standards (MANDATORY)

**BEFORE creating any UI element**, check `src/components/base/` and `src/components/common/` for an existing component. This project has 20+ reusable primitives with glass morphism, keyboard nav, and cross-platform compatibility built in. **NEVER** reinvent what already exists.

| Need | Use This | NEVER Use |
|------|----------|-----------|
| Buttons | `BaseButton` (variant: primary\|secondary\|ghost\|danger\|active) | Ad-hoc `<button>` with inline styles |
| Icon buttons | `BaseIconButton` (variant: default\|primary\|success\|warning\|danger) | Manual icon `<button>` |
| Text inputs | `BaseInput` (label, helper text, prefix/suffix slots, RTL) | Native `<input>` without wrapper |
| Dropdowns | `CustomSelect` (ONLY dropdown — see below) | Native `<select>`, `<NSelect>`, `BaseDropdown` |
| Context menus | `ContextMenu` | Browser right-click menus |
| Modals | `BaseModal` (size: sm\|md\|lg\|xl\|full) | Custom modal divs |
| Delete confirms | `ConfirmationModal` (wraps BaseModal) | Building delete dialogs from scratch |
| Popovers | `BasePopover` (variant: menu\|tooltip\|dropdown) | Manual positioned divs |
| Status pills | `BaseBadge` (variant: default\|success\|warning\|danger\|info\|count) | Inline `<span>` for status |
| Cards | `BaseCard` (glass prop for glass morphism) | Manual `div.glass` CSS |
| Markdown display | `MarkdownRenderer` | Raw `v-html` or new markdown libs |
| Markdown editing | `MarkdownEditor` (wraps TipTap) | New rich-text library |
| Task completion | `DoneToggle` (animated, celebration particles) | Native checkbox for done state |
| Project icons | `ProjectEmojiIcon` (emoji\|SVG\|gradient) | Plain text emoji rendering |
| Overflow text | `OverflowTooltip` (tooltip only when text overflows) | Manual text truncation |

**All base components:** `src/components/base/` | **All common components:** `src/components/common/`
**Storybook:** `🧩 Primitives/*` at http://localhost:6006

### CustomSelect — The ONLY Dropdown Component

**Import:** `import CustomSelect from '@/components/common/CustomSelect.vue'`

```vue
<CustomSelect
  v-model="selectedValue"
  :options="[
    { label: 'Option A', value: 'a' },
    { label: 'Option B', value: 'b' },
  ]"
  placeholder="Select..."
  :compact="false"
/>
```

**Props:** `modelValue: string | number | null`, `options: { label: string, value: string | number }[]`, `placeholder?: string`, `compact?: boolean`
**Emits:** `update:modelValue`

## Multi-Instance Task Locking

This project has automatic task locking via `task-lock-enforcer.sh` hook to prevent conflicts when multiple Claude Code instances edit the same files.

**Lock files**: `.claude/locks/TASK-XXX.lock`
**Lock expiry**: 4 hours (stale locks auto-cleaned)

## Task Archival

| Command | Purpose |
|---------|---------|
| `npm run mp:archive` | Archive DONE tasks >14 days to `MASTER_PLAN_ARCHIVE.md` (also: `:dry`) |

## Extended Documentation

**`docs/claude-md-extension/`:** system-architecture.md, code-patterns.md, testing.md, backup-system.md, design-system.md, troubleshooting.md, **database-operations.md** (DB queries, bulk actions, cleanup recipes)

**SOPs (20+ procedures):** `docs/sop/` — see `docs/sop/README.md` for full index. Key SOPs referenced inline throughout this file.

## Skills Maintenance

| Command | Purpose |
|---------|---------|
| `npm run skills:sync` | Sync filesystem skills to `.claude/config/skills.json` |
| `npm run skills:staleness` | Detect stale, broken, or deprecated skills |
| `npm run docs:validate` | Validate all markdown links in docs |

**Skill Boundaries:** `smart-doc-manager` → docs/, MASTER_PLAN.md | `skill-creator-doctor` → .claude/skills/

---

**Last Updated**: April 5, 2026
**Stack**: Vue 3.5.26, Vite 7.3.1, TypeScript 5.9.3, Supabase (self-hosted), Electron (electron-builder)
**Production**: Set `VITE_SITE_URL` + `VPS_HOST` env vars (Contabo VPS, Ubuntu 22.04)
