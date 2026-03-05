---
name: tauri
description: Build, sign, and deploy the Tauri desktop app to VPS auto-updater. Handles version bumps, env vars, and full pipeline. Triggers on "/tauri", "deploy tauri", "tauri build", "tauri update", "update desktop app".
---

# Tauri Build & Deploy Skill

Full pipeline: version bump → build → sign → deploy to VPS auto-updater.

## Environment Variables (hardcoded for this project)

These are ALWAYS set automatically — never ask the user:
- `VPS_HOST=84.46.253.137`
- `SITE_URL=https://in-theflow.com`
- `VPS_USER=root` (default in script)

## Workflow

### Step 1: Check Current State

Run in parallel:

```bash
# Current source version
grep '"version"' package.json | head -1

# Current deployed version
curl -s https://in-theflow.com/updates/latest.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('version','unknown'))"

# Uncommitted changes
git status --short

# Recent commits since last deploy (find deployed version first, then log)
git log --oneline -10
```

**Display to user:**
```
## Tauri Deploy Status
- Source version: X.Y.Z
- Deployed version: X.Y.Z
- Uncommitted changes: [list or "none"]
```

### Step 2: Version Bump Decision

Compare source version vs deployed version.

**If source version == deployed version** (no bump yet):
- A version bump is MANDATORY before deploying
- Use AskUserQuestion:
  - **Question:** "What type of version bump?" (header: "Version")
  - **Options:**
    - "Patch (X.Y.Z+1)" (description: "Bug fixes, small changes") — Recommended
    - "Minor (X.Y+1.0)" (description: "New features, significant changes")

Then bump all 3 files:
1. `package.json` — `"version": "X.Y.Z"`
2. `src-tauri/tauri.conf.json` — `"version": "X.Y.Z"`
3. `src-tauri/Cargo.toml` — `version = "X.Y.Z"`

**If source version > deployed version** (already bumped):
- Skip bump, inform user: "Version already bumped to X.Y.Z (deployed: A.B.C)"

### Step 3: Get Release Notes

Use AskUserQuestion:
- **Question:** "What are the release notes for this version?" (header: "Notes")
- **Options:**
  - "Auto-generate from commits" (description: "Use git log since last deploy")
  - "Custom notes" (description: "I'll write the notes")

**If auto-generate:** Run `git log --oneline <deployed-version-tag>..HEAD` or recent commits to build notes.
**If custom:** Ask in plain text: "Enter release notes (1-2 sentences):"

### Step 4: Commit if Needed

If there are uncommitted changes (from step 1 or version bump):

```bash
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
# Plus any other staged changes the user wants included
git commit -m "chore: v{VERSION} — {brief summary}"
```

### Step 5: Build & Deploy

Run the deploy script with env vars pre-set:

```bash
VPS_HOST=84.46.253.137 SITE_URL=https://in-theflow.com ./scripts/deploy-tauri-update.sh --notes "{release_notes}"
```

**IMPORTANT:**
- Run with `timeout: 600000` (10 min max — Rust compile takes ~3 min)
- Run with `run_in_background: true`
- Inform user: "Build pipeline started. This takes ~4 minutes (Vue build + Rust compile + bundle + sign + upload)."

### Step 6: Verify & Report

When the background task completes, read the last 30 lines of output.

**If successful**, display:
```
## Tauri Deploy Complete
- Version: X.Y.Z
- Endpoint: https://in-theflow.com/updates/latest.json
- Users will see the update on next app launch
```

**If failed**, read full output and diagnose:
- Signing key issues → "Run: secret-tool store --label='FlowState Tauri Signing Key' service flowstate type signing-key"
- Build errors → Show relevant error and suggest fix
- SSH/upload errors → Check VPS connectivity

### Step 7: Push Git

After successful deploy:

```bash
git push
```

## Options (via args)

| Arg | Effect |
|-----|--------|
| `--skip-deploy` | Build only, don't upload to VPS |
| `--dry-run` | Preview what would happen |
| `--no-bump` | Skip version bump (use current version) |

Examples:
- `/tauri` — Full pipeline (bump + build + deploy + push)
- `/tauri --skip-deploy` — Build locally only
- `/tauri --dry-run` — Preview

## Important Rules

1. **ALWAYS bump version before deploy** — Auto-updater only triggers when VPS version > installed version
2. **All 3 version files must match** — package.json, tauri.conf.json, Cargo.toml
3. **Never manually create latest.json** — The deploy script generates it from build artifacts
4. **AppImage is the only self-updating format** — .deb cannot self-update
5. **Signing key password** comes from KWallet via `secret-tool`
6. **Never skip the deploy script** — It has safeguards (env validation, signature integrity, manifest verification)
