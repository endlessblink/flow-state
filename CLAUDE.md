# CLAUDE.md

# NEVER EVER CLAIM SUCCESS THAT SOMETHING IS READY, DONE, READY FOR PRODUCTION ETC UNTIL THE USER CONFIRMS IT by actually testing or using the feature!!!!

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
| Tauri Desktop | ✅ Working (Linux/Win/Mac releases) |
| VPS Production | ✅ Live (Contabo VPS, set VITE_SITE_URL) |
| Build/CI | ✅ Passing |
| AI Chat | ✅ Working (Groq/Ollama, Tauri-aware) |
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
npm run lint         # Lint code
npm run storybook    # Component docs (port 6006)
npm run generate:keys  # Regenerate Supabase JWT keys if they drift

# Tauri Desktop
npm run tauri build  # Build desktop app with signing (requires env vars)
npm run tauri:update-manifest  # Generate latest.json for auto-updater

# Deployment (auto via CI/CD on push to master)
# Manual deploy: npm run build && rsync -avz dist/ ${VPS_USER:-root}@${VPS_HOST}:/var/www/flowstate/
```

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
- **Tauri 2.x** for desktop distribution (Linux, Windows, macOS)
- **Caddy** reverse proxy + auto-SSL
- **Cloudflare** DNS + CDN + Origin Certificates
- **Doppler** for secrets management (CI/CD + production)

## Tauri Desktop Distribution & Auto-Updater

**Full SOPs:** [SOP-011](docs/sop/SOP-011-tauri-distribution.md) (builds/signing), [SOP-037](docs/sop/SOP-037-tauri-updater-signing.md) (updater/deployment)

**Deploy command (MANDATORY after code changes):**
```bash
./scripts/deploy-tauri-update.sh --notes "TASK-XXX: description"
```
Options: `--skip-deploy` (build only), `--dry-run` (preview). Fallback: `sudo dpkg -i src-tauri/target/release/bundle/deb/FlowState_*.deb` (local only, no auto-updater — only if user explicitly asks).

**Release workflow:** Bump version in 3 files (package.json, tauri.conf.json, Cargo.toml) → git tag → CI/CD auto-builds.
**Auto-updater endpoint:** `${VITE_SITE_URL}/updates/latest.json` — checks on app launch (3s delay), shows toast with "Download" button. Auto-update toggle in Settings > About.
**Signing key:** `~/.tauri/flow-state.key` (NEVER commit). Password in KWallet via `secret-tool`.

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

Both **VPS (web PWA)** and **Tauri (desktop)** distributions are active and production-ready.

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

1. **Test with Playwright First** - Use `npm run test:e2e` with the seeded test user. NEVER launch unauthenticated Playwright browsers.
2. **Preserve npm kill script** - NEVER remove from package.json
3. **Use Design Tokens** - Never hardcode colors/spacing (see `docs/claude-md-extension/design-system.md`)
4. **Type Safety** - All new code must have proper TypeScript types
5. **Check Task Dependencies** - See Task Dependency Index in `docs/MASTER_PLAN.md`
6. **NEVER Create Demo Data** - First-time users MUST see empty app, not sample data
7. **Database Safety** - NEVER run destructive database commands without user approval (see below)
8. **Atomic Tasks** - ALWAYS break broad requests into single-action steps (see below)
9. **Canvas Geometry Invariants** - Only drag handlers may change positions/parents. Sync is read-only. (see below)
10. **Completion Protocol** - NEVER claim "done" without artifacts + user verification (see below)
11. **Version Bump Protocol** - When releasing: update 3 files (package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml) + create git tag
12. **Auto-Updater Delivery (MANDATORY)** - After code changes, ALWAYS run `./scripts/deploy-tauri-update.sh --notes "TASK-XXX: description"` to build, sign, and deploy to VPS so the user receives the update via Tauri's in-app auto-updater. Never just offer `npm run dev` or local `dpkg -i` as the final delivery. See SOP-037 for details.
13. **No Client-Side API Keys (BUG-1131)** - NEVER use `VITE_` prefix for API keys/secrets. Cloud API keys go through Supabase Edge Function proxies. A build-time guard (`scripts/check-vite-secrets.cjs`) blocks builds with non-allowlisted VITE_ vars. To add a new safe VITE_ var, add it to the allowlist in that script.

## Completion Protocol (MANDATORY)

**Before starting:** Define SUCCESS and FAILURE criteria upfront (what observable outcome proves it works vs doesn't).

**After implementation — required artifacts:**

| Context | Required Artifacts |
|---------|-------------------|
| **Web UI changes** | Playwright screenshot, test output, git diff |
| **Tauri/Desktop app** | Console logs, test output, git diff, verification instructions |
| **Backend/API changes** | curl/API response, test output, database query results |
| **Build/Config changes** | Build output, npm run dev logs |
| **Pure logic changes** | Unit test output, git diff |

**Minimum for ANY change:** Git diff + test output + deploy via `./scripts/deploy-tauri-update.sh` + verification instructions for user.

**Completion phrase — NEVER say** "Done"/"Complete"/"Fixed". **ALWAYS say**: "I've implemented X. Here are the artifacts: [artifacts]. Can you test it and confirm it works?"

**Task Status:** Only mark ✅ DONE after USER explicitly confirms. Until then: 🔄 IN PROGRESS or 👀 REVIEW.

**Judge Agent:** For complex features, invoke via Dev-Maestro at `localhost:6010/api/judge/evaluate`.

## Design Token Usage (MANDATORY)

**NEVER hardcode CSS values** (rgba, px, hex). ALWAYS use design tokens from `src/assets/design-tokens.css`.

**Full reference:** [`docs/claude-md-extension/design-system.md`](docs/claude-md-extension/design-system.md)

**Quick examples:**
```css
/* ❌ WRONG */                    /* ✅ CORRECT */
background: rgba(18,18,20,0.98);  background: var(--overlay-component-bg);
padding: 8px 12px;                padding: var(--space-2) var(--space-3);
border-radius: 12px;              border-radius: var(--radius-lg);
```

### Button Pattern (CRITICAL — NEVER SOLID FILL)

**ALL buttons MUST use glass morphism. NEVER `background: var(--brand-primary); color: white;`**

```css
/* ✅ CORRECT — Glass morphism button */
background: var(--glass-bg-soft);
color: var(--brand-primary);
border: 1px solid var(--brand-primary);
backdrop-filter: blur(8px);

/* ❌ WRONG — Solid fill (FORBIDDEN) */
background: var(--brand-primary);
color: white;
border: none;
```

Tailwind classes: `.btn-primary` (glass+teal), `.btn-secondary` (surface+border), `.btn-ghost` (transparent).
Solid `var(--brand-primary)` background is ONLY acceptable for small indicators (checkbox fills, toggle dots, progress bars), NOT buttons.

## Atomic Task Breakdown (CRITICAL)

ALWAYS break broad requests into atomic steps (<2 min each, single success condition). NEVER "test all" or "fix everything" — causes extended thinking loops (3+ min stuck). If thinking >30 seconds: STOP and break down further.

**When spawning Task agents:** ONE specific task each, in PARALLEL. Each prompt completable with Yes/No answer. NEVER "test all" or "verify everything" prompts.

## Database Safety (CRITICAL)

**NEVER run these commands automatically:**
- `supabase db reset` - PERMANENTLY BLOCKED (wipes all data)
- `DROP DATABASE` / `DROP TABLE` / `TRUNCATE` - User must run manually
- `DELETE FROM` without WHERE clause - Blocked
- `supabase db push --force` - Blocked

**Before ANY migration:**
1. Create a backup first:
   ```bash
   mkdir -p supabase/backups
   supabase db dump > supabase/backups/backup-$(date +%Y%m%d-%H%M%S).sql
   ```
2. NEVER run destructive commands — Claude Code must refuse and tell the user to run manually

**Backup location:** `supabase/backups/` (not committed to git)

**Backup system:** Auto-backup every 5 min via `npm run dev`, recovery in Settings > Storage. Details: [`backup-system.md`](docs/claude-md-extension/backup-system.md). To reset DB: tell the user to run manually — Claude Code will NOT run destructive commands.

## Supabase Architecture

**Database Layer:** `useSupabaseDatabase.ts` (single source of truth for core CRUD). Type mappers: `supabaseMappers.ts`. Auth: `src/services/auth/supabase.ts` + `src/stores/auth.ts`.

**19 tables** (all RLS-enabled): 8 core (tasks, groups, projects, timer_sessions, pomodoro_history, notifications, user_settings, quick_sort_sessions), 2 data integrity (tombstones, task_dedup_audit), 7 gamification, 2 challenges. Full schema: see [`architecture.md`](docs/claude-md-extension/architecture.md).

**Access patterns:** Core → `useSupabaseDatabase.ts` | Gamification → `stores/gamification.ts` (intentional bypass) | Sync → `useSyncOrchestrator.ts`

## Timer Cross-Device Sync

Device leadership model: one device leads countdown, others follow. Vue App (WebSocket) = leader-capable, KDE Widget (REST polling 2s) = follower. Leader heartbeat every 10s, 30s timeout for leadership claim. User actions take precedence.

**CRITICAL:** Timer store MUST wait for auth before loading session (auth-aware init pattern, see [SOP-032](docs/sop/SOP-032-store-auth-initialization.md)). Key file: `src/stores/timer.ts`. Full SOP: [TIMER-sync-architecture](docs/sop/active/TIMER-sync-architecture.md).

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
**~29 composables** in `src/composables/canvas/` — see `ls src/composables/canvas/` or [`architecture.md`](docs/claude-md-extension/architecture.md).

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

## Dev Maestro

AI orchestration dashboard at `http://localhost:6010`. Start: `./maestro.sh`. Check: `curl -s localhost:6010/api/status`. Skill: `dev-maestro`.

**MASTER_PLAN.md Parsing:** Task headers use `### TASK-XXX: Title (STATUS)`. Completed: `### ~~TASK-XXX~~: Title (✅ DONE)`. Status keywords: `DONE`/`✅`, `IN PROGRESS`/`🔄`, `PAUSED`/`⏸️`, `REVIEW`/`👀`. Completed tasks need BOTH `~~strikethrough~~` AND `✅ DONE`. Full SOP: [SOP-031](docs/sop/SOP-031-dev-maestro-parser.md).

## UI Component Standards (MANDATORY)

**BEFORE creating any UI element**, check `src/components/base/` and `src/components/common/` for an existing component. This project has 20+ reusable primitives with glass morphism, keyboard nav, and Tauri compatibility built in. **NEVER** reinvent what already exists.

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

## Beads Agent Coordination

MASTER_PLAN.md auto-syncs to beads. **Never create beads manually** — the sync script manages them.

| Command | Purpose |
|---------|---------|
| `npm run mp:sync` | Full sync (also: `:dry`, `:force`) |
| `bd ready` | Find unblocked tasks |
| `bd update <id> --status=in_progress` | Claim a task |
| `bd blocked` | See dependency blockers |
| `bd close <id>` | Mark complete |

## Extended Documentation

**`docs/claude-md-extension/`:** architecture.md, code-patterns.md, testing.md, backup-system.md, design-system.md, troubleshooting.md

**SOPs (20+ procedures):** `docs/sop/` — see `docs/sop/README.md` for full index. Key SOPs referenced inline throughout this file.

## Skills Maintenance

| Command | Purpose |
|---------|---------|
| `npm run skills:sync` | Sync filesystem skills to `.claude/config/skills.json` |
| `npm run skills:staleness` | Detect stale, broken, or deprecated skills |
| `npm run docs:validate` | Validate all markdown links in docs |

**Skill Boundaries:** `smart-doc-manager` → docs/, MASTER_PLAN.md | `skill-creator-doctor` → .claude/skills/

---

**Last Updated**: February 18, 2026
**Stack**: Vue 3.5.26, Vite 7.3.1, TypeScript 5.9.3, Supabase (self-hosted), Tauri 2.10, tauri-cli 2.10.0
**Production**: Set `VITE_SITE_URL` + `VPS_HOST` env vars (Contabo VPS, Ubuntu 22.04)
