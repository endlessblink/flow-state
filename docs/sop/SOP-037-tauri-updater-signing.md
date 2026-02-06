# SOP-037 - Tauri In-App Auto-Updater & Signing

## Overview

FlowState uses the Tauri 2.x updater plugin to check a self-hosted VPS endpoint for updates. This enables in-app automatic updates without requiring users to manually download and install new versions after the initial bootstrap installation.

**Key Components:**
- **Update endpoint**: `https://in-theflow.com/updates/latest.json`
- **Update check triggers**: On app launch (3s delay) + manual via Settings > About > Check for Updates
- **Signature verification**: All update artifacts are cryptographically signed using minisign keys
- **Update format**: AppImage for Linux, MSI for Windows, DMG for macOS

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ FlowState Desktop App                                       │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ TauriUpdateNotification.vue (launch check)         │    │
│  │  - Checks on startup (3s delay)                    │    │
│  │  - Auto-downloads if autoUpdateEnabled = true      │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │ AboutSettingsTab.vue (manual check)                │    │
│  │  - Settings > About > Check for Updates button     │    │
│  │  - Download progress bar                           │    │
│  │  - Restart to Apply button                         │    │
│  │  - Auto-update toggle                              │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │ useTauriUpdater.ts (composable)                    │    │
│  │  - checkForUpdates()                               │    │
│  │  - downloadAndInstall()                            │    │
│  │  - restart()                                       │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │ @tauri-apps/plugin-updater                         │    │
│  │  - Checks VPS endpoint for latest.json             │    │
│  │  - Verifies signature using pubkey                 │    │
│  │  - Downloads AppImage/MSI/DMG                      │    │
│  │  - Installs and relaunches                         │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ VPS (in-theflow.com)                                        │
│                                                              │
│  /var/www/flowstate/updates/                                │
│  ├── latest.json              # Update manifest             │
│  ├── FlowState_X.X.X_amd64.AppImage  # Linux update         │
│  ├── FlowState_X.X.X_x64-setup.msi   # Windows update       │
│  └── FlowState_X.X.X_aarch64.dmg     # macOS update         │
└─────────────────────────────────────────────────────────────┘
```

**Update manifest** (`latest.json`) contains:
- Version number
- Release notes
- Platform-specific download URLs
- **Embedded signatures** (content of `.sig` files, not URLs)

**Signature verification flow:**
1. App fetches `latest.json` from VPS
2. Parses `platforms.linux-x86_64.signature` field (or windows-x86_64, darwin-aarch64, etc.)
3. Downloads the binary (AppImage/MSI/DMG)
4. Verifies downloaded binary against signature using **embedded public key** from `tauri.conf.json`
5. If signature valid → install, else reject

## Signing Key Management

### CRITICAL BUG: tauri-cli 2.9.6 Signing is Broken

**Problem:** `@tauri-apps/cli@2.9.6` has a critical bug where signing **ALWAYS fails** with:

```
incorrect updater private key password: Wrong password for that key
```

This happens with **ALL** combinations:
- `--ci` flag with env vars
- Empty passwords (`""`)
- Real passwords
- File paths vs key content
- Both local builds and CI/CD

**Root Cause:** Bug in tauri-cli 2.9.6's key handling logic (confirmed by testing multiple scenarios).

**WORKAROUND (MANDATORY):**

```bash
npm install -D @tauri-apps/cli@2.8.0
```

**Verification:** tauri-cli 2.8.0 has been confirmed working and generates valid `.sig` files that pass signature verification.

**DO NOT upgrade to 2.9.6** until the bug is fixed upstream.

### Key Generation

**Generate signing key pair:**

```bash
npx tauri signer generate -w ~/.tauri/flow-state.key --force
# Prompt: "Enter a password to encrypt the secret key (optional, press enter for no password):"
# Type password (e.g., flowstate2026)
# Press Enter to confirm
```

**Output:**
- **Private key**: `~/.tauri/flow-state.key` (NEVER commit to git)
- **Public key**: `~/.tauri/flow-state.key.pub`

**Key format:**
- Private key is encrypted with the password you provided
- Public key is base64-encoded minisign key (safe to commit)
- Public key is embedded in `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`

**Key storage rules:**
- `~/.tauri/flow-state.key` → **NEVER commit** (add to `.gitignore`)
- `~/.tauri/flow-state.key.pub` → Safe to commit (already in `tauri.conf.json`)
- Private key content in GitHub Secrets for CI/CD: `TAURI_SIGNING_PRIVATE_KEY`
- Password in GitHub Secrets (if using one): `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

**If public key changes:**
- Update `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`
- Commit the updated config
- Old versions of the app will reject updates signed with new key (expected behavior)

### Environment Variables for Building

**For passworded keys (RECOMMENDED for security):**

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat $HOME/.tauri/flow-state.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="flowstate2026"
npx tauri build
```

**For passwordless keys:**

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat $HOME/.tauri/flow-state.key)"
# DO NOT set TAURI_SIGNING_PRIVATE_KEY_PASSWORD (omit entirely)
npx tauri build
```

**CRITICAL RULES:**
- Use key **CONTENT** via `$(cat ...)`, **NOT** file path
- NEVER set `TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""` (empty string tells Tauri "there IS a password, it's empty" → fails)
- For passwordless keys: **omit the env var entirely**, don't set it to empty
- If building in a non-interactive environment (CI/CD), env vars are MANDATORY

**Why `$(cat)` and not file path?**
- Tauri expects the raw key content as a string, not a file path
- File paths only work in interactive mode (prompts for password)
- CI/CD has no TTY for password prompts → must use env vars with key content

## Build Process

### Local Build (Linux)

**Full build with signing:**

```bash
# Step 1: Build frontend
npm run build

# Step 2: Set signing env vars
export TAURI_SIGNING_PRIVATE_KEY="$(cat $HOME/.tauri/flow-state.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="flowstate2026"

# Step 3: Build Tauri app
npx tauri build
```

**Build output location:**

```
src-tauri/target/release/bundle/
├── deb/
│   ├── FlowState_X.X.X_amd64.deb
│   └── FlowState_X.X.X_amd64.deb.sig
├── rpm/
│   ├── FlowState-X.X.X-1.x86_64.rpm
│   └── FlowState-X.X.X-1.x86_64.rpm.sig
└── appimage/
    ├── FlowState_X.X.X_amd64.AppImage
    └── FlowState_X.X.X_amd64.AppImage.sig
```

**What gets uploaded to VPS:**
- `FlowState_X.X.X_amd64.AppImage` (Linux update binary)
- `latest.json` (manifest with embedded `.AppImage.sig` content)

**Note:** The `.sig` files are NOT uploaded separately. Their content is embedded in `latest.json` under `platforms.linux-x86_64.signature`.

### Signature Verification

**Check if signing worked:**

```bash
# After build, check that .sig files exist
ls -lh src-tauri/target/release/bundle/appimage/*.sig

# Verify signature manually with minisign (optional)
minisign -V -p ~/.tauri/flow-state.key.pub \
  -m src-tauri/target/release/bundle/appimage/FlowState_X.X.X_amd64.AppImage
```

If signature is valid, you'll see:
```
Signature and comment signature verified
Trusted comment: ...
```

If invalid:
```
Signature verification failed
```

## tauri.conf.json Configuration

**Updater config in `src-tauri/tauri.conf.json`:**

```json
{
  "bundle": {
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "endpoints": ["https://in-theflow.com/updates/latest.json"],
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDk0ODVDNjBEQTVDQTVDRDMKUldUVFhNcWxEY2FGbFBaMmdvNnp1MXVCeG1NdUE1OE9tTmtpdjdrY3lZNnlCdWFsVERDSkkzRVMK"
    }
  }
}
```

**Key fields:**
- `bundle.createUpdaterArtifacts: true` → Generates `.sig` files during build
- `plugins.updater.endpoints` → Array of update manifest URLs (checked in order)
- `plugins.updater.pubkey` → Base64-encoded public key (from `~/.tauri/flow-state.key.pub`)

**IMPORTANT - `createUpdaterArtifacts` vs `v1Compatible`:**
- Use `"createUpdaterArtifacts": true` (Tauri 2.x standard)
- **DO NOT use `"v1Compatible"`** (deprecated, generates .tar.gz wrappers)
- `v1Compatible` is for migrating from Tauri 1.x apps → not needed for new apps
- Using `createUpdaterArtifacts` generates clean `.sig` files without extra wrappers

**Pubkey regeneration:**
- If you regenerate signing keys, update `plugins.updater.pubkey` with the new public key
- Get public key content: `cat ~/.tauri/flow-state.key.pub`
- Copy the entire base64 string (starts with `dW50cnVzdGVk...`)
- Replace `pubkey` value in `tauri.conf.json`

## Cargo.toml Release Profile

**Release profile in `src-tauri/Cargo.toml`:**

```toml
[profile.release]
lto = true           # Link-Time Optimization - smaller binary, better runtime
codegen-units = 1    # Single codegen unit for better optimization
strip = "symbols"    # Strip debug symbols but preserve string data
opt-level = 3        # Maximum optimization
panic = "abort"      # Abort on panic (smaller binary, no unwinding)
```

### __TAURI_BUNDLE_TYPE Warning (Safe to Ignore)

**You may see this warning during build:**

```
WARN tauri_bundler::bundle::linux::appimage: Failed to add bundler type to the binary: ...
```

**What it means:**
- Tauri tries to patch the binary to embed `__TAURI_BUNDLE_TYPE` symbol
- With `strip = "symbols"`, this symbol gets removed → warning appears

**Is this a problem?**
- **NO** - This is a WARNING, not an error
- The updater does NOT rely on `__TAURI_BUNDLE_TYPE` symbol
- Updater uses JSON manifest (`latest.json`) and cryptographic signatures
- The build is still valid and updater will work correctly

**Why does Tauri do this?**
- `__TAURI_BUNDLE_TYPE` is used for runtime detection of bundle format (AppImage vs deb vs rpm)
- Some features check this symbol to adjust behavior
- But the updater plugin doesn't need it

**If you want to silence the warning:**
- Change `strip = "symbols"` to `strip = false` in Cargo.toml
- Tradeoff: Larger binary size (~30-50% bigger) due to debug symbols
- **Recommendation**: Keep `strip = "symbols"` and ignore the warning (smaller binaries are better)

## VPS Deployment

### Directory Structure

**Update artifacts location on VPS:**

```
/var/www/flowstate/updates/
├── latest.json                          # Update manifest
├── FlowState_1.2.5_amd64.AppImage       # Linux update
├── FlowState_1.2.5_x64-setup.msi        # Windows update
└── FlowState_1.2.5_aarch64.dmg          # macOS update
```

**Caddy serves this directory automatically** (no special config needed).

**CORS headers are already configured** in Caddy for `*.in-theflow.com`.

### Upload Commands

**Create updates directory (first time only):**

```bash
ssh -i ~/.ssh/id_ed25519 root@84.46.253.137 "mkdir -p /var/www/flowstate/updates"
```

**Upload AppImage + manifest:**

```bash
scp -i ~/.ssh/id_ed25519 \
  src-tauri/target/release/bundle/appimage/FlowState_1.2.5_amd64.AppImage \
  src-tauri/target/release/bundle/latest.json \
  root@84.46.253.137:/var/www/flowstate/updates/
```

**Upload multi-platform builds (after CI/CD):**

```bash
# Assuming you've downloaded artifacts from GitHub Actions
scp -i ~/.ssh/id_ed25519 \
  artifacts/linux/FlowState_1.2.5_amd64.AppImage \
  artifacts/windows/FlowState_1.2.5_x64-setup.msi \
  artifacts/macos/FlowState_1.2.5_aarch64.dmg \
  latest.json \
  root@84.46.253.137:/var/www/flowstate/updates/
```

### Verify Upload

**Check that files are accessible:**

```bash
# Verify manifest is served
curl https://in-theflow.com/updates/latest.json

# Verify AppImage is downloadable
curl -I https://in-theflow.com/updates/FlowState_1.2.5_amd64.AppImage
# Should return: HTTP/2 200, Content-Type: application/octet-stream
```

**Expected `latest.json` response:**

```json
{
  "version": "1.2.5",
  "notes": "FlowState v1.2.5 - Release notes here",
  "pub_date": "2026-02-05T19:45:00Z",
  "platforms": {
    "linux-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVT...",
      "url": "https://in-theflow.com/updates/FlowState_1.2.5_amd64.AppImage"
    }
  }
}
```

## latest.json Manifest Format

**Complete manifest structure:**

```json
{
  "version": "1.2.5",
  "notes": "FlowState v1.2.5\n\n- Feature 1\n- Feature 2\n- Bug fixes",
  "pub_date": "2026-02-05T19:45:00Z",
  "platforms": {
    "linux-x86_64": {
      "signature": "<CONTENT of FlowState_X.X.X_amd64.AppImage.sig file>",
      "url": "https://in-theflow.com/updates/FlowState_1.2.5_amd64.AppImage"
    },
    "windows-x86_64": {
      "signature": "<CONTENT of FlowState_X.X.X_x64-setup.msi.sig file>",
      "url": "https://in-theflow.com/updates/FlowState_1.2.5_x64-setup.msi"
    },
    "darwin-aarch64": {
      "signature": "<CONTENT of FlowState_X.X.X_aarch64.dmg.sig file>",
      "url": "https://in-theflow.com/updates/FlowState_1.2.5_aarch64.dmg"
    },
    "darwin-x86_64": {
      "signature": "<CONTENT of FlowState_X.X.X_x64.dmg.sig file>",
      "url": "https://in-theflow.com/updates/FlowState_1.2.5_x64.dmg"
    }
  }
}
```

**Field descriptions:**
- `version` → Semantic version (X.X.X format)
- `notes` → Release notes (supports Markdown, shown in update notification)
- `pub_date` → ISO 8601 timestamp (used for date comparison)
- `platforms.*.signature` → **STRING CONTENT** of the `.sig` file (NOT a URL)
- `platforms.*.url` → Direct download URL for the update binary

**Platform keys:**
- `linux-x86_64` → Linux 64-bit (AppImage)
- `windows-x86_64` → Windows 64-bit (MSI)
- `darwin-aarch64` → macOS Apple Silicon (DMG)
- `darwin-x86_64` → macOS Intel (DMG)

**CRITICAL - Signature Field:**
- The `signature` field contains the **CONTENT** of the `.sig` file, NOT a URL
- Read the `.sig` file and paste its content directly into the JSON
- The `.sig` files do NOT need to be served on the VPS separately
- Tauri verifies the signature client-side using the embedded content

**How to get signature content:**

```bash
cat src-tauri/target/release/bundle/appimage/FlowState_1.2.5_amd64.AppImage.sig
# Copy the entire output and paste into latest.json
```

**Manual manifest generation (without script):**

```bash
# Create latest.json manually
cat > latest.json << 'EOF'
{
  "version": "1.2.5",
  "notes": "FlowState v1.2.5 - Release notes",
  "pub_date": "2026-02-05T19:45:00Z",
  "platforms": {
    "linux-x86_64": {
      "signature": "<paste .sig content here>",
      "url": "https://in-theflow.com/updates/FlowState_1.2.5_amd64.AppImage"
    }
  }
}
EOF
```

**Automated manifest generation:**

Use `scripts/generate-update-manifest.cjs` (see CI/CD section below).

## CI/CD (GitHub Actions)

### Release Workflow

**Workflow file:** `.github/workflows/release.yml`

**Trigger:** Push a git tag

```bash
git tag v1.2.5
git push origin v1.2.5
```

**What happens:**
1. GitHub Actions detects tag push
2. Runs 3 parallel build jobs: ubuntu-22.04, windows-latest, macos-latest
3. Each job:
   - Checks out code
   - Sets up Node.js + Rust
   - Runs `npm install`
   - Builds Tauri app with signing (via `tauri-apps/tauri-action@v0`)
   - Uploads build artifacts (AppImage, MSI, DMG, .sig files)
4. After all 3 jobs complete:
   - Downloads all artifacts
   - Runs `scripts/generate-update-manifest.cjs` to create `latest.json`
   - Rsyncs everything to VPS `/var/www/flowstate/updates/`

**tauri-action handles signing automatically:**
- Reads `TAURI_SIGNING_PRIVATE_KEY` from GitHub Secrets
- Reads `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` from GitHub Secrets (if set)
- Passes them to tauri-cli build
- Generates `.sig` files alongside binaries

**No manual intervention needed** - push a tag and the entire release pipeline runs automatically.

### GitHub Secrets Configuration

**Required secrets in GitHub repository settings:**

| Secret Name | Value | Notes |
|-------------|-------|-------|
| `TAURI_SIGNING_PRIVATE_KEY` | Content of `~/.tauri/flow-state.key` | Copy entire file content |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password used when generating key | Omit if using passwordless key |
| `SSH_PRIVATE_KEY` | SSH private key for VPS access | For rsync deployment |
| `VPS_HOST` | `84.46.253.137` | VPS IP address |
| `VPS_USER` | `root` | SSH user |

**How to add secrets:**
1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `TAURI_SIGNING_PRIVATE_KEY`
4. Value: `cat ~/.tauri/flow-state.key` (paste entire output)
5. Repeat for other secrets

**Security notes:**
- GitHub Secrets are encrypted at rest
- Only visible in GitHub Actions logs if explicitly echoed (NEVER echo private key)
- Cannot be read via API once set
- Rotate keys if compromised (regenerate key pair + update config)

### Workflow YAML Excerpt

**Simplified example from `.github/workflows/release.yml`:**

```yaml
jobs:
  build-tauri:
    strategy:
      matrix:
        platform: [ubuntu-22.04, windows-latest, macos-latest]
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - uses: tauri-apps/tauri-action@v0
        env:
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: v__VERSION__
          releaseName: 'FlowState v__VERSION__'
          releaseBody: 'See CHANGELOG.md for details'
      - uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.platform }}-build
          path: |
            src-tauri/target/release/bundle/**/*.AppImage
            src-tauri/target/release/bundle/**/*.msi
            src-tauri/target/release/bundle/**/*.dmg
            src-tauri/target/release/bundle/**/*.sig

  deploy:
    needs: build-tauri
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
      - run: node scripts/generate-update-manifest.cjs
      - run: |
          rsync -avz --delete \
            -e "ssh -i ~/.ssh/vps_key" \
            artifacts/ root@84.46.253.137:/var/www/flowstate/updates/
```

**Notes:**
- `tauri-action` automatically detects signing env vars and passes them to build
- `upload-artifact` preserves `.sig` files for the deploy step
- `generate-update-manifest.cjs` reads all `.sig` files and generates `latest.json`
- `rsync --delete` removes old versions from VPS (keeps only latest)

## Frontend Components

### useTauriUpdater.ts (Composable)

**Location:** `src/composables/useTauriUpdater.ts`

**API:**

```typescript
const {
  status,           // 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error' | 'up-to-date'
  updateInfo,       // { version, date, body (release notes) }
  error,            // Error message if status === 'error'
  downloadProgress, // 0-100 percentage
  checkForUpdates,  // () => Promise<void> - Check VPS endpoint
  downloadAndInstall, // () => Promise<void> - Download + install update
  restart,          // () => Promise<void> - Restart app after update
} = useTauriUpdater()
```

**State machine:**

```
idle → checking → (available | up-to-date | error)
available → downloading → (ready | error)
ready → [user clicks restart] → app relaunches
```

**Example usage:**

```vue
<script setup lang="ts">
import { useTauriUpdater } from '@/composables/useTauriUpdater'

const { status, updateInfo, checkForUpdates, downloadAndInstall, restart } = useTauriUpdater()

async function handleCheckUpdate() {
  await checkForUpdates()
  if (status.value === 'available') {
    await downloadAndInstall()
  }
}
</script>

<template>
  <button @click="handleCheckUpdate">Check for Updates</button>
  <div v-if="status === 'available'">
    Update {{ updateInfo.version }} available
  </div>
  <div v-if="status === 'ready'">
    <button @click="restart">Restart to Apply</button>
  </div>
</template>
```

### AboutSettingsTab.vue (Settings UI)

**Location:** `src/components/settings/tabs/AboutSettingsTab.vue`

**Features:**
- Displays current app version (via `__APP_VERSION__` injected by Vite)
- "Check for Updates" button
- Download progress bar (shown during download)
- "Restart to Apply" button (shown when update ready)
- Auto-update toggle (saved to `settings.autoUpdateEnabled`)

**Flow:**
1. User clicks "Check for Updates"
2. `checkForUpdates()` runs → queries VPS endpoint
3. If newer version found → status changes to `'available'`
4. If `autoUpdateEnabled === true` → `downloadAndInstall()` runs automatically
5. Progress bar shows download percentage
6. When complete → "Restart to Apply" button appears
7. User clicks restart → app relaunches with new version

### TauriUpdateNotification.vue (Launch Notification)

**Location:** `src/components/common/TauriUpdateNotification.vue`

**Purpose:**
- Automatically checks for updates on app launch (after 3 second delay)
- Shows toast notification if update available
- Honors `autoUpdateEnabled` setting

**Flow:**
1. App launches → TauriUpdateNotification component mounts
2. Waits 3 seconds (avoids blocking startup)
3. Calls `checkForUpdates()`
4. If update available:
   - Shows toast: "Update X.X.X available"
   - If `autoUpdateEnabled === true` → downloads automatically
   - Else → shows "Download" button in toast
5. User can click "Download" → starts download
6. When ready → shows "Restart to Apply" notification

**Auto-update behavior:**
- Default: `autoUpdateEnabled === false` (user must click Download)
- If user enables auto-update in Settings → downloads start automatically
- Restart always requires manual confirmation (never auto-restarts)

## Update Flow (End-to-End)

### Step-by-Step Release Process

**1. Bump version in 3 files:**

```bash
# package.json
"version": "1.2.6"

# src-tauri/tauri.conf.json
"version": "1.2.6"

# src-tauri/Cargo.toml
version = "1.2.6"
```

**Why 3 files?**
- `package.json` → npm versioning, `__APP_VERSION__` injected into frontend
- `tauri.conf.json` → Tauri build system, shown in app metadata
- `Cargo.toml` → Rust package versioning

**2. Commit version bump:**

```bash
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore: bump version to 1.2.6"
```

**3. Create and push git tag:**

```bash
git tag v1.2.6
git push origin master
git push origin v1.2.6
```

**4. CI/CD builds automatically:**
- GitHub Actions detects tag
- Builds for Linux, Windows, macOS in parallel
- Signs all binaries
- Generates `latest.json` with embedded signatures
- Deploys to VPS `/var/www/flowstate/updates/`

**5. User's app detects update:**
- On next launch, `TauriUpdateNotification.vue` runs check
- Fetches `https://in-theflow.com/updates/latest.json`
- Compares `version` field with current app version
- If newer → shows notification

**6. User downloads update:**
- Clicks "Download" in toast (or auto-downloads if enabled)
- `useTauriUpdater.ts` calls `downloadAndInstall()`
- Downloads AppImage from VPS
- Verifies signature using embedded pubkey
- Installs to temp directory

**7. User restarts app:**
- Clicks "Restart to Apply"
- App closes, relaunches from new binary
- New version is now active

**8. Verification:**
- Settings > About shows new version number
- Release notes visible in update notification

## First Bootstrap

**Problem:** Users on old versions **without the updater** cannot receive in-app updates.

**Solution:** One-time manual install required.

**Bootstrap process:**
1. User installs FlowState via `.deb` package (initial install)
2. App includes updater code (FEATURE-1194)
3. From now on, all future updates are in-app
4. User never needs to manually download `.deb` again

**Migration path:**
- Users on versions **before v1.2.5** (without updater) → must manually install v1.2.5+ once
- Users on v1.2.5+ → automatic updates forever

**Communication to users:**
- Announce in release notes: "This is the last manual update you'll need!"
- After bootstrap, updates are seamless

## Troubleshooting

### Issue: "error decoding response body"

**Symptom:**
```
Error checking for updates: error decoding response body: missing field `version` at line 1 column 123
```

**Cause:** VPS endpoint not set up, or `latest.json` is invalid JSON.

**Fix:**
1. Verify endpoint is accessible: `curl https://in-theflow.com/updates/latest.json`
2. Validate JSON: `cat latest.json | jq .`
3. Check that `latest.json` exists on VPS: `ssh root@84.46.253.137 "ls /var/www/flowstate/updates/"`
4. Upload manifest: `scp latest.json root@84.46.253.137:/var/www/flowstate/updates/`

### Issue: "incorrect updater private key password: Wrong password for that key"

**Symptom:**
```
Error: incorrect updater private key password: Wrong password for that key
```

**Cause:** tauri-cli 2.9.6 bug (see "CRITICAL BUG" section above).

**Fix:**
```bash
npm install -D @tauri-apps/cli@2.8.0
npm run build && npx tauri build
```

**Verify:** Check that `.sig` files are generated:
```bash
ls src-tauri/target/release/bundle/appimage/*.sig
```

### Issue: Pubkey mismatch warning

**Symptom:**
```
WARN tauri_updater: Public key in tauri.conf.json does not match signing key
```

**Cause:** You regenerated signing keys but didn't update `tauri.conf.json`.

**Fix:**
1. Get new public key: `cat ~/.tauri/flow-state.key.pub`
2. Copy the base64 string
3. Update `src-tauri/tauri.conf.json`:
   ```json
   "plugins": {
     "updater": {
       "pubkey": "<paste new public key here>"
     }
   }
   ```
4. Commit the change
5. Rebuild and redeploy

### Issue: "__TAURI_BUNDLE_TYPE warning"

**Symptom:**
```
WARN tauri_bundler::bundle::linux::appimage: Failed to add bundler type to the binary
```

**Cause:** `strip = "symbols"` in `Cargo.toml` removes debug symbols.

**Impact:** **NONE** - This is a harmless warning. The updater works correctly.

**Fix (optional):** Change `Cargo.toml` to `strip = false` (increases binary size ~30-50%).

**Recommendation:** Ignore the warning. Smaller binaries are better for download speed.

### Issue: "No such device or address"

**Symptom:**
```
Error: No such device or address (os error 6)
```

**Cause:** No TTY for password prompt when building non-interactively.

**Fix:** Set environment variables before build:
```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/flow-state.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="flowstate2026"
npx tauri build
```

### Issue: Updater not checking on app launch

**Symptom:** App launches but never shows update notification.

**Cause:** `TauriUpdateNotification.vue` not mounted, or check not called.

**Fix:**
1. Verify component is imported in main App.vue:
   ```vue
   <TauriUpdateNotification />
   ```
2. Check that `useTauriStartup.ts` doesn't block the check
3. Look for errors in console: `journalctl -f | grep FlowState`

### Issue: Signature verification fails

**Symptom:**
```
Error: Invalid signature for update
```

**Cause:** Signature in `latest.json` doesn't match the downloaded binary.

**Fix:**
1. Regenerate `latest.json` with correct signature:
   ```bash
   npm run tauri:update-manifest
   ```
2. Upload to VPS:
   ```bash
   scp latest.json root@84.46.253.137:/var/www/flowstate/updates/
   ```
3. Verify signature field matches `.sig` file content:
   ```bash
   cat src-tauri/target/release/bundle/appimage/*.sig
   # Compare with latest.json platforms.linux-x86_64.signature field
   ```

## Version Bump Checklist

**Before releasing a new version, complete ALL steps:**

- [ ] **Bump version in `package.json`**
  ```json
  "version": "1.2.6"
  ```

- [ ] **Bump version in `src-tauri/tauri.conf.json`**
  ```json
  "version": "1.2.6"
  ```

- [ ] **Bump version in `src-tauri/Cargo.toml`**
  ```toml
  version = "1.2.6"
  ```

- [ ] **Update release notes** (CHANGELOG.md or commit message)

- [ ] **Commit version bump**
  ```bash
  git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
  git commit -m "chore: bump version to 1.2.6"
  ```

- [ ] **Create git tag**
  ```bash
  git tag v1.2.6
  ```

- [ ] **Push to remote**
  ```bash
  git push origin master
  git push origin v1.2.6
  ```

- [ ] **Wait for CI/CD to complete** (check GitHub Actions)

- [ ] **Verify VPS deployment**
  ```bash
  curl https://in-theflow.com/updates/latest.json | jq .version
  # Should output: "1.2.6"
  ```

- [ ] **Test in-app update** (launch old version, click Check for Updates)

- [ ] **Verify Settings > About shows new version** (after restart)

**If CI/CD is not set up, manual build:**

- [ ] **Build with signing**
  ```bash
  export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/flow-state.key)"
  export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="flowstate2026"
  npm run build && npx tauri build
  ```

- [ ] **Generate update manifest**
  ```bash
  npm run tauri:update-manifest
  ```

- [ ] **Upload to VPS**
  ```bash
  scp src-tauri/target/release/bundle/appimage/FlowState_*.AppImage \
      src-tauri/target/release/bundle/latest.json \
      root@84.46.253.137:/var/www/flowstate/updates/
  ```

- [ ] **Verify upload**
  ```bash
  curl https://in-theflow.com/updates/latest.json
  curl -I https://in-theflow.com/updates/FlowState_1.2.6_amd64.AppImage
  ```

## Key Files Reference

**Configuration:**
```
~/.tauri/flow-state.key                               # PRIVATE signing key (NEVER commit)
~/.tauri/flow-state.key.pub                           # PUBLIC signing key (safe to commit)
src-tauri/tauri.conf.json                             # Tauri config: version, updater endpoint, pubkey
src-tauri/Cargo.toml                                  # Rust package: version, release profile
package.json                                          # npm package: version
```

**Frontend:**
```
src/composables/useTauriUpdater.ts                    # Updater composable (check/download/restart)
src/components/common/TauriUpdateNotification.vue     # Launch notification (auto-check)
src/components/settings/tabs/AboutSettingsTab.vue     # Settings UI (manual check + auto-update toggle)
src/stores/settings.ts                                # autoUpdateEnabled setting
```

**Build System:**
```
scripts/generate-update-manifest.cjs                  # Generates latest.json from build artifacts
.github/workflows/release.yml                         # CI/CD: build, sign, deploy
vite.config.ts                                        # Injects __APP_VERSION__ for frontend
```

**VPS:**
```
/var/www/flowstate/updates/latest.json                # Update manifest (version + signatures)
/var/www/flowstate/updates/FlowState_X.X.X_*.AppImage # Linux update binaries
/var/www/flowstate/updates/FlowState_X.X.X_*.msi      # Windows update binaries
/var/www/flowstate/updates/FlowState_X.X.X_*.dmg      # macOS update binaries
```

**Build Output:**
```
src-tauri/target/release/bundle/appimage/*.AppImage      # Linux update binary
src-tauri/target/release/bundle/appimage/*.AppImage.sig  # Linux signature
src-tauri/target/release/bundle/msi/*.msi                # Windows installer
src-tauri/target/release/bundle/msi/*.msi.sig            # Windows signature
src-tauri/target/release/bundle/dmg/*.dmg                # macOS disk image
src-tauri/target/release/bundle/dmg/*.dmg.sig            # macOS signature
```

## Security Considerations

**Key protection:**
- Private key (`~/.tauri/flow-state.key`) is encrypted with password
- Add to `.gitignore` to prevent accidental commit
- Store in secure location (e.g., password manager) as backup
- GitHub Secrets encrypt at rest and in transit

**Signature verification:**
- All updates are cryptographically verified before installation
- If signature doesn't match → update is rejected
- Public key is embedded in app binary (cannot be tampered with)
- Man-in-the-middle attacks cannot inject malicious updates

**Key rotation:**
- If private key is compromised: generate new key pair
- Update `tauri.conf.json` with new pubkey
- Rebuild and release new version
- Old versions will reject updates signed with new key (expected)
- Users must manually install the new version once

**VPS security:**
- Updates served over HTTPS (TLS 1.3)
- Cloudflare CDN provides DDoS protection
- VPS has UFW firewall + Fail2Ban
- SSH keys only, password auth disabled

## Related Documentation

- **SOP-011**: [Tauri Distribution](./SOP-011-tauri-distribution.md) - General Tauri build and release process
- **SOP-026**: [Custom Domain Deployment](./SOP-026-custom-domain-deployment.md) - VPS domain setup
- **SOP-030**: [Doppler Secrets Management](./SOP-030-doppler-secrets-management.md) - Secrets in CI/CD
- **GitHub Actions Workflow**: `.github/workflows/release.yml`
- **Tauri Updater Plugin Docs**: https://tauri.app/v2/guides/distribution/updater/

---

**Last Updated:** 2026-02-05
**Status:** Active
**Related Feature:** FEATURE-1194 (Tauri In-App Auto-Updater)
