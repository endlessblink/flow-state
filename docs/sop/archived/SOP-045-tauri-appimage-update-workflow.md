# SOP-045: Tauri AppImage Update Workflow

**Created**: 2026-02-21
**Status**: Active
**Related**: SOP-011, SOP-037, BUG-1370

## Problem

The Tauri auto-updater requires the **running binary** to have the updater plugin compiled in. If the user's AppImage is too old (predates updater fixes or the updater plugin itself), the auto-update flow is broken — a chicken-and-egg problem.

Additionally, Tauri 2.x defaults `dragDropEnabled: true`, which intercepts HTML5 drag events at the OS level before they reach the webview. This breaks all in-app drag-and-drop (e.g., inbox-to-canvas task drag). The fix (`dragDropEnabled: false` in `tauri.conf.json`) only takes effect in newly built binaries.

## Key Facts

| Item | Value |
|------|-------|
| AppImage location | `~/Applications/FlowState.AppImage` |
| Build output | `src-tauri/target/release/bundle/appimage/FlowState_<version>_amd64.AppImage` |
| Updater endpoint | `https://in-theflow.com/updates/latest.json` |
| Config file | `src-tauri/tauri.conf.json` |
| `dragDropEnabled` | Must be `false` (line 27) |
| Deploy script | `./scripts/deploy-tauri-update.sh` |

## Workflow: Deploying a Tauri Update

### Standard (auto-updater works)

```bash
# 1. Bump version in 3 files
#    package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml

# 2. Build, sign, deploy
./scripts/deploy-tauri-update.sh --notes "TASK-XXX: description"

# 3. User restarts AppImage → sees update notification → downloads → restarts
```

### Manual Override (user's AppImage is too old for auto-update)

```bash
# 1. Build normally via deploy script (includes VPS upload)
./scripts/deploy-tauri-update.sh --notes "TASK-XXX: description"

# 2. Copy built AppImage to user's Applications directory
cp src-tauri/target/release/bundle/appimage/FlowState_<version>_amd64.AppImage ~/Applications/FlowState.AppImage
chmod +x ~/Applications/FlowState.AppImage

# 3. Launch the new AppImage — future auto-updates will work from here
```

## Diagnostic: Is the User's AppImage Current?

```bash
# Check what's installed
ls -la ~/Applications/FlowState*.AppImage

# Check what the VPS is serving
curl -s https://in-theflow.com/updates/latest.json | python3 -m json.tool

# Compare file sizes and dates — if installed AppImage is significantly smaller
# or older than the build output, it's outdated
```

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| No update notification on launch | AppImage too old (missing updater plugin) | Manual copy (see above) |
| Drag-and-drop doesn't work | `dragDropEnabled: true` in old binary | Rebuild + manual copy |
| Update notification appears but download fails | Signature mismatch (old pubkey) | Manual copy |
| Dev server dies during Tauri build | `beforeBuildCommand` runs `npm run build` which kills dev | Run `npm run dev` after Tauri build completes |

## Prevention

- After **every** deploy via `deploy-tauri-update.sh`, verify the user's installed AppImage version matches the deployed version
- If the user reports the Tauri app behaves differently from local dev, first check if they're running the latest AppImage
- The `.desktop` file at `~/.local/share/applications/FlowState.desktop` should point to `~/Applications/FlowState.AppImage`

## Related SOPs

- **SOP-011**: Tauri distribution (builds/signing)
- **SOP-037**: Tauri updater signing
- **BUG-1370**: `dragDropEnabled: false` fix for HTML5 drag in Tauri
