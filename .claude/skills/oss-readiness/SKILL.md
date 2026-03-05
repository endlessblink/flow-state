---
name: oss-readiness
description: Pre-sharing review for FlowState. Scans for secrets, personal paths, license compliance, documentation gaps, and build portability before making the repo visible. Works for source-available (Polyform Shield) or any license model.
version: "2.0"
emoji: "\U0001F50D"
triggers:
  - pre-sharing review
  - share publicly
  - sharing review
  - ready to share
  - before sharing
  - oss ready
  - open source
  - community release
  - INQUIRY-1413
  - INQUIRY-1438
---

# Pre-Sharing Reviewer — Verify FlowState is Safe to Share

Systematic skill for reviewing the codebase before making it visible on GitHub. Covers secret scrubbing, personal path detection, license verification, documentation completeness, and build portability. Works regardless of license model (Polyform Shield, MIT, BSL, etc.).

**License model**: Source-available under [Polyform Shield 1.0.0](https://polyformproject.org/licenses/shield/1.0.0/) — not open-source. Users may view, self-host, and contribute via PRs. They may NOT compete, redistribute, or build derivative apps.

---

## Quick Run

When invoked, execute ALL phases in parallel using specialized agents:

```
Phase 1: Secret & PII Scan          → security-reviewer agent
Phase 2: Personal Path Detection     → explore agent + grep
Phase 3: License Compliance          → code-reviewer agent
Phase 4: Documentation Completeness  → researcher agent
Phase 5: Build Portability           → build-fixer agent
Phase 6: Community Health Files      → explore agent
```

Report results as a single graded scorecard.

---

## Phase 1: Secret & PII Scan (BLOCKER)

### Automated Scans

```bash
# 1. Grep for known secret patterns in tracked files
git ls-files | xargs grep -l -i "password\|secret\|api.key\|token" 2>/dev/null | grep -v node_modules | grep -v ".lock"

# 2. Check for hardcoded emails (developer PII)
grep -rn "@gmail.com\|@outlook.com\|@hotmail.com" --include="*.{ts,vue,js,json,sh,md,qml}" src/ scripts/ packages/ server/

# 3. Check for hardcoded UUIDs (user data)
grep -rn "[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}" --include="*.{ts,vue,js,sh}" src/ scripts/

# 4. Check for IP addresses
grep -rn "\b[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\b" --include="*.{ts,vue,js,json,sh,yml,toml}" src/ scripts/ .github/ supabase/

# 5. Check tracked files that should be gitignored
git ls-files | grep -E "\.(key|pem|env\.local|env\.production)$"

# 6. Check for VITE_ secrets (should go through Edge Functions, not client)
grep -rn "VITE_.*KEY\|VITE_.*SECRET\|VITE_.*TOKEN" --include="*.{ts,vue,js}" src/ | grep -v "VITE_SUPABASE_ANON_KEY\|VITE_VAPID_PUBLIC_KEY"
```

### Known Safe Exceptions

These are NOT secrets and should be ignored:
- `.env` / `.env.example` — Supabase demo JWT keys (well-known `supabase-demo` issuer)
- `VITE_SUPABASE_ANON_KEY` — public anon key (designed to be client-side)
- `VITE_VAPID_PUBLIC_KEY` — public VAPID key (by design)
- `src-tauri/tauri.conf.json` pubkey — Tauri updater public key (not secret)

### Grading

| Grade | Criteria |
|-------|----------|
| **A** | Zero secrets, zero PII, zero hardcoded IPs in tracked files |
| **B** | Only false positives flagged |
| **C** | 1-2 low-severity items (dev email in comments, etc.) |
| **F** | Any real credentials, passwords, or private keys in tracked files |

---

## Phase 2: Personal Path Detection

### Scans

```bash
# 1. Hardcoded home directories
grep -rn "/home/\|/Users/" --include="*.{ts,vue,js,json,sh,yml,toml,qml}" . | grep -v node_modules | grep -v ".git/"

# 2. Hardcoded usernames
grep -rn "endlessblink" --include="*.{ts,vue,js,json,sh,yml,toml,qml,md}" . | grep -v node_modules | grep -v ".git/" | grep -v CHANGELOG | grep -v "github.com/endlessblink"

# 3. Domain references that should be parameterized
grep -rn "in-theflow\.com" --include="*.{ts,vue,js,json,sh,yml,toml}" src/ scripts/ .github/ supabase/ server/ | grep -v node_modules
```

### Allowed References

- `github.com/endlessblink/flow-state` — repo URL (correct)
- `in-theflow.com` in README.md live demo link — intentional (paid product)
- `in-theflow.com` in `src-tauri/tauri.conf.json` — documented in SELF-HOSTING.md
- `in-theflow.com` in internal docs (`docs/sop/`, `docs/claude-md-extension/`) — developer-internal

### Grading

| Grade | Criteria |
|-------|----------|
| **A** | All paths use BASH_SOURCE / env vars / relative paths |
| **B** | 1-2 in developer-only files (SOPs, internal docs) |
| **C** | References in user-facing files that could confuse contributors |
| **F** | Hardcoded paths in scripts that would break for other users |

---

## Phase 3: License Compliance

### Checks

1. **Root LICENSE file** exists and matches declared license in `package.json`
2. **package.json `license` field** is correct
3. **README.md** references the correct license
4. **CONTRIBUTING.md** mentions the license and any CLA requirements
5. **Subpackages** (kde-widget, whatsapp-bot) have appropriate licenses
6. **No conflicting license headers** in source files

### Current License Architecture

| Scope | License | Why |
|-------|---------|-----|
| Main app (root) | Polyform Shield 1.0.0 | Source-available, competition clause |
| KDE widgets (`packages/kde-widget*`) | GPL-2.0-or-later | KDE ecosystem expects GPL |
| WhatsApp bot (`packages/whatsapp-bot`) | Polyform Shield 1.0.0 (inherits root) | Part of main product |

### CLA Status

A Contributor License Agreement (CLA) is needed since Polyform Shield is not a standard OSI license. Contributors must grant rights for:
- Including contributions in the source-available codebase
- Potential future re-licensing

**Check**: Does `CONTRIBUTING.md` mention the CLA requirement?

### Grading

| Grade | Criteria |
|-------|----------|
| **A** | All files consistent, CLA documented, subpackage licenses correct |
| **B** | Minor inconsistencies (missing badge, outdated copyright year) |
| **C** | CONTRIBUTING.md doesn't mention license terms |
| **F** | LICENSE file missing or contradicts package.json |

---

## Phase 4: Documentation Completeness

### Required Files

| File | Status Check | Purpose |
|------|-------------|---------|
| `README.md` | Must have: badges, quickstart, license ref, self-hosting link | First impression |
| `CONTRIBUTING.md` | Must have: setup steps, code style, PR process, license mention | Contributor guide |
| `CHANGELOG.md` | Must cover recent versions, Keep a Changelog format | Version history |
| `docs/SELF-HOSTING.md` | Must have: Docker setup, env vars, Supabase Cloud option, VPS guide | Self-hosters |
| `.env.example` | Must list ALL required vars with descriptions | Configuration |
| `CODE_OF_CONDUCT.md` | Must exist | Community standard |
| `SECURITY.md` | Must exist with reporting instructions | Security policy |
| `.github/ISSUE_TEMPLATE/` | Bug report + feature request templates | Issue quality |
| `.github/pull_request_template.md` | PR checklist | PR quality |

### Content Quality Checks

```bash
# Check for placeholder URLs
grep -rn "example\.com\|your-domain\|yourdomain\|CHANGEME\|TODO\|FIXME" README.md CONTRIBUTING.md docs/SELF-HOSTING.md

# Check for broken internal links
grep -oP '\[.*?\]\(((?!http)[^)]+)\)' README.md CONTRIBUTING.md docs/SELF-HOSTING.md | while read link; do
  file=$(echo "$link" | grep -oP '\(([^)]+)\)' | tr -d '()')
  [ ! -f "$file" ] && echo "BROKEN: $link"
done

# Check .env.example completeness
diff <(grep "^VITE_" .env.example | sort) <(grep -roh "import\.meta\.env\.\(VITE_[A-Z_]*\)" src/ | sed 's/import.meta.env.//' | sort -u)
```

### Grading

| Grade | Criteria |
|-------|----------|
| **A** | All files present, no broken links, no placeholders, .env.example complete |
| **B** | All files present, 1-2 minor gaps |
| **C** | Missing 1-2 optional files or significant content gaps |
| **F** | Missing README or SELF-HOSTING.md |

---

## Phase 5: Build Portability

### Checks

```bash
# 1. Clean install test
npm ci 2>&1 | tail -5

# 2. Build succeeds
npm run build 2>&1 | tail -5

# 3. Tests pass
npm run test 2>&1 | tail -5

# 4. No private/scoped packages that others can't access
grep -r "@endlessblink\|@flowstate" package.json package-lock.json 2>/dev/null

# 5. postinstall doesn't break for fresh clones
grep "postinstall" package.json

# 6. Check for platform-specific assumptions
grep -rn "linux\|darwin\|win32" --include="*.{ts,js}" scripts/ | grep -v node_modules | grep -v ".git/"
```

### Cross-Platform Concerns

| Area | Check |
|------|-------|
| Scripts | All `.sh` files have `#!/bin/bash` and use portable syntax |
| Paths | No `/home/user/` hardcoded anywhere |
| Line endings | `.editorconfig` enforces LF |
| Node version | `.nvmrc` or `engines` field in package.json |

### Grading

| Grade | Criteria |
|-------|----------|
| **A** | npm ci + build + test all pass, no private deps, cross-platform ready |
| **B** | Build passes, 1-2 platform-specific scripts (documented) |
| **C** | Build passes but tests fail or private deps exist |
| **F** | npm install or build fails |

---

## Phase 6: Community Health Files

### GitHub-Specific

| File | Required | Template |
|------|----------|----------|
| `CODE_OF_CONDUCT.md` | Yes | [Contributor Covenant v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) |
| `SECURITY.md` | Yes | Reporting instructions + supported versions |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | Recommended | GitHub YAML form |
| `.github/ISSUE_TEMPLATE/feature_request.yml` | Recommended | GitHub YAML form |
| `.github/pull_request_template.md` | Recommended | Checklist format |

### CI/CD Fork Safety

```bash
# Check that deploy workflows don't run on pull_request (secret exposure risk)
grep -l "pull_request" .github/workflows/*.yml | while read f; do
  if grep -q "secrets\." "$f"; then
    echo "WARNING: $f uses secrets AND triggers on pull_request"
  fi
done

# Check for pull_request_target + checkout (pwn request vulnerability)
grep -l "pull_request_target" .github/workflows/*.yml 2>/dev/null
```

### Grading

| Grade | Criteria |
|-------|----------|
| **A** | All health files present, CI fork-safe, issue templates exist |
| **B** | Core files present (COC, SECURITY), missing templates |
| **C** | Missing CODE_OF_CONDUCT or SECURITY |
| **F** | Deploy workflow exposes secrets to PRs |

---

## Final Scorecard Template

```
Pre-Sharing Review — FlowState
===============================
Date: YYYY-MM-DD
License: Polyform Shield 1.0.0 (source-available)

Phase 1: Secrets & PII        [A/B/C/F]  — X issues found
Phase 2: Personal Paths       [A/B/C/F]  — X references remaining
Phase 3: License Compliance   [A/B/C/F]  — X inconsistencies
Phase 4: Documentation        [A/B/C/F]  — X gaps found
Phase 5: Build Portability    [A/B/C/F]  — build: PASS/FAIL
Phase 6: Community Health     [A/B/C/F]  — X files missing

Overall: [READY / NEEDS WORK / BLOCKED]

Blockers (must fix before sharing):
- ...

Recommendations (nice to have):
- ...
```

---

## Git History Scrub (Before First Public Push)

**CRITICAL**: Run this BEFORE making the repo public. After the repo is public, history is exposed.

```bash
# 1. Full backup
git clone --mirror . /tmp/flowstate-backup-$(date +%Y%m%d)

# 2. Scan with gitleaks
gitleaks detect --source=. --log-opts="--all" -v

# 3. Remove sensitive files from ALL history
git filter-repo --use-base-name --path <filename> --invert-paths

# 4. Replace secret strings in ALL history
git filter-repo --replace-text <(echo "SECRET==>REDACTED")

# 5. Verify clean
gitleaks detect --source=. --log-opts="--all" -v  # Should be 0 findings

# 6. Force-push (ALL collaborators must re-clone)
git push --force --all && git push --force --tags
```

**Post-scrub**: Rotate ALL credentials that were ever in the history.

---

## References

- [Polyform Shield 1.0.0](https://polyformproject.org/licenses/shield/1.0.0/)
- [gitleaks — Secret scanning](https://github.com/gitleaks/gitleaks)
- [git-filter-repo — History rewriting](https://github.com/newren/git-filter-repo)
- [Contributor Covenant v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/)
- [GitHub Actions security](https://blog.gitguardian.com/github-actions-security-cheat-sheet/)
