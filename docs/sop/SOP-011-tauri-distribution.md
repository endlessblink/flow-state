# SOP-011: Tauri Desktop Distribution (Complete Guide)

**Created**: 2026-01-18
**Updated**: 2026-01-22
**Status**: Active
**Related Tasks**: TASK-305, TASK-348
**Consolidated From**: SOP-011, SOP-014, SOP-015

---

## 1. Overview

FlowState is distributed as a native desktop application using Tauri 2.x. This comprehensive guide covers building, starting, and releasing the app for Linux, Windows, and macOS.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     TAURI BUILD ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐        │
│  │   Vue 3 App   │ ─► │ Vite Build    │ ─► │   dist/       │        │
│  │   (Frontend)  │    │ (npm build)   │    │   (static)    │        │
│  └───────────────┘    └───────────────┘    └───────┬───────┘        │
│                                                     │                │
│  ┌───────────────┐    ┌───────────────┐    ┌───────▼───────┐        │
│  │  Rust Backend │ ─► │ Cargo Build   │ ─► │   Tauri App   │        │
│  │  (src-tauri)  │    │ (rustc)       │    │   (bundled)   │        │
│  └───────────────┘    └───────────────┘    └───────────────┘        │
│                                                     │                │
│                                            ┌────────┴────────┐      │
│                                            ▼        ▼        ▼      │
│                                         .deb     .exe      .dmg     │
│                                         .rpm     .msi      .app     │
│                                         .AppImage                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Prerequisites

### Local Development

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | 20+ | Frontend build |
| Rust | stable | Backend compilation |
| Docker Desktop | 4.x+ | Local Supabase |
| Supabase CLI | 1.x+ | Database management |

### Linux Build Dependencies

```bash
# Ubuntu/Debian
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

# Fedora
sudo dnf install webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel
```

### Windows Build Dependencies

- Visual Studio Build Tools 2019+
- WebView2 Runtime (bundled automatically)

### macOS Build Dependencies

- Xcode Command Line Tools
- Apple Developer certificate (for code signing)

---

## 3. Startup Methods

### Quick Reference

| Scenario | Command | Notes |
|----------|---------|-------|
| **Development** | `npm run tauri dev` | Recommended for daily use |
| **Pre-built Binary** | `npm run tauri:run` | Requires recent build |
| **Fresh Build + Run** | `npm run tauri:rebuild` | Rebuilds then runs |

### Method 1: Development Mode (Recommended)

```bash
npm run tauri dev
```

**What it does:**
1. Validates Supabase JWT keys
2. Starts Vite dev server on port 5546
3. Starts backup watcher
4. Opens Tauri window pointing to localhost:5546

**Advantages:**
- Hot module reloading (HMR)
- Full console logging
- Automatic Supabase detection

**When to use:**
- Daily development
- Testing changes
- Debugging issues

### Method 2: Release Binary

```bash
npm run tauri:run
# or directly:
./src-tauri/target/release/flow-state
```

**Prerequisites:**
- Must have built recently with `npm run tauri build`
- `dist/` folder must exist with bundled frontend

**When to use:**
- Testing production-like behavior
- Performance testing
- Demo purposes

### Method 3: Rebuild and Run

```bash
npm run tauri:rebuild
```

**What it does:**
1. Runs `npm run tauri build` (full production build)
2. Executes the release binary

**When to use:**
- After major code changes
- When release binary is outdated
- Before creating a release

### Environment Variables

| Variable | Dev Value | Production Value |
|----------|-----------|------------------|
| `VITE_SUPABASE_URL` | `/supabase` (proxy) | `http://127.0.0.1:54321` |
| `TAURI_DEV` | `true` (set by beforeDevCommand) | Not set |

---

## 4. Supabase Integration

### Health Check Pattern

The Tauri app uses direct HTTP health checks instead of relying on `supabase status`, which requires being in the project directory.

**Why this matters:**
- `supabase status` only works from the project directory
- Tauri apps can be launched from anywhere (/usr/bin, Desktop shortcut, etc.)
- Direct health checks work regardless of working directory

**Implementation:**

```rust
// src-tauri/src/lib.rs

#[tauri::command]
async fn check_supabase_status(app: tauri::AppHandle) -> Result<String, String> {
    // First try direct health check - works regardless of working directory
    let health_check = app
        .shell()
        .command("curl")
        .args(["-s", "-o", "/dev/null", "-w", "%{http_code}",
               "http://127.0.0.1:54321/rest/v1/", "--max-time", "2"])
        .output()
        .await;

    if let Ok(output) = health_check {
        let status_code = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if status_code == "200" {
            // Supabase is responding
            return Ok("running:{}".to_string());
        }
    }

    // Fallback to CLI check
    let output = app
        .shell()
        .command("supabase")
        .args(["status", "-o", "json"])
        .output()
        .await
        .map_err(|e| format!("Failed to run supabase: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        Ok(format!("running:{}", stdout))
    } else {
        Ok("not_running".to_string())
    }
}
```

### Startup Flow

```
┌─────────────────────────────────────────────────────────┐
│                    STARTUP FLOW                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  App Launch → Check Docker → Check Supabase → Connect   │
│       │            │              │              │       │
│       │            ▼              ▼              ▼       │
│       │      ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│       │      │ Running │    │ Healthy │    │ Ready   │  │
│       │      │   ✓     │    │   ✓     │    │   ✓     │  │
│       │      └─────────┘    └─────────┘    └─────────┘  │
│       │                                                  │
│       └─► If any check fails: Show "Try Again" button   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Docker/Supabase Orchestration

The app automatically manages local services on launch:

```rust
// src-tauri/src/lib.rs - Tauri Commands
#[tauri::command] fn check_docker_status() -> DockerStatus
#[tauri::command] fn start_docker_desktop() -> Result<()>
#[tauri::command] fn check_supabase_status() -> SupabaseStatus
#[tauri::command] fn start_supabase() -> Result<()>
#[tauri::command] fn stop_supabase() -> Result<()>
#[tauri::command] fn run_supabase_migrations() -> Result<()>
```

```typescript
// src/composables/useTauriStartup.ts
// Orchestrates startup sequence:
// 1. Check Docker → Start if needed
// 2. Check Supabase → Start if needed
// 3. Run migrations
// 4. App ready
```

---

## 5. Build Process

### Step 1: Install Dependencies

```bash
npm ci
```

### Step 2: Build the App

```bash
npm run tauri build
```

### Build Outputs

| Platform | Output Location | Files |
|----------|-----------------|-------|
| Linux | `src-tauri/target/release/bundle/` | `deb/*.deb`, `rpm/*.rpm`, `appimage/*.AppImage` |
| Windows | `src-tauri/target/release/bundle/` | `msi/*.msi`, `nsis/*.exe` |
| macOS | `src-tauri/target/release/bundle/` | `dmg/*.dmg`, `macos/*.app` |

---

## 6. GitHub Actions & Signing

### Auto-Updater Setup

#### Generate Signing Keys

```bash
# Generate key pair with password
npx tauri signer generate -w ~/.tauri/flowstate.key

# Output example:
# Your keypair was generated successfully
# Public: dW50cnVzdGVkIGNvbW1lbnQ6IG1pbm...
# Private: The generated private key in ~/.tauri/flowstate.key
```

#### Configure tauri.conf.json

```json
{
  "plugins": {
    "updater": {
      "endpoints": [
        "https://github.com/endlessblink/flow-state/releases/latest/download/latest.json"
      ],
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6..."
    }
  }
}
```

#### GitHub Secrets

Add these secrets to your repository (Settings > Secrets > Actions):

| Secret Name | Value |
|-------------|-------|
| `TAURI_SIGNING_PRIVATE_KEY` | Contents of `~/.tauri/flowstate.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password used during key generation |

### Release Workflow

**Location:** `.github/workflows/release.yml`

#### Trigger Methods

**Method 1: Git Tag**
```bash
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

**Method 2: Manual Dispatch**
Go to Actions > Release > Run workflow > Enter version

#### Build Matrix

| Platform | Runner | Target |
|----------|--------|--------|
| Linux | ubuntu-22.04 | x86_64 |
| Windows | windows-latest | x86_64 |
| macOS ARM | macos-latest | aarch64-apple-darwin |
| macOS Intel | macos-latest | x86_64-apple-darwin |

#### Release Artifacts

The workflow creates a draft release with:
- Platform-specific installers
- `latest.json` for auto-updater
- `.sig` signature files for each bundle

---

## 7. Platform-Specific Installation

### Linux (.deb)

```bash
sudo dpkg -i src-tauri/target/release/bundle/deb/FlowState_0.1.0_amd64.deb
```

### Linux (.AppImage)

```bash
chmod +x FlowState_0.1.0_amd64.AppImage
./FlowState_0.1.0_amd64.AppImage
```

### Windows

Double-click the `.msi` or `.exe` installer.

### macOS

Open the `.dmg` and drag FlowState to Applications.

### Desktop Shortcuts

#### Standard Installation

The `.deb` package installs:
- Binary: `/usr/bin/flow-state`
- Desktop file: `/usr/share/applications/FlowState.desktop`
- Icon: `/usr/share/icons/hicolor/*/apps/flow-state.png`

#### KDE Plasma (Folder View Desktop)

If using KDE Plasma with Folder View pointing to a custom directory:

1. Find the application: `/usr/share/applications/FlowState.desktop`
2. Either:
   - Drag from Application Menu to Desktop
   - Copy to your custom Folder View path
   - Add as Icon widget to panel

```bash
# Alternative: Copy to standard desktop
cp /usr/share/applications/FlowState.desktop ~/Desktop/
```

---

## 8. Version Management

### Update Version

Edit `src-tauri/tauri.conf.json`:
```json
{
  "version": "0.2.0"
}
```

Also update `src-tauri/Cargo.toml`:
```toml
[package]
version = "0.2.0"
```

### Create Release

```bash
# Commit version bump
git add -A
git commit -m "chore: bump version to 0.2.0"

# Create and push tag
git tag -a v0.2.0 -m "Release v0.2.0"
git push origin master --tags
```

---

## 9. Troubleshooting

### Startup Issues

#### Binary Exits Immediately

**Symptoms:** `npm run tauri:run` returns to terminal instantly with no window

**Causes:**
- Missing `dist/` folder
- Outdated build
- Missing dependencies

**Solution:**
```bash
# Rebuild
npm run build && npm run tauri build

# Or use dev mode
npm run tauri dev
```

#### Port 5546 Already in Use

**Symptoms:** "Port 5546 is already in use" error

**Solution:**
```bash
npm run kill
# Then retry
npm run tauri dev
```

#### Supabase Not Detected (App Hangs on "Initializing...")

**Symptoms:** App shows "Initializing..." indefinitely

**Solution:**
1. Check Supabase containers: `docker ps | grep supabase`
2. If not running: `supabase start`
3. Click "Try Again" in the app

#### "Port Conflict Detected" (When Supabase Already Running)

**Root Cause:** Old detection logic used `supabase status`, which fails when app launched from outside project directory.

**Solution:** This was fixed by using direct HTTP health check (see Section 4). If you see this error, ensure you have the latest Tauri binary.

#### Shadow Mirror Backup "Invalid supabaseUrl" Errors

**Cause:** `.env` has relative URL `/supabase` for Vite proxy

**Solution:** Fixed in TASK-348 - script now detects relative URLs and falls back to `http://127.0.0.1:54321`

### Build Issues

#### Build Fails on Ubuntu

```bash
# Missing webkit dependency
sudo apt-get install libwebkit2gtk-4.1-dev

# Missing patchelf
sudo apt-get install patchelf
```

#### Desktop Shortcut Not Appearing

```bash
# Rebuild desktop database
update-desktop-database ~/.local/share/applications

# Check if file exists
ls -la /usr/share/applications/FlowState.desktop
```

#### GitHub Actions "pnpm not found"

The tauri-action defaults to pnpm. Fix by adding `tauriScript`:
```yaml
- uses: tauri-apps/tauri-action@v0
  with:
    tauriScript: npm run tauri  # Use npm instead of pnpm
```

#### macOS Cross-Compilation Fails

Add Rust targets in the workflow:
```yaml
- name: Install Rust stable
  uses: dtolnay/rust-toolchain@stable
  with:
    targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}
```

### Security Warnings

#### Auto-Updater 403 Error

- Verify `pubkey` in tauri.conf.json matches generated public key
- Ensure GitHub secrets are correctly set
- Check release is published (not draft)

#### Windows SmartScreen Warning

Users may see "Windows protected your PC" warning. This is normal for unsigned apps. To resolve:
1. Click "More info"
2. Click "Run anyway"

Or sign with a Windows code signing certificate.

#### macOS Gatekeeper Warning

```bash
# Remove quarantine attribute
xattr -d com.apple.quarantine /Applications/FlowState.app
```

Or sign with an Apple Developer certificate.

---

## 10. Key Files Reference

| File | Purpose |
|------|---------|
| `src-tauri/tauri.conf.json` | Tauri configuration, version, updater settings |
| `src-tauri/Cargo.toml` | Rust package metadata |
| `src-tauri/src/lib.rs` | Tauri commands for Docker/Supabase |
| `.github/workflows/release.yml` | CI/CD release workflow |
| `src/composables/useTauriStartup.ts` | Frontend startup orchestration |

---

## 11. Security Considerations

1. **Signing Keys**: Store private key securely, never commit to repo
2. **GitHub Secrets**: Use repository secrets, not plaintext
3. **CSP Policy**: Configured in tauri.conf.json to restrict content sources
4. **Permissions**: Only request necessary capabilities in `src-tauri/capabilities/`

---

## 12. Future Improvements

- [ ] Add Windows code signing certificate
- [ ] Add Apple Developer certificate for macOS
- [ ] Add auto-update UI notification
- [ ] Add delta updates for faster downloads
- [ ] Add Linux Flatpak/Snap packages

---

**Maintainer**: FlowState Team
**Last Verified**: 2026-01-22
