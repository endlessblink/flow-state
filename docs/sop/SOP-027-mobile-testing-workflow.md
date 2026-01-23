# SOP-027: Mobile Testing Workflow for Claude Code

**Created**: 2026-01-23
**Status**: Active
**Related Task**: TASK-1003

## Overview

This SOP documents how Claude Code tests the FlowState mobile PWA using Playwright viewport resize against the production site.

## Architecture

```
Claude Code (Playwright)
    ↓
browser_resize(390, 844)  ← Mobile viewport
    ↓
https://in-theflow.com    ← Production PWA
    ↓
api.in-theflow.com        ← VPS Supabase
```

## Testing Workflow

### 1. Set Mobile Viewport

```
Use: mcp__playwright__browser_resize
Width: 390
Height: 844
```

Common viewport sizes:
| Device | Width | Height |
|--------|-------|--------|
| iPhone 14 Pro | 390 | 844 |
| iPhone SE | 375 | 667 |
| Pixel 7 | 412 | 915 |
| Samsung Galaxy | 360 | 800 |

### 2. Navigate to PWA

```
Use: mcp__playwright__browser_navigate
URL: https://in-theflow.com
```

### 3. Interact with Mobile UI

Use standard Playwright tools:
- `browser_snapshot` - Get current page state
- `browser_click` - Tap elements
- `browser_type` - Enter text
- `browser_console_messages` - Check for errors

### 4. Test Authentication

If not logged in:
1. Click "Sign In" button
2. Fill email/password
3. Submit form

## Mobile UI Elements

The mobile PWA has different navigation than desktop:

| Element | Location | Purpose |
|---------|----------|---------|
| Bottom Nav | Fixed bottom | Inbox, Timer, Today, Menu |
| Add Task | Bottom input | Quick task creation |
| Filter Tabs | Top of list | All, Active, Planned, Done |

## Troubleshooting

### "JWT issued at future" Error

**Cause**: Stale/corrupted token in browser storage

**Fix**: Clear localStorage
```javascript
// Run in browser console or via browser_evaluate
localStorage.clear();
location.reload();
```

Then log in again.

### "Failed to fetch" / CORS Errors

**Cause**: Missing CORS headers on VPS

**Fix**: Check Caddy config at `/etc/caddy/Caddyfile`
- Ensure OPTIONS preflight returns proper headers
- See SOP-026 for full Caddy configuration

### No Data Showing

**Cause**: Not authenticated or wrong Supabase endpoint

**Check**:
1. Console for auth errors
2. Network tab for failed requests
3. LocalStorage for `sb-*` keys (Supabase session)

## Limitations

Playwright viewport testing does NOT cover:
- Real touch gestures (swipe, pinch)
- PWA install flow
- Push notifications
- Device-specific browser quirks (Safari iOS, Chrome Android)
- Real device performance

For these, test manually on actual device at https://in-theflow.com

## Example Test Session

```
1. browser_resize(390, 844)
2. browser_navigate("https://in-theflow.com")
3. browser_snapshot()  ← Check page state
4. browser_click(ref="sign-in-button")
5. browser_fill_form([email, password])
6. browser_click(ref="submit")
7. browser_console_messages(level="error")  ← Check for errors
8. browser_snapshot()  ← Verify logged in
```

## Related Documentation

- [SOP-026: Custom Domain Deployment](./SOP-026-custom-domain-deployment.md)
- [CLAUDE.md](../../CLAUDE.md) - Project guidelines
