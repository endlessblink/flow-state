# SOP-033: Tauri Linux CSS Limitations (WebKitGTK)

## Overview

Tauri on Linux uses **WebKitGTK** as its WebView engine, which has limited support for certain CSS features compared to Chromium-based browsers.

## Known Limitations

### `backdrop-filter` Not Working

**Symptom:** Glass/blur effects appear fully transparent instead of frosted glass.

**Cause:** WebKitGTK on Linux (especially X11) has limited `backdrop-filter` support due to:
- GPU acceleration often disabled for compatibility
- X11 compositor limitations
- WebKitGTK CSS implementation gaps

**Affected platforms:**
| Platform | WebView Engine | `backdrop-filter` Support |
|----------|----------------|--------------------------|
| Windows | WebView2 (Chromium) | ✅ Full support |
| macOS | WKWebView | ✅ Full support |
| Linux (X11) | WebKitGTK | ⚠️ Limited/broken |
| Linux (Wayland) | WebKitGTK | ⚠️ Better, but still inconsistent |

### Solution: Opaque Backgrounds for Tauri

We use CSS variable overrides to provide solid backgrounds when running in Tauri:

```css
/* In src/assets/styles.css */
.tauri-app {
  /* Glass backgrounds - FULLY OPAQUE solid colors */
  --glass-bg-soft: rgb(30, 30, 35) !important;
  --glass-bg-medium: rgb(28, 28, 34) !important;
  --overlay-component-bg: rgb(22, 22, 28) !important;
  --overlay-component-backdrop: none !important;
  /* ... etc */
}
```

The `.tauri-app` class is added to the document root when running in Tauri (detected via `window.__TAURI__`).

## Potential Workarounds (Not Recommended)

### Force GPU Acceleration
```bash
WEBKIT_DISABLE_COMPOSITING_MODE=0 npm run tauri dev
```
May cause instability on some systems.

### Force Wayland
```bash
GDK_BACKEND=wayland npm run tauri dev
```
Only works if system has Wayland support.

## Tauri vs Electron Trade-offs

| Aspect | Tauri | Electron |
|--------|-------|----------|
| **CSS consistency** | Platform-dependent | Consistent (Chromium) |
| **Bundle size** | ~3-10 MB | ~150-200 MB |
| **Memory usage** | ~50-100 MB | ~200-500 MB |
| **Startup time** | Fast | Slower |
| **Security** | Better (Rust) | Good |

**Decision:** We chose Tauri for its performance benefits. The CSS workaround provides acceptable visual parity.

## Related Files

- `src/assets/styles.css` - Tauri-specific CSS overrides (search for `BUG-1066`)
- `src/main.ts` - Tauri detection and `.tauri-app` class application
- `src-tauri/tauri.conf.json` - Tauri configuration

## References

- [Tauri WebView Documentation](https://tauri.app/v1/references/webview-versions/)
- [WebKitGTK CSS Support](https://webkitgtk.org/)
- [BUG-1066 in MASTER_PLAN.md](../MASTER_PLAN.md) - Original issue tracking

---

**Created:** 2026-01-25
**Related Task:** BUG-1066
