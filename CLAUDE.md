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
| Canvas | ✅ Working (groups, nesting, drag-drop) |
| Board | ✅ Working (Kanban swimlanes) |
| Calendar | ⚠️ Partial (resize issues) |
| Supabase Sync | ✅ Working (RLS enabled) |
| Backup System | ✅ Hardened (Smart Layers 1-3) |
| Timer Sync | ✅ Working (cross-device, KDE widget) |
| KDE Widget | ✅ Working (`kde-widget/`) |
| Tauri Desktop | ✅ Working (Linux/Win/Mac releases) |
| VPS Production | ✅ Live at in-theflow.com (Contabo) |
| Build/CI | ✅ Passing |

**Full Tracking**: `docs/MASTER_PLAN.md`

## Essential Commands

```bash
# Development
npm run dev          # Start dev server (port 5546) - validates JWT keys first
npm run kill         # Kill all FlowState processes (CRITICAL - DO NOT REMOVE)
npm run build        # Production build
npm run test         # Run tests
npm run lint         # Lint code
npm run storybook    # Component docs (port 6006)
npm run generate:keys  # Regenerate Supabase JWT keys if they drift

# Deployment (auto via CI/CD on push to master)
# Manual deploy: npm run build && rsync -avz dist/ root@84.46.253.137:/var/www/flowstate/
```

## Development Server with Doppler (IMPORTANT)

**Always start the dev server with Doppler:**
```bash
doppler run -- npm run dev
```

**What happens:**
1. Doppler injects secrets as environment variables
2. `scripts/sync-doppler.sh` writes secrets to `.env.local`
3. Vite reads from `.env.local` (not `.env`)
4. Auth user verified, Supabase keys validated
5. Dev server + backup daemon start concurrently

**Never do:**
- `npm run dev` alone (secrets won't be injected from Doppler)
- Edit `.env` for Supabase URLs (use Doppler dashboard)
- Edit `.env.local` manually (gets overwritten by Doppler sync)

**Note:** If you're using local Supabase with manual `.env.local` setup (see "Local Development Setup" below), `npm run dev` works without Doppler. Doppler is required when connecting to production/staging Supabase.

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

## Tauri Desktop Distribution

FlowState is distributed as a native desktop app via Tauri. The app auto-orchestrates Docker + Supabase on launch.

**Full SOP:** [`docs/sop/SOP-011-tauri-distribution.md`](docs/sop/SOP-011-tauri-distribution.md)

| Command | Purpose |
|---------|---------|
| `npm run tauri build` | Build desktop app locally |
| `npm run tauri dev` | Run in Tauri dev mode |

**Release workflow:** Push a git tag (`v0.1.0`) to trigger GitHub Actions multi-platform builds.

**Key Files:**
```
src-tauri/tauri.conf.json              # App config, version, updater
src-tauri/src/lib.rs                   # Rust commands (Docker/Supabase orchestration)
src/composables/useTauriStartup.ts     # Frontend startup sequence
.github/workflows/release.yml          # CI/CD release workflow
```

### Local Tauri Build & Install (MANDATORY for Testing)

**After implementing features, ALWAYS build and provide install command:**

```bash
# Build production Tauri app
npm run build && npx tauri build

# Install the .deb package (Linux)
sudo dpkg -i /media/endlessblink/data/my-projects/ai-development/productivity/flow-state/src-tauri/target/release/bundle/deb/FlowState_*.deb
```

**Output location:** `src-tauri/target/release/bundle/deb/FlowState_X.X.X_amd64.deb`

Then launch **FlowState** from the app menu to test in production.

## VPS Production Deployment (Contabo)

FlowState runs as a **PWA on a Contabo VPS** at `in-theflow.com` with self-hosted Supabase. This is separate from the Tauri desktop distribution.

### Architecture

```
User (HTTPS) → Cloudflare (DNS/CDN) → Contabo VPS (Caddy) → Self-hosted Supabase
                                              ↓
                                      PWA Static Files (/var/www/flowstate)
```

### Production URLs

| Domain | Purpose |
|--------|---------|
| `in-theflow.com` | PWA frontend |
| `api.in-theflow.com` | Supabase API (self-hosted) |
| `www.in-theflow.com` | Redirect to main |

### VPS Specifications (Contabo Cloud VPS 2)

| Spec | Value |
|------|-------|
| Provider | Contabo |
| OS | Ubuntu 22.04 LTS |
| vCPU | 6 cores |
| RAM | 16 GB |
| Storage | NVMe SSD |
| IP | 84.46.253.137 |

**Why Contabo**: Cost-effective for self-hosted Supabase (~€5.60/mo). Supabase full stack requires 8-16GB RAM minimum.

### Deployment Methods

| Method | Trigger | What Deploys |
|--------|---------|--------------|
| **CI/CD** (Primary) | Push to master | PWA static files via rsync |
| **Manual** | `npm run build` + rsync | PWA static files |

**CI/CD Workflow** (`.github/workflows/deploy.yml`):
1. Builds Vue app with production env
2. Fetches secrets from Doppler
3. Rsyncs `dist/` to VPS `/var/www/flowstate/`
4. Reloads Caddy (graceful, no downtime)
5. Validates CORS + health checks

### Secrets Management (Doppler)

**NEVER store secrets in `.env` files on VPS.** Use Doppler for production secrets.

**Full SOP:** [`docs/sop/SOP-030-doppler-secrets-management.md`](docs/sop/SOP-030-doppler-secrets-management.md)

| Secret Location | Secrets |
|-----------------|---------|
| **Doppler** (`flowstate-prod`) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GROQ_API_KEY` |
| **GitHub Secrets** | `DOPPLER_TOKEN`, `SSH_PRIVATE_KEY`, `VPS_HOST`, `VPS_USER` |

**Local Development Setup:**
1. Copy `.env.example` to `.env` (or `.env.local`)
2. Run `supabase status` to get your local Supabase keys
3. Fill in the values from `supabase status` output

**Note:** `.env` and `.env.production` are gitignored - Doppler is the single source of truth for all environments.

### Infrastructure Stack

| Component | Technology | Location |
|-----------|------------|----------|
| Reverse Proxy | Caddy | System service (`/etc/caddy/Caddyfile`) |
| SSL/TLS | Cloudflare Origin Certificate | `/etc/caddy/certs/` (15-year validity) |
| DNS/CDN | Cloudflare (proxied) | Orange cloud enabled |
| Database | PostgreSQL (Supabase) | Docker at `/opt/supabase/docker/` |
| Static Files | PWA build | `/var/www/flowstate/` |
| Secrets | Doppler | Fetched at build time |

### Key VPS Paths

```
/var/www/flowstate/           # PWA static files (deployment target)
/opt/supabase/docker/         # Self-hosted Supabase installation
/etc/caddy/Caddyfile          # Caddy configuration
/etc/caddy/certs/             # Cloudflare origin certificates
```

### Contabo-Specific Considerations

**Gotchas to Know:**
- No built-in firewall GUI - configure via `ufw` manually
- No live chat support - email-only during business hours
- VNC passwords sent in plain text email (avoid VNC console)
- No DDoS protection - Cloudflare proxy provides this
- Cannot scale RAM/CPU independently (must upgrade entire plan)

**Security Hardening (Already Applied):**
- SSH on custom port (not 22)
- UFW firewall enabled (80, 443, SSH only)
- Fail2Ban monitoring SSH
- Root login disabled
- Password auth disabled (SSH keys only)

**Maintenance Commands:**
```bash
# SSH into VPS
ssh root@84.46.253.137 -p <custom-port>

# Check Caddy status
systemctl status caddy

# View Caddy logs
journalctl -u caddy -f

# Restart Supabase
cd /opt/supabase/docker && docker compose restart

# Check disk space
df -h

# Docker resource usage
docker stats
```

### Backup Strategy

**Database Backups:**
```bash
# Manual backup
docker exec supabase-db pg_dumpall -U postgres > backup-$(date +%Y%m%d).sql

# Automated via cron (recommended)
# See docs/sop/deployment/VPS-DEPLOYMENT.md
```

**Application Backups:**
- FlowState's built-in Shadow Mirror backup (Settings > Storage)
- Supabase database snapshots
- External backup via Rclone to S3/B2 (optional)

### Deployment SOPs

| SOP | Purpose |
|-----|---------|
| [`SOP-026-custom-domain-deployment.md`](docs/sop/SOP-026-custom-domain-deployment.md) | Domain, Cloudflare, Caddy setup |
| [`SOP-030-doppler-secrets-management.md`](docs/sop/SOP-030-doppler-secrets-management.md) | Secrets management |
| [`SOP-031-cors-configuration.md`](docs/sop/SOP-031-cors-configuration.md) | CORS troubleshooting |
| [`deployment/VPS-DEPLOYMENT.md`](docs/sop/deployment/VPS-DEPLOYMENT.md) | Full VPS setup guide |
| [`deployment/PWA-DEPLOYMENT-CHECKLIST.md`](docs/sop/deployment/PWA-DEPLOYMENT-CHECKLIST.md) | Pre/post deploy verification |

### Deployment vs Desktop (Side-by-Side)

| Aspect | VPS (Web) | Tauri (Desktop) |
|--------|-----------|-----------------|
| **Delivery** | Browser URL | Native installer |
| **Database** | Shared Supabase on VPS | Local Supabase per user |
| **Offline** | Service worker (limited) | Full offline (local DB) |
| **Updates** | Auto (CI/CD) | Auto-updater (GitHub releases) |
| **Target Users** | Web access, mobile | Power users, full control |

**Both are active and production-ready.**

## Key Development Rules

1. **Test with Playwright First** - Visual confirmation mandatory before claiming features work
2. **Preserve npm kill script** - NEVER remove from package.json
3. **Use Design Tokens** - Never hardcode colors/spacing (see `docs/claude-md-extension/design-system.md`)
4. **Type Safety** - All new code must have proper TypeScript types
5. **Check Task Dependencies** - See Task Dependency Index in `docs/MASTER_PLAN.md`
6. **NEVER Create Demo Data** - First-time users MUST see empty app, not sample data
7. **Database Safety** - NEVER run destructive database commands without user approval (see below)
8. **Atomic Tasks** - ALWAYS break broad requests into single-action steps (see below)
9. **Canvas Geometry Invariants** - Only drag handlers may change positions/parents. Sync is read-only. (see below)
10. **Completion Protocol** - NEVER claim "done" without artifacts + user verification (see below)

## Completion Protocol (MANDATORY - TASK-334)

**Problem**: Self-verification is fundamentally flawed. Claude can write tests that pass but don't verify the right things.

**Solution**: 5-Layer Defense System. EVERY completed task must follow this protocol.

### Before Starting Any Task (Layer 3: Falsifiability)

**MANDATORY**: Define success/failure criteria BEFORE implementation.

```
TEMPLATE:
┌─────────────────────────────────────────────────────────┐
│ Task: [What you're implementing]                        │
│ SUCCESS: [Observable outcome that proves it works]      │
│ FAILURE: [What would prove it DOESN'T work]             │
└─────────────────────────────────────────────────────────┘

EXAMPLE:
┌─────────────────────────────────────────────────────────┐
│ Task: Implement backup restore                          │
│ SUCCESS: User clicks restore → sees previous data →     │
│          can create/edit tasks normally                 │
│ FAILURE: Button errors, data doesn't appear, data is    │
│          corrupted, or can't interact with restored data│
└─────────────────────────────────────────────────────────┘
```

### After Implementation (Layer 1: Artifacts)

**MANDATORY**: Provide context-aware proof before ANY "done" claim.

| Context | Required Artifacts |
|---------|-------------------|
| **Web UI changes** | Playwright screenshot, test output, git diff |
| **Tauri/Desktop app** | Console logs, test output, git diff, step-by-step verification instructions |
| **Backend/API changes** | curl/API response, test output, database query results |
| **Database changes** | Before/after query results, migration logs |
| **Build/Config changes** | Build output, npm run dev logs |
| **Pure logic changes** | Unit test output, git diff |

**Minimum for ANY change:**
```
├── Git diff (what changed)
├── Test output (existing tests pass)
└── Verification instructions (how USER can test it)
```

### Completion Phrase (Layer 4: User Confirmation)

**NEVER say**: "Done", "Complete", "Working", "Ready", "Fixed", "Implemented"

**ALWAYS say**: "I've implemented X. Here are the artifacts: [artifacts]. Can you test it and confirm it works?"

**Task Status**:
- Only mark MASTER_PLAN tasks as ✅ DONE after USER explicitly confirms
- Until user confirms: keep status as 🔄 IN PROGRESS or 👀 REVIEW

### What Gets Blocked

The enforcement hooks will BLOCK:
- "Done" claims without recent test run (`npm run test`)
- Completion without git diff provided
- Stopping without asking user to verify

### Judge Agent (Layer 5)

For complex features, a separate judge agent (integrated with Dev-Maestro) evaluates:
- Did artifacts match the claimed work?
- Were success criteria from Layer 3 met?
- Are there obvious gaps?

**To invoke**: Available via Dev-Maestro at http://localhost:6010 or `/api/judge/evaluate`

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

## Atomic Task Breakdown (CRITICAL)

**Problem:** Broad tasks like "test all features" or "fix everything" cause extended thinking loops (3+ minutes stuck).

**Solution:** ALWAYS break down broad requests automatically:

```
❌ BAD: "Test parent-child features"
✅ GOOD: Break into atomic steps:
   1. Check if groups show task count badges
   2. Verify dragging task into group works
   3. Confirm group drag moves children
```

**When user asks for multiple things at once:**
1. Use TodoWrite to create atomic task list
2. Work on ONE task at a time
3. Complete and mark done before starting next
4. NEVER try to solve "all three issues" simultaneously

**Atomic task criteria:**
- Can be completed in <2 minutes
- Has single, clear success condition
- Doesn't require analyzing multiple systems at once

**If you catch yourself thinking for >30 seconds:** STOP. Break the task down further.

**CRITICAL: When spawning Task agents:**
- NEVER use prompts like "test all", "verify everything", "fix all issues"
- ALWAYS spawn MULTIPLE agents in PARALLEL with ONE specific task each
- Each agent prompt must be completable in <2 minutes with Yes/No answer

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
2. The `destructive-command-blocker.sh` hook will BLOCK migrations without recent backup

**Backup location:** `supabase/backups/` (not committed to git)

**Dual-Engine Backup System:** See [`docs/claude-md-extension/backup-system.md`](docs/claude-md-extension/backup-system.md) for full details.
- Auto-backup every 5 minutes via `npm run dev`
- Recovery UI: Settings > Storage tab

**Hook enforcement:** `.claude/hooks/destructive-command-blocker.sh`

**If you need to reset the database:**
- Tell the user to run the command MANUALLY in their terminal
- Claude Code cannot and will not run destructive commands

## Supabase Architecture

**Database Layer:** `useSupabaseDatabase.ts` (single source of truth)
- All CRUD operations go through this composable
- Type mappers in `src/utils/supabaseMappers.ts` convert between app/DB types
- Auth via `src/services/auth/supabase.ts` + `src/stores/auth.ts`

**Tables (with RLS enabled):**
- `tasks` - Task data with user isolation
- `groups` - Canvas groups/sections
- `projects` - Project organization
- `timer_sessions` - Pomodoro session history
- `notifications` - Scheduled notifications
- `user_settings` - User preferences
- `quick_sort_sessions` - QuickSort session data

**Key Files:**
```
src/composables/useSupabaseDatabase.ts   # Main database composable
src/utils/supabaseMappers.ts              # Type conversion
src/services/auth/supabase.ts             # Supabase client init
src/stores/auth.ts                        # Auth state management
```

## Timer Cross-Device Sync

**Architecture:** Device leadership model where one device "leads" the countdown and others follow.

| Device | Role | Sync Method |
|--------|------|-------------|
| Vue App | Leader-capable | Supabase Realtime (WebSocket) |
| KDE Widget | Follower | REST API polling (2s interval) |

**Key Rules:**
- Leader sends heartbeat every 10 seconds (`device_leader_last_seen`)
- Followers apply drift correction based on time since last heartbeat
- 30-second timeout before another device can claim leadership
- User's explicit action (start/pause) takes precedence over stale leadership

**Critical Pattern - Auth-Aware Initialization:**
```typescript
// Timer store MUST wait for auth before loading session
watch(
  () => authStore.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated && !hasLoadedSession.value) {
      initializeStore()  // Now userId is available
    }
  },
  { immediate: true }
)
```

**Full SOP:** [`docs/sop/active/TIMER-sync-architecture.md`](docs/sop/active/TIMER-sync-architecture.md)

**Key Files:**
```
src/stores/timer.ts                      # Timer state + leadership logic
kde-widget/package/contents/ui/main.qml  # KDE Plasma widget
```

## Timer Active Task Highlighting

When a timer is running, the associated task is visually highlighted across all views with an amber glow + pulse animation.

**Full SOP:** [`docs/sop/SOP-012-timer-active-highlight.md`](docs/sop/SOP-012-timer-active-highlight.md)

**Quick Pattern:**
```typescript
const timerStore = useTimerStore()
const isTimerActive = computed(() =>
  timerStore.isTimerActive && timerStore.currentTaskId === props.task.id
)
// Add class binding: { 'timer-active': isTimerActive }
```

**Design Tokens:** `--timer-active-border`, `--timer-active-glow`, `--timer-active-glow-strong`

## Supabase JWT Key Validation

**Problem:** JWT keys must be signed with the same secret as the Supabase instance. Mismatched keys cause 401 Unauthorized and `JwtSignatureError` errors.

### Local vs Production Keys

| Environment | JWT Secret | Keys Location |
|-------------|-----------|---------------|
| **Local Supabase** | `super-secret-jwt-token-with-at-least-32-characters-long` | `.env` |
| **Production (VPS)** | `your-super-secret-jwt-token-with-at-least-32-characters-long` | Doppler + VPS `.env` |

**CRITICAL:** Local and production use DIFFERENT JWT secrets. Never mix them.

### For Local Development (without Doppler)

`npm run dev` validates JWT signatures before starting.

**If validation fails:**
```
[Supabase] JWT signature mismatch!
To fix, run: npm run generate:keys
```

**Fix:** Run `npm run generate:keys` and copy output to `.env.local`.

### For Production (with Doppler)

When connecting to production (`api.in-theflow.com`), validation is skipped:
```
[Supabase] Remote URL detected, skipping local key validation
```

**If production auth fails (401 errors):**
1. Check that Doppler has correct keys: `doppler secrets get VITE_SUPABASE_ANON_KEY`
2. Verify VPS Supabase has matching keys: `ssh root@84.46.253.137 "grep ANON_KEY /opt/supabase/docker/.env"`
3. If mismatched, follow **SOP-036** to regenerate keys

**Full SOP:** [`docs/sop/SOP-036-supabase-jwt-key-regeneration.md`](docs/sop/SOP-036-supabase-jwt-key-regeneration.md)

### Scripts

- `scripts/validate-supabase-keys.cjs` - Validates JWT signature on startup (local only)
- `scripts/generate-supabase-keys.cjs` - Generates keys for LOCAL Supabase

## Canvas Position Persistence (CRITICAL)

**DO NOT** add code that can cause canvas positions to reset. Known causes:

| Issue | Root Cause | Fix |
|-------|------------|-----|
| **TASK-131**: Positions reset during session | Competing `deep: true` watcher in `canvas.ts` | REMOVED - `useCanvasSync.ts` is single source of truth |
| **TASK-142**: Positions reset on refresh | Canvas store loaded before auth ready | Auth watcher reloads groups from Supabase |

**Architecture Rules:**
- `useCanvasSync.ts` is the SINGLE source of sync for canvas nodes
- NEVER add watchers in `canvas.ts` that call `syncTasksToCanvas()`
- Vue Flow positions are authoritative for existing nodes
- Position locks (7s timeout) must be respected during sync

**Before modifying canvas sync:**
1. Run `npm run test -- --grep "Position Persistence"`
2. Manual test: drag item, refresh, verify position persists

**Canvas Composables** (`src/composables/canvas/`):
| Composable | Purpose |
|------------|---------|
| `useCanvasSync.ts` | **CRITICAL** - Single source of truth for node sync |
| `useCanvasInteractions.ts` | Drag-drop, selection, and node interactions |
| `useCanvasParentChildHelpers.ts` | Parent-child relationship utilities |
| `useCanvasEvents.ts` | Vue Flow event handlers |
| `useCanvasActions.ts` | Task/group CRUD operations |

## Canvas Geometry Invariants (CRITICAL - TASK-255)

**Position drift and "jumping" tasks occur when multiple code paths mutate geometry.**

**Full SOP:** [`docs/sop/canvas/CANVAS-POSITION-SYSTEM.md`](docs/sop/canvas/CANVAS-POSITION-SYSTEM.md)

### Quick Rules
1. **Single Writer** - Only drag handlers may change `parentId`, `canvasPosition`, `position`
2. **Sync is Read-Only** - `useCanvasSync.ts` MUST NEVER call `updateTask()` or `updateGroup()`
3. **Metadata Only** - Smart-Groups update `dueDate`/`status`/`priority`, NEVER geometry

### Quarantined Features (DO NOT RE-ENABLE)
- `useMidnightTaskMover.ts` - Auto-moved tasks at midnight
- `useCanvasOverdueCollector.ts` - Auto-collected overdue tasks

These violated geometry invariants and caused position drift. See ADR comments in each file.

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

**AI Agent Orchestration Platform** - Kanban board for MASTER_PLAN.md tasks with health scanning, skills visualization, and multi-agent workflows.

| Item | Value |
|------|-------|
| URL | http://localhost:6010 |
| Install Dir | `~/.dev-maestro` |
| Start | `./maestro.sh` or `cd ~/.dev-maestro && npm start` |
| Status API | `curl -s localhost:6010/api/status` |
| Skill | `dev-maestro` |

**Views**: Kanban, Orchestrator, Skills, Docs, Stats, Timeline, Health

**To check if running:**
```bash
curl -s localhost:6010/api/status | grep -q '"running":true' && echo "Running" || echo "Not running"
```

### MASTER_PLAN.md Parsing Format

**Task Header Format:**
```markdown
### TASK-XXX: Task Title (STATUS)
### ~~TASK-XXX~~: Completed Task Title (✅ DONE)
```

**Status Keywords:**
| Status | Keywords |
|--------|----------|
| Done | `DONE`, `COMPLETE`, `✅`, `~~strikethrough~~` |
| In Progress | `IN PROGRESS`, `IN_PROGRESS`, `🔄` |
| Paused | `PAUSED`, `⏸️` |
| Review | `REVIEW`, `MONITORING`, `👀` |

**Parser Gotchas (IMPORTANT):**
1. **Only recognized `##` sections are parsed** - Tasks under `## Code Review Findings` or other custom sections are IGNORED
2. **Table status must be explicit** - Include 🔄, ✅, etc. in the status column for correct parsing
3. **Completed tasks** - Use BOTH `~~strikethrough~~` on ID AND `✅ DONE` in status
4. **After MASTER_PLAN.md changes** - Hard refresh Dev-Maestro (`Ctrl+Shift+R`) to see updates

**Full SOP:** [`docs/sop/SOP-031-dev-maestro-parser.md`](docs/sop/SOP-031-dev-maestro-parser.md)

## UI Component Standards

| Component Type | Use This |
|----------------|----------|
| Dropdowns | `CustomSelect.vue` (NEVER native `<select>`) |
| Context Menus | `ContextMenu.vue` (NEVER browser menus) |
| Modals | `BaseModal.vue`, `BasePopover.vue` |

## Multi-Instance Task Locking

This project has automatic task locking via `task-lock-enforcer.sh` hook to prevent conflicts when multiple Claude Code instances edit the same files.

**Lock files**: `.claude/locks/TASK-XXX.lock`
**Lock expiry**: 4 hours (stale locks auto-cleaned)

## Extended Documentation

Detailed docs available in `docs/claude-md-extension/`:

| File | Contents |
|------|----------|
| `architecture.md` | Project structure, stores, composables, data models |
| `code-patterns.md` | Component/store patterns, naming conventions |
| `testing.md` | Playwright/Vitest examples, dev workflow |
| `backup-system.md` | Dual-engine backup system (Postgres + Shadow Mirror) |
| `design-system.md` | Design tokens, Tailwind config, glass morphism |
| `troubleshooting.md` | Common issues, gotchas, SOPs |

**SOPs (Standard Operating Procedures)** in `docs/sop/`:

| File | Contents |
|------|----------|
| [`SOP-011-tauri-distribution.md`](docs/sop/SOP-011-tauri-distribution.md) | Tauri builds, signing, GitHub Actions releases |
| [`SOP-026-custom-domain-deployment.md`](docs/sop/SOP-026-custom-domain-deployment.md) | VPS domain, Cloudflare, Caddy setup |
| [`SOP-030-doppler-secrets-management.md`](docs/sop/SOP-030-doppler-secrets-management.md) | Doppler secrets for CI/CD and VPS |
| [`SOP-031-cors-configuration.md`](docs/sop/SOP-031-cors-configuration.md) | CORS headers for self-hosted Supabase |
| [`deployment/VPS-DEPLOYMENT.md`](docs/sop/deployment/VPS-DEPLOYMENT.md) | Full VPS setup and deployment guide |
| [`deployment/PWA-DEPLOYMENT-CHECKLIST.md`](docs/sop/deployment/PWA-DEPLOYMENT-CHECKLIST.md) | Pre/post deploy verification checklist |
| [`active/UNDO-system-architecture.md`](docs/sop/active/UNDO-system-architecture.md) | Undo/redo system with operation-scoped selective restoration (BUG-309-B) |
| [`active/TIMER-sync-architecture.md`](docs/sop/active/TIMER-sync-architecture.md) | Cross-device timer sync (Vue app + KDE widget) |
| [`active/SOP-022-skills-config-sync.md`](docs/sop/active/SOP-022-skills-config-sync.md) | Skills config auto-sync and maintenance |
| [`canvas/README.md`](docs/sop/canvas/README.md) | Canvas system documentation index |
| [`canvas/CANVAS-POSITION-SYSTEM.md`](docs/sop/canvas/CANVAS-POSITION-SYSTEM.md) | Canvas position/coordinate system, geometry invariants |

## Skills Maintenance

| Command | Purpose |
|---------|---------|
| `npm run skills:sync` | Sync filesystem skills to `.claude/config/skills.json` |
| `npm run skills:staleness` | Detect stale, broken, or deprecated skills |
| `npm run docs:validate` | Validate all markdown links in docs |

**Skill Boundaries:** `smart-doc-manager` → docs/, MASTER_PLAN.md | `skill-creator-doctor` → .claude/skills/

---

**Last Updated**: January 25, 2026
**Stack**: Vue 3.4.0, Vite 7.2.4, TypeScript 5.9.3, Supabase (self-hosted), Tauri 2.9.5
**Production**: in-theflow.com (Contabo VPS, Ubuntu 22.04)
