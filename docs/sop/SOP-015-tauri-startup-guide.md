# SOP-015: Tauri App Startup Guide

**Created**: 2026-01-21
**Updated**: 2026-01-21
**Status**: Active
**Related Task**: TASK-348

---

## Overview

This SOP provides reliable procedures for starting the FlowState Tauri desktop application in different scenarios.

## Quick Reference

| Scenario | Command | Notes |
|----------|---------|-------|
| **Development** | `npm run tauri dev` | Recommended for daily use |
| **Pre-built Binary** | `npm run tauri:run` | Requires recent build |
| **Fresh Build + Run** | `npm run tauri:rebuild` | Rebuilds then runs |

## Prerequisites

Before starting the Tauri app, ensure:

1. **Supabase is running** (local Docker containers)
   ```bash
   # Check Supabase status
   docker ps | grep supabase

   # Start if needed
   supabase start
   ```

2. **Port 5546 is available** (for dev mode)
   ```bash
   # Check if port is in use
   lsof -i:5546

   # Kill existing process if needed
   npm run kill
   ```

## Startup Methods

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

**Troubleshooting:**
If the binary exits silently:
1. Ensure `dist/` folder exists: `ls dist/`
2. Rebuild: `npm run tauri build`
3. Fall back to dev mode: `npm run tauri dev`

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

## Supabase Auto-Detection

The Tauri app has built-in Supabase detection (see SOP-014):

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

## Common Issues

### Issue 1: Binary Exits Immediately

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

### Issue 2: Port 5546 Already in Use

**Symptoms:** "Port 5546 is already in use" error

**Solution:**
```bash
npm run kill
# Then retry
npm run tauri dev
```

### Issue 3: Supabase Not Detected

**Symptoms:** App shows "Initializing..." indefinitely

**Solution:**
1. Check Supabase containers: `docker ps | grep supabase`
2. If not running: `supabase start`
3. Click "Try Again" in the app

### Issue 4: Shadow Mirror Backup Failing

**Symptoms:** "Invalid supabaseUrl" errors in console

**Cause:** `.env` has relative URL `/supabase` for Vite proxy

**Solution:** Fixed in TASK-348 - script now detects relative URLs and falls back to `http://127.0.0.1:54321`

## Environment Variables

| Variable | Dev Value | Production Value |
|----------|-----------|------------------|
| `VITE_SUPABASE_URL` | `/supabase` (proxy) | `http://127.0.0.1:54321` |
| `TAURI_DEV` | `true` (set by beforeDevCommand) | Not set |

## Related Documentation

- [SOP-011: Tauri Distribution](./SOP-011-tauri-distribution.md) - Building and releasing
- [SOP-014: Tauri Supabase Detection](./SOP-014-tauri-supabase-detection.md) - Auto-detection logic
- [CLAUDE.md](../../CLAUDE.md) - Project overview

---

**Maintainer**: FlowState Team
**Last Verified**: 2026-01-21
