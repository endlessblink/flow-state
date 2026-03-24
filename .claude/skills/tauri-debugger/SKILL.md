---
name: tauri-debugger
description: Debug Tauri 2.x desktop app issues including dialogs, CSP, plugins, and Vite integration. Triggers on Tauri dialog not opening, file save dialog doesn't work, CSP errors, virtual:pwa-register errors, click handlers not working in Tauri, XDG Portal issues on Linux.
---

# Tauri Debugger Skill

Debug Tauri 2.x desktop app issues including dialogs, CSP, plugins, and Vite integration.

## Trigger Patterns

- Tauri dialog not opening / not appearing
- File save dialog doesn't work
- CSP (Content Security Policy) errors in Tauri
- `virtual:pwa-register` errors
- Click handlers not working in Tauri
- Tauri dev vs build differences
- XDG Portal issues on Linux

## Quick Diagnostics

### 1. Check Tauri Detection in Vite

```typescript
// vite.config.ts should have:
const isTauri =
  process.env.TAURI_ENV_PLATFORM !== undefined ||  // Build
  process.env.TAURI_DEV !== undefined              // Dev

// tauri.conf.json must set TAURI_DEV in dev:
"beforeDevCommand": "TAURI_DEV=true npm run dev"
```

### 2. Check XDG Portal (Linux)

```bash
# Portal service running?
systemctl --user status xdg-desktop-portal

# zenity installed (fallback)?
which zenity || echo "INSTALL: sudo apt install zenity"

# FileChooser portal working?
gdbus call --session \
    --dest org.freedesktop.portal.Desktop \
    --object-path /org/freedesktop/portal/desktop \
    --method org.freedesktop.DBus.Properties.Get \
    org.freedesktop.portal.FileChooser version
```

### 3. Check PWA Plugin Configuration

**WRONG** (causes CSP errors):
```typescript
!isTauri && VitePWA({ ... })  // No stub modules provided!
```

**CORRECT**:
```typescript
VitePWA({
  disable: isTauri,  // Provides empty stub modules
  ...
})
```

### 4. Check Dialog Plugin (Cargo.toml)

```toml
# For Linux with XDG Portal support:
tauri-plugin-dialog = { version = "2.6", default-features = false, features = ["xdg-portal"] }

# NOTE: Can't enable both gtk3 AND xdg-portal - they conflict!
```

### 5. Check Capabilities (src-tauri/capabilities/default.json)

```json
{
  "permissions": [
    "dialog:default",
    "dialog:allow-save",
    "dialog:allow-open",
    "fs:default",
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [
        { "path": "$DOWNLOAD/**" },
        { "path": "$HOME/**" }
      ]
    }
  ]
}
```

## Common Issues & Solutions

### Issue: CSP Error `virtual:pwa-register/vue`

**Symptoms**:
- Console shows "Refused to load virtual:pwa-register/vue because it does not appear in the script-src directive"
- Click handlers don't fire
- Vue events seem broken

**Root Cause**: PWA plugin conditionally excluded but import statements still exist in code. No stub modules provided.

**Solution**:
```typescript
// vite.config.ts
VitePWA({
  disable: isTauri,  // This provides empty stub modules
  ...
})
```

### Issue: `isTauri` is false during `tauri dev`

**Symptoms**:
- PWA enabled in Tauri dev mode
- Tauri-specific code not running

**Root Cause**: `TAURI_ENV_PLATFORM` only set during `tauri build`, not `tauri dev`.

**Solution**:
```json
// tauri.conf.json
{
  "build": {
    "beforeDevCommand": "TAURI_DEV=true npm run dev"
  }
}
```

### Issue: Dialog doesn't appear on Linux

**Symptoms**:
- `dialog.save()` returns immediately with no dialog
- No errors in console

**Checklist**:
1. Install zenity: `sudo apt install zenity`
2. Check XDG Portal is running: `systemctl --user status xdg-desktop-portal`
3. Use xdg-portal feature in Cargo.toml (not gtk3)
4. Ensure DISPLAY/WAYLAND_DISPLAY env vars are set

### Issue: Blocking dialog freezes app

**Symptoms**:
- App hangs when calling `blocking_save_file()`

**Root Cause**: Blocking API can't acquire GTK MainContext from certain threads.

**Solution**: Use async API instead:
```rust
#[tauri::command(async)]
async fn save_file(app: AppHandle) -> Option<PathBuf> {
    app.dialog()
        .file()
        .save_file()
        .await
        .map(|p| p.into_path())
        .flatten()
}
```

## Key Files Reference

| File | Purpose |
|------|---------|
| `vite.config.ts` | Tauri detection, PWA disable |
| `src-tauri/tauri.conf.json` | beforeDevCommand, CSP, devUrl |
| `src-tauri/Cargo.toml` | Plugin versions and features |
| `src-tauri/capabilities/default.json` | Permissions for dialogs, fs |
| `src-tauri/src/lib.rs` | Rust commands |

## Version Compatibility

| Package | Minimum Version | Notes |
|---------|-----------------|-------|
| `@tauri-apps/plugin-dialog` | 2.6.0 | XDG Portal support |
| `@tauri-apps/plugin-fs` | 2.4.5 | Better error messages |
| `tauri-plugin-dialog` (Rust) | 2.6 | xdg-portal feature |
| `zenity` (Linux) | any | Fallback dialog renderer |

## WebKitGTK Testing Workflow (CRITICAL — read before debugging)

### The Problem with Blind Deploys
WebKitGTK bugs only appear in Tauri — NOT in Chrome/Firefox/Safari. Deploying fixes without testing in WebKitGTK leads to wasted build cycles. Use these testing methods:

### Method 1: Python WebKitGTK 4.1 Wrapper (Fastest for CSS)
Uses the **exact same engine** as Tauri's wry (libwebkit2gtk-4.1). Injects `.tauri-app` class for CSS parity.

```bash
# Start Vite on port 6366
npx vite --port 6366 &

# Open WebKitGTK 4.1 window with Tauri CSS parity
python3 scripts/webkit-dev.py
```

- CSS changes auto-reload via HMR — no Rust rebuild
- Right-click → Inspect Element for DevTools
- **Limitation:** Cannot reproduce CSP issues or `tauri://` protocol bugs (uses `http://localhost`)

### Method 2: cargo tauri dev (For Tauri-specific bugs)
```bash
# Terminal 1: Start Vite manually
TAURI_DEV=true npm run dev

# Terminal 2: Run Tauri (skip beforeDevCommand)
cargo tauri dev --no-dev-server-wait
```

### Method 3: Epiphany (GNOME Web) — WRONG ENGINE
Epiphany uses WebKitGTK **6.0** (GTK4), Tauri uses WebKitGTK **4.1** (GTK3). Different rendering behavior. DO NOT rely on Epiphany for Tauri bug reproduction.

### When Each Method Works

| Issue Type | Python Wrapper | cargo tauri dev | Production Build |
|-----------|:-:|:-:|:-:|
| CSS layout/clipping | ✅ | ✅ | ✅ |
| CSS with `.tauri-app` overrides | ✅ (injected) | ✅ | ✅ |
| CSP blocking styles | ❌ | ❌ (no CSP in dev) | ✅ only |
| `tauri://` protocol issues | ❌ | ❌ | ✅ only |
| NPopover/dropdown visibility | ✅ | ✅ | may differ (CSP) |

### Key Insight: Dev vs Production Differences
- **Dev mode** (`cargo tauri dev`): Loads from `http://localhost:5546` — no CSP nonce injection
- **Production build** (`cargo tauri build`): Loads from `tauri://localhost/` — CSP nonces added to all `<style>` tags at compile time
- Runtime-injected `<style>` tags (from CSS-in-JS like Naive UI's css-render) get **silently blocked** in production

## CSP + CSS-in-JS (Naive UI) — CRITICAL

### The Problem
Naive UI uses `css-render` which injects `<style>` tags at runtime via `document.head.appendChild()`. In Tauri production builds, the CSP nonce system blocks these runtime-injected styles because they lack the compile-time nonce. This makes components like NPopover, NDropdown, NSelect **invisible** (DOM exists but has zero styling).

### The Fix
```json
// src-tauri/tauri.conf.json → app.security
{
  "dangerousDisableAssetCspModification": ["style-src"],
  "csp": {
    "style-src": "'self' 'unsafe-inline' https://fonts.googleapis.com",
    ...
  }
}
```

`dangerousDisableAssetCspModification: ["style-src"]` tells Tauri NOT to add nonces to `style-src`, so `'unsafe-inline'` actually works for css-render's runtime style injection.

**Reference:** [Tauri Discussion #8578](https://github.com/tauri-apps/tauri/discussions/8578)

### Diagnosing CSP Issues
Build with devtools enabled to see CSP violation errors:
```bash
cargo tauri build --debug
# Then right-click → Inspect → Console
# Look for: "Refused to apply inline style because it violates..."
```

### NPopover Tips for Tauri
- `raw` prop is fine — strips Naive UI wrapper, uses custom styling
- `to="body"` teleport works correctly with CSP fix
- If dropdown appears with double shadow: check if `raw` is missing (Naive UI wrapper adds its own background/shadow)

## WebKitGTK CSS Gotchas (confirmed bugs)

| Issue | Cause | Fix |
|-------|-------|-----|
| Sidebar items 24px wide | `contain: layout` on parent | Remove `layout` from `contain` |
| `overflow: clip` hides content | Not supported in WebKitGTK | Use `overflow: hidden` + `/* WebKitGTK-safe */` |
| `display: inline-flex` collapses in flex chains | WebKitGTK sizes to intrinsic content | Use `display: flex; width: 100%` |
| Fonts show as "serif" | False positive in test — "sans-serif" contains "serif" | Use regex `/(?<![a-z-])serif/` |
| Nested `<button>` breaks clicks | Invalid HTML per spec | Use `<span role="button" tabindex="0">` |

## Related Skills

- `supabase-debugger` - For Supabase connection issues in Tauri
- `dev-debugging` - General Vue/Pinia debugging
- `tauri` - Build, sign, deploy pipeline
