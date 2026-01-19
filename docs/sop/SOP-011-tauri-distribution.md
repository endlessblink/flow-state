# SOP-011: Tauri Desktop Distribution

**Created**: 2026-01-18
**Updated**: 2026-01-19
**Status**: Active
**Related Task**: TASK-305

---

## Overview

FlowState is distributed as a native desktop application using Tauri 2.x. This SOP covers building, signing, and releasing the app for Linux, Windows, and macOS.

## Architecture

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

## Prerequisites

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

## Local Build Process

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

## Installation

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

## Auto-Updater Setup

### Generate Signing Keys

```bash
# Generate key pair with password
npx tauri signer generate -w ~/.tauri/flowstate.key

# Output example:
# Your keypair was generated successfully
# Public: dW50cnVzdGVkIGNvbW1lbnQ6IG1pbm...
# Private: The generated private key in ~/.tauri/flowstate.key
```

### Configure tauri.conf.json

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

### GitHub Secrets

Add these secrets to your repository (Settings > Secrets > Actions):

| Secret Name | Value |
|-------------|-------|
| `TAURI_SIGNING_PRIVATE_KEY` | Contents of `~/.tauri/flowstate.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password used during key generation |

## GitHub Actions Release

### Workflow Location
`.github/workflows/release.yml`

### Trigger Methods

**Method 1: Git Tag**
```bash
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

**Method 2: Manual Dispatch**
Go to Actions > Release > Run workflow > Enter version

### Build Matrix

| Platform | Runner | Target |
|----------|--------|--------|
| Linux | ubuntu-22.04 | x86_64 |
| Windows | windows-latest | x86_64 |
| macOS ARM | macos-latest | aarch64-apple-darwin |
| macOS Intel | macos-latest | x86_64-apple-darwin |

### Release Artifacts

The workflow creates a draft release with:
- Platform-specific installers
- `latest.json` for auto-updater
- `.sig` signature files for each bundle

## Desktop Shortcuts

### Standard Installation
The `.deb` package installs:
- Binary: `/usr/bin/flow-state`
- Desktop file: `/usr/share/applications/FlowState.desktop`
- Icon: `/usr/share/icons/hicolor/*/apps/flow-state.png`

### KDE Plasma (Folder View Desktop)

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

## Docker/Supabase Orchestration

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

## Version Management

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

## Troubleshooting

### Build Fails on Ubuntu
```bash
# Missing webkit dependency
sudo apt-get install libwebkit2gtk-4.1-dev

# Missing patchelf
sudo apt-get install patchelf
```

### Desktop Shortcut Not Appearing
```bash
# Rebuild desktop database
update-desktop-database ~/.local/share/applications

# Check if file exists
ls -la /usr/share/applications/FlowState.desktop
```

### Auto-Updater 403 Error
- Verify `pubkey` in tauri.conf.json matches generated public key
- Ensure GitHub secrets are correctly set
- Check release is published (not draft)

### GitHub Actions Build Fails with "pnpm not found"
The tauri-action defaults to pnpm. Fix by adding `tauriScript`:
```yaml
- uses: tauri-apps/tauri-action@v0
  with:
    tauriScript: npm run tauri  # Use npm instead of pnpm
```

### macOS Cross-Compilation Fails
Add Rust targets in the workflow:
```yaml
- name: Install Rust stable
  uses: dtolnay/rust-toolchain@stable
  with:
    targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}
```

### Windows SmartScreen Warning
Users may see "Windows protected your PC" warning. This is normal for unsigned apps. To resolve:
1. Click "More info"
2. Click "Run anyway"

Or sign with a Windows code signing certificate.

### macOS Gatekeeper Warning
```bash
# Remove quarantine attribute
xattr -d com.apple.quarantine /Applications/FlowState.app
```

Or sign with an Apple Developer certificate.

## Key Files Reference

| File | Purpose |
|------|---------|
| `src-tauri/tauri.conf.json` | Tauri configuration, version, updater settings |
| `src-tauri/Cargo.toml` | Rust package metadata |
| `src-tauri/src/lib.rs` | Tauri commands for Docker/Supabase |
| `.github/workflows/release.yml` | CI/CD release workflow |
| `src/composables/useTauriStartup.ts` | Frontend startup orchestration |

## Security Considerations

1. **Signing Keys**: Store private key securely, never commit to repo
2. **GitHub Secrets**: Use repository secrets, not plaintext
3. **CSP Policy**: Configured in tauri.conf.json to restrict content sources
4. **Permissions**: Only request necessary capabilities in `src-tauri/capabilities/`

## Future Improvements

- [ ] Add Windows code signing certificate
- [ ] Add Apple Developer certificate for macOS
- [ ] Add auto-update UI notification
- [ ] Add delta updates for faster downloads
- [ ] Add Linux Flatpak/Snap packages
