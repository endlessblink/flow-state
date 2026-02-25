---
name: oss-readiness
description: Prepare FlowState for open-source release. Secret scrubbing, infrastructure parameterization, documentation, and community health files. Use when working on INQUIRY-1413 or any OSS preparation task.
version: "1.0"
emoji: "\U0001F310"
triggers:
  - open source
  - oss ready
  - open-source
  - share publicly
  - community release
  - INQUIRY-1413
---

# OSS Readiness — Prepare FlowState for Open-Source Release

Systematic skill for making FlowState safe, buildable, and welcoming for the open-source community. Covers secret scrubbing, infrastructure parameterization, self-hosting documentation, and community health files.

**INQUIRY-1413** tracks this work in MASTER_PLAN.md.

---

## Table of Contents

1. [Phase Overview](#phase-overview)
2. [Phase 1: Secret Scrub](#phase-1-secret-scrub)
3. [Phase 2: Parameterize Infrastructure](#phase-2-parameterize-infrastructure)
4. [Phase 3: Fix Database Migrations](#phase-3-fix-database-migrations)
5. [Phase 4: Documentation Polish](#phase-4-documentation-polish)
6. [Phase 5: Community Health Files](#phase-5-community-health-files)
7. [Phase 6: CI/CD Fork Safety](#phase-6-cicd-fork-safety)
8. [Verification Checklist](#verification-checklist)
9. [Tools Reference](#tools-reference)
10. [Known Issues Registry](#known-issues-registry)

---

## Phase Overview

| Phase | Scope | Effort | Priority |
|-------|-------|--------|----------|
| **1. Secret Scrub** | Remove credentials, PII, leaked passwords from repo + history | 1-2h | P0 — BLOCKER |
| **2. Parameterize Infra** | Replace hardcoded IPs/domains with env vars across ~20 files | 2-3h | P0 — BLOCKER |
| **3. Fix Migrations** | Timestamp `fix_id_types.sql`, verify fresh DB setup works | 30min | P1 |
| **4. Doc Polish** | Fix URLs, add forking guide, document push service | 1-2h | P1 |
| **5. Community Health** | CODE_OF_CONDUCT, SECURITY.md, issue templates, PR template | 1h | P2 |
| **6. CI/CD Fork Safety** | Fork-safe CI workflow, secret-gated deploy workflow | 1h | P2 |

**Total: ~7-10 hours of focused work.**

---

## Phase 1: Secret Scrub

### 1.1 Files to Remove from Tracking

These files are currently tracked in git and contain secrets or PII. Remove them and add to `.gitignore`:

```bash
# Remove from git tracking (keeps local copy)
git rm --cached reports/2026-01-20-auth-data-loss-analysis.md
git rm --cached console-task-1348.txt
git rm --cached .claude/plans/app-stabilization-plan.md
git rm --cached latest.json
git rm --cached Caddyfile.prod

# Add to .gitignore
cat >> .gitignore << 'EOF'

# OSS safety — files removed before open-sourcing
reports/
console-task-*.txt
.claude/plans/
latest.json
Caddyfile.prod
snapshot-*.md
current-state.md
lint_report.*
EOF
```

### 1.2 Specific Secrets Found

| File | Line | Secret | Severity |
|------|------|--------|----------|
| `reports/2026-01-20-auth-data-loss-analysis.md` | ~254 | Developer password `FlowState2026!`, email, UUID | CRITICAL |
| `.claude/plans/app-stabilization-plan.md` | ~186 | CouchDB credentials `admin:flowstate-2024` + VPS IP | CRITICAL |
| `console-task-1348.txt` | throughout | User UUID `717f5209-42d8-4bb9-8781-740107a384e5` | HIGH |
| `src/mobile/views/MobileInboxView.vue` | 184 | Hardcoded email `endlessblink@gmail.com` | HIGH |
| `scripts/restore-recovery.cjs` | 41 | Hardcoded UUID `717f5209-42d8-4bb9-8781-740107a384e5` | HIGH |
| `.beads/issues.jsonl` | ~152 | Developer email in `owner` field | MEDIUM |

### 1.3 Source Code Fixes

**MobileInboxView.vue:184** — Replace hardcoded email with env check:

```typescript
// BEFORE (leaks developer email):
const isDevUser = computed(() => authStore.user?.email === 'endlessblink@gmail.com')

// AFTER (uses existing auth store pattern):
const isDevUser = computed(() => authStore.isDev)
```

**scripts/restore-recovery.cjs:41** — Replace hardcoded UUID:

```javascript
// BEFORE:
const userId = '717f5209-42d8-4bb9-8781-740107a384e5'

// AFTER:
const userId = process.argv[2] || process.env.FLOWSTATE_USER_ID
if (!userId) {
  console.error('Usage: node restore-recovery.cjs <user-id>')
  console.error('Or set FLOWSTATE_USER_ID environment variable')
  process.exit(1)
}
```

### 1.4 Git History Scrub

**IMPORTANT**: Rotate all secrets BEFORE scrubbing. Assume anything ever committed is already leaked.

```bash
# Step 1: Full backup
git clone --mirror . /tmp/flowstate-backup-$(date +%Y%m%d)

# Step 2: Scan full history with gitleaks
# Install: brew install gitleaks OR go install github.com/gitleaks/gitleaks/v8@latest
gitleaks detect --source=. --log-opts="--all" -v

# Step 3: Remove files from entire history using git-filter-repo
# Install: pip install git-filter-repo
git filter-repo --use-base-name --path 2026-01-20-auth-data-loss-analysis.md --invert-paths
git filter-repo --use-base-name --path app-stabilization-plan.md --invert-paths
git filter-repo --use-base-name --path console-task-1348.txt --invert-paths
git filter-repo --use-base-name --path shadow-latest.json --invert-paths

# Step 4: Replace specific secret strings in ALL history
git filter-repo --replace-text <(cat << 'EOF'
FlowState2026!==>REDACTED_PASSWORD
admin:flowstate-2024==>REDACTED_CREDENTIALS
717f5209-42d8-4bb9-8781-740107a384e5==>REDACTED_USER_ID
EOF
)

# Step 5: Verify clean
git clone . /tmp/verify-clean && cd /tmp/verify-clean
gitleaks detect --source=. --log-opts="--all" -v

# Step 6: Force-push (all collaborators must re-clone)
git push --force --all
git push --force --tags
```

### 1.5 Post-Scrub Credential Rotation

After scrubbing history, rotate these:

- [ ] VPS SSH keys (generate new keypair, update authorized_keys)
- [ ] Supabase JWT secret (regenerate, update VPS + Doppler)
- [ ] CouchDB credentials (if reused anywhere — CouchDB is decommissioned but check)
- [ ] Any password matching `FlowState2026!` on other services

---

## Phase 2: Parameterize Infrastructure

### 2.1 VPS IP Address (84.46.253.137)

Replace in these files — use `${VPS_HOST:?VPS_HOST not set}` pattern:

| File | Line | Current | Replacement |
|------|------|---------|-------------|
| `scripts/deploy/deploy-to-vps.sh` | 8 | `root@84.46.253.137` | `${VPS_USER:-root}@${VPS_HOST:?Set VPS_HOST}` |
| `scripts/deploy/setup-vps.sh` | 5 | `root@84.46.253.137` | Same pattern |
| `scripts/deploy-tauri-update.sh` | 25 | `VPS_HOST="84.46.253.137"` | `VPS_HOST="${VPS_HOST:?Set VPS_HOST env var}"` |
| `scripts/fix-cloudflare-cache.sh` | 5 | `84.46.253.137` | `${VPS_HOST:?Set VPS_HOST}` |
| `scripts/tauri-upload-update.sh` | 7 | `84.46.253.137` | Same pattern |
| `Caddyfile.prod` | 1,5,6 | IP in domain config | Rename to `Caddyfile.prod.template`, use `{{VPS_HOST}}` placeholders |

### 2.2 Production Domain (in-theflow.com)

**Application source code** — centralize in `src/config/urls.ts`:

```typescript
// src/config/urls.ts — AFTER
export const EXTERNAL_URLS = {
  PRODUCTION_SITE: import.meta.env.VITE_SITE_URL || 'http://localhost:5546',
  GITHUB_REPO: import.meta.env.VITE_GITHUB_REPO || 'https://github.com/endlessblink/flow-state',
  // ...existing URLs
}
```

Then update all files that hardcode `in-theflow.com`:

| File | Line(s) | What to Change |
|------|---------|----------------|
| `src/config/urls.ts` | 8 | Read from `VITE_SITE_URL` env var |
| `src/config/environments.ts` | 155, 209 | Read `allowedOrigins` from env or `urls.ts` |
| `src/utils/performanceBenchmark.ts` | 314-316, 514 | Use `EXTERNAL_URLS.PRODUCTION_SITE` |
| `src/composables/useNetworkOptimizer.ts` | 446 | Use `EXTERNAL_URLS.PRODUCTION_SITE` |
| `src/components/startup/TauriModeSelector.vue` | 73 | Use `EXTERNAL_URLS.PRODUCTION_SITE` |
| `src/components/settings/tabs/StorageSettingsTab.vue` | 197 | Use `EXTERNAL_URLS.PRODUCTION_SITE` |
| `src/services/ai/router.ts` | 317-318 | Use `EXTERNAL_URLS.PRODUCTION_SITE` |
| `index.html` | 20, 23, 29 | Use Vite HTML transform with `%VITE_SITE_URL%` |
| `supabase/config.toml` | 150 | Remove `https://in-theflow.com` from `additional_redirect_urls` |

### 2.3 Edge Function CORS (Critical for Self-Hosters)

All 4 Edge Functions hardcode `ALLOWED_ORIGINS`. Replace with env-var-driven pattern:

**Files to update:**
- `supabase/functions/ai-chat-proxy/index.ts` (lines 45-50)
- `supabase/functions/whisper-transcribe/index.ts` (lines 15-20)
- `supabase/functions/url-scraper-proxy/index.ts` (lines 16-21)
- `supabase/functions/google-calendar-proxy/index.ts` (lines 59-64)

**Pattern to apply in each:**

```typescript
// BEFORE:
const ALLOWED_ORIGINS = [
  'https://in-theflow.com',
  'https://www.in-theflow.com',
  'http://localhost:5546',
  'tauri://localhost',
]

// AFTER:
const DEFAULT_ORIGINS = [
  'http://localhost:5546',
  'http://localhost:3000',
  'tauri://localhost',
]

const ALLOWED_ORIGINS = (() => {
  const envOrigins = Deno.env.get('ALLOWED_ORIGINS')
  if (envOrigins) {
    return [...envOrigins.split(',').map(o => o.trim()), ...DEFAULT_ORIGINS]
  }
  return DEFAULT_ORIGINS
})()
```

**Document in SELF-HOSTING.md**: Set `ALLOWED_ORIGINS` as a Supabase Edge Function secret:

```bash
supabase secrets set ALLOWED_ORIGINS="https://yourdomain.com,https://www.yourdomain.com"
```

### 2.4 Tauri Configuration

| File | Line | What | Fix |
|------|------|------|-----|
| `src-tauri/tauri.conf.json` | 65 | Update endpoint `https://in-theflow.com/updates/latest.json` | Document that forkers must replace, or read from config |
| `src-tauri/tauri.conf.json` | 67 | Signing public key | Keep but document that forkers must generate their own |
| `src-tauri/src/lib.rs` | 288 | Hardcoded Supabase demo anon key | Read from app config at runtime |

### 2.5 Push Notification Service

**File**: `server/push-service/.env.example`

```bash
# BEFORE:
SUPABASE_URL=https://api.in-theflow.com

# AFTER:
SUPABASE_URL=http://localhost:8000
```

### 2.6 VAPID Email Fallback

**File**: `server/push-service/src/pushSender.ts:24`

```typescript
// BEFORE:
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@in-theflow.com'

// AFTER:
const vapidSubject = process.env.VAPID_SUBJECT
if (!vapidSubject) throw new Error('VAPID_SUBJECT env var is required (e.g., mailto:admin@yourdomain.com)')
```

---

## Phase 3: Fix Database Migrations

### 3.1 Timestamp the Untimestamped Migration

```bash
# The file supabase/migrations/fix_id_types.sql has no timestamp prefix.
# Supabase CLI silently skips it during `supabase db push`.
# Rename it to apply AFTER the initial schema:
mv supabase/migrations/fix_id_types.sql supabase/migrations/20260106000000_fix_id_types.sql
```

### 3.2 Verify Fresh Install

```bash
# Test a fresh Supabase setup from scratch:
supabase stop
supabase db reset    # WARNING: destructive — only on local dev instance
supabase start

# Verify all tables exist:
supabase db execute --sql "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"

# Expected: 19+ tables (tasks, projects, groups, user_settings, timer_sessions,
# notifications, quick_sort_sessions, pomodoro_history, tombstones, task_dedup_audit,
# user_gamification, xp_logs, achievements, user_achievements, shop_items,
# user_purchases, user_stats, user_challenges, challenge_history, pinned_tasks,
# arena_runs, ai_work_profiles, push_subscriptions, ai_conversations, ai_usage_log)
```

### 3.3 Gamification Trigger Gap

The `auth.users` trigger for auto-creating gamification profiles is commented out in `supabase/migrations/20260131000000_gamification.sql:244-246`. The app handles this at the application layer on first login. Document this in SELF-HOSTING.md:

```markdown
> **Note:** Gamification profiles (`user_gamification`, `user_stats`) are created
> automatically by the app when a user first logs in. There is no database trigger
> for this — it is handled in the application layer.
```

---

## Phase 4: Documentation Polish

### 4.1 Fix Placeholder URLs

| File | Line(s) | Current | Replace With |
|------|---------|---------|--------------|
| `docs/SELF-HOSTING.md` | 29, 120, 203 | `github.com/user/flow-state` | `github.com/endlessblink/flow-state` |
| `CONTRIBUTING.md` | 20 | `github.com/user/flow-state` | `github.com/endlessblink/flow-state` |

### 4.2 Update LICENSE Copyright

```
# BEFORE:
Copyright (c) 2024 Pomo-Flow

# AFTER:
Copyright (c) 2024-2026 FlowState Contributors
```

**License choice note**: The project currently uses MIT. Consider Apache 2.0 for stronger patent protection — especially relevant since the app includes AI features. Apache 2.0 is what Supabase itself uses. Either license is fine for OSS community sharing.

### 4.3 README Improvements

Add to `README.md`:

```markdown
<!-- Add at top -->
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Build Status](https://github.com/endlessblink/flow-state/actions/workflows/ci.yml/badge.svg)](https://github.com/endlessblink/flow-state/actions)

<!-- Add Contributing section -->
## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

<!-- Fix Documentation section — don't point to CLAUDE.md -->
## Documentation

- [Self-Hosting Guide](docs/SELF-HOSTING.md) — Deploy your own instance
- [Contributing Guide](CONTRIBUTING.md) — Development setup and PR process
- [Architecture Overview](docs/claude-md-extension/architecture.md)
```

### 4.4 Add "Forking Guide" to SELF-HOSTING.md

```markdown
## Forking FlowState

If you fork this project to run your own instance, update these files:

### Required Changes
| File | What to Change |
|------|---------------|
| `.env.local` | Your Supabase URL, anon key, and all other env vars |
| `supabase/config.toml:150` | Replace redirect URLs with your domain |
| `supabase/functions/*/index.ts` | Set `ALLOWED_ORIGINS` secret with your domain |
| `src-tauri/tauri.conf.json:65` | Your auto-updater endpoint URL |
| `src-tauri/tauri.conf.json:67` | Your Tauri signing public key |
| `index.html` | OG meta tags (og:url, og:image, twitter:image) |

### Optional Changes
| File | What to Change |
|------|---------------|
| `package.json:5` | Homepage URL |
| `package.json:8` | Repository URL |
| `scripts/deploy/*.sh` | Your VPS/server details (env vars) |
```

### 4.5 Document Push Notification Service

Add section to SELF-HOSTING.md:

```markdown
## Push Notifications (Optional)

FlowState supports browser push notifications via a standalone Node.js service.

1. Navigate to `server/push-service/`
2. Copy `.env.example` to `.env` and fill in values
3. Generate VAPID keys: `npx web-push generate-vapid-keys`
4. Set `VITE_VAPID_PUBLIC_KEY` in your main `.env.local`
5. Run: `npm install && npm start`

This service is optional — the app works fully without it.
```

### 4.6 Document `npm run tauri:cli` for Contributors

Add to CONTRIBUTING.md commands table:

```markdown
| `npm run tauri` | Start Tauri dev (requires Doppler — maintainer only) |
| `npm run tauri:cli` | Start Tauri dev (no Doppler — use this for contributing) |
```

### 4.7 Guard postinstall dev-maestro Step

In `package.json`, wrap the postinstall:

```json
"postinstall": "[ -d dev-maestro ] && cd dev-maestro && npm install || true"
```

---

## Phase 5: Community Health Files

### 5.1 CODE_OF_CONDUCT.md

Use the [Contributor Covenant v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) — the standard used by 40,000+ OSS projects (Kubernetes, Rails, Swift). Copy the markdown directly and set the contact method.

### 5.2 SECURITY.md

```markdown
# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT open a public issue**
2. Email: [your-security-email]
3. Include: description, reproduction steps, impact assessment

We will acknowledge within 48 hours and provide a fix timeline within 7 days.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |
| < Latest | No — please upgrade |
```

### 5.3 Issue Templates

Create `.github/ISSUE_TEMPLATE/bug_report.yml` and `.github/ISSUE_TEMPLATE/feature_request.yml` using GitHub's YAML issue form format.

### 5.4 PR Template

Create `.github/pull_request_template.md`:

```markdown
## Summary
<!-- What does this PR do? -->

## Type
- [ ] Bug fix
- [ ] New feature
- [ ] Refactor
- [ ] Documentation

## Testing
<!-- How did you test this? -->

## Checklist
- [ ] Tests pass (`npm run test`)
- [ ] Lint passes (`npm run lint`)
- [ ] No hardcoded secrets or URLs
- [ ] Design tokens used (no hardcoded colors/spacing)
```

---

## Phase 6: CI/CD Fork Safety

### 6.1 Fork-Safe CI Workflow

The CI workflow must run on PRs from forks **without secrets**:

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

permissions:
  contents: read

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test
      - run: npm run build
```

### 6.2 Deploy Workflow (Maintainer-Only)

Keep deploy workflow on `push` to `master` only — never on `pull_request`:

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [master]

# Secrets ARE available here — only maintainers can push to master
```

### 6.3 Never Use pull_request_target + checkout HEAD

**CRITICAL**: The combination of `pull_request_target` trigger with `actions/checkout@HEAD` is a known attack vector ("pwn request"). A malicious PR can execute arbitrary code with access to your secrets. Never use this pattern.

---

## Verification Checklist

Run this checklist before making the repo public:

### Security
- [ ] `gitleaks detect --source=. --log-opts="--all"` returns 0 findings
- [ ] All passwords/keys from Phase 1.2 have been rotated
- [ ] `git log --all --oneline | wc -l` — verify history was rewritten (count will differ from backup)
- [ ] No `84.46.253.137` in any tracked file: `grep -r "84.46.253.137" --include="*.{ts,vue,js,sh,json,toml,yml}" .`
- [ ] No `endlessblink@gmail.com` in source code: `grep -r "endlessblink@gmail.com" src/ scripts/`
- [ ] `FlowState2026!` not in any tracked file
- [ ] `admin:flowstate-2024` not in any tracked file

### Build
- [ ] `npm install` succeeds (no private packages)
- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes
- [ ] `npm run test` passes
- [ ] `npm run build` succeeds (with `.env.local` from `.env.example`)
- [ ] Fresh `supabase db reset && supabase start` creates all tables

### Documentation
- [ ] README has badges, quickstart, and link to CONTRIBUTING.md
- [ ] CONTRIBUTING.md has correct clone URL
- [ ] SELF-HOSTING.md has forking guide
- [ ] LICENSE says "FlowState" (not "Pomo-Flow")
- [ ] CODE_OF_CONDUCT.md exists
- [ ] SECURITY.md exists
- [ ] `.github/ISSUE_TEMPLATE/` has bug report + feature request
- [ ] `.github/pull_request_template.md` exists

### Self-Hosting
- [ ] `.env.example` documents ALL required vars with descriptions
- [ ] Edge Functions use `ALLOWED_ORIGINS` from env var
- [ ] `docker-compose.self-host.yml` starts cleanly
- [ ] Push service `.env.example` has no hardcoded production URLs

---

## Tools Reference

### Secret Scanning

| Tool | Install | Purpose |
|------|---------|---------|
| **gitleaks** | `brew install gitleaks` or `go install github.com/gitleaks/gitleaks/v8@latest` | Scan full git history for secrets (high recall) |
| **trufflehog** | `brew install trufflehog` | Scan + live-validate secrets against APIs (high precision) |
| **git-filter-repo** | `pip install git-filter-repo` | Rewrite git history (official replacement for `git filter-branch`) |
| **BFG Repo-Cleaner** | `brew install bfg` | Simpler alternative for removing specific files |

### Recommended Workflow

```bash
# 1. Backup first
git clone --mirror . /tmp/flowstate-backup

# 2. Scan
gitleaks detect --source=. --log-opts="--all" -v > /tmp/gitleaks-report.txt

# 3. Fix source code (Phase 1.3)

# 4. Remove files from history (Phase 1.4)

# 5. Verify
gitleaks detect --source=. --log-opts="--all" -v  # Should be clean

# 6. Force-push
```

---

## Known Issues Registry

### Feature Gating (Confirmed: NONE)

The app has **zero paywalls, premium tiers, subscription checks, or license validation**. All features are available to all users. The only access-gated content:

- `/performance` route — admin-only developer benchmark tool (not user-facing)
- "AI Quality" settings tab — admin-only developer dashboard
- Debug overlay in mobile — gated on `authStore.isDev` (after Phase 1.3 fix)

### Telemetry (Confirmed: NONE)

- `useAIEventTracking.ts` stores events in `localStorage` only — no network calls
- `enableAnalytics` defaults to `false`
- No `sendBeacon()`, no analytics endpoints
- Two places ping `PRODUCTION_SITE` for latency measurement (not telemetry), fixed in Phase 2.2

### Committed `.env` File

The `.env` at repo root contains Supabase demo JWT keys (the well-known `supabase-demo` issuer keys that ship with every Supabase installation). These are NOT real secrets but the committed `.env` contradicts `.gitignore` rules.

**Fix**: Either `git rm --cached .env` and add to `.gitignore`, or rename to `.env.defaults` with a comment explaining these are the standard Supabase local dev keys.

### Doppler Dependency

Doppler is optional. `sync-doppler.sh` already silently skips if Doppler is not installed. The only trap is `npm run tauri` (requires Doppler) vs `npm run tauri:cli` (does not). Documented in Phase 4.6.

---

## References

- [opensource.guide — Starting an Open Source Project](https://opensource.guide/starting-a-project/)
- [CFPB open-source-project-template checklist](https://github.com/cfpb/open-source-project-template/blob/main/opensource-checklist.md)
- [gitleaks — Secret scanning](https://github.com/gitleaks/gitleaks)
- [git-filter-repo — History rewriting](https://github.com/newren/git-filter-repo)
- [Contributor Covenant — Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/)
- [Best-README-Template](https://github.com/othneildrew/Best-README-Template)
- [Supabase self-hosting guide](https://supabase.com/docs/guides/self-hosting/docker)
- [GitHub Actions security cheat sheet](https://blog.gitguardian.com/github-actions-security-cheat-sheet/)
- [MIT vs Apache 2.0 for AI apps](https://www.oreateai.com/blog/mit-vs-apache-20-decoding-the-open-source-licenses-that-shape-ais-future/)
