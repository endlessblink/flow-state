# SOP-014: Tauri Supabase Detection Fix

## Problem Summary

The Tauri desktop app showed "Port conflict detected" error even when Supabase was already running. This happened because:

1. **Directory-dependent CLI**: `supabase status` only works from the project directory
2. **Incorrect detection**: When run from a different directory, the command fails
3. **False negative**: App thinks Supabase isn't running and tries to start it
4. **Port conflict**: Starting fails because ports 54321-54329 are already in use

## Root Cause

```
┌─────────────────────────────────────────────────────────────────┐
│ Tauri App (launched from /usr/bin or Desktop)                   │
│                                                                  │
│  check_supabase_status()                                         │
│        │                                                         │
│        ▼                                                         │
│  supabase status -o json                                         │
│        │                                                         │
│        ▼                                                         │
│  ❌ FAILS: "Cannot find config.toml"                            │
│  (not in project directory)                                      │
│        │                                                         │
│        ▼                                                         │
│  Returns: "not_running"                                          │
│        │                                                         │
│        ▼                                                         │
│  Tries to start Supabase                                         │
│        │                                                         │
│        ▼                                                         │
│  ❌ FAILS: "Port 54321 already in use"                          │
└─────────────────────────────────────────────────────────────────┘
```

## Solution: Direct Health Check

Instead of relying on `supabase status`, use a direct HTTP health check:

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

Same change applied to `start_supabase()` function.

## Flow After Fix

```
┌─────────────────────────────────────────────────────────────────┐
│ Tauri App (launched from anywhere)                               │
│                                                                  │
│  check_supabase_status()                                         │
│        │                                                         │
│        ▼                                                         │
│  curl http://127.0.0.1:54321/rest/v1/                           │
│        │                                                         │
│        ▼                                                         │
│  ✅ HTTP 200: Supabase is responding                            │
│        │                                                         │
│        ▼                                                         │
│  Returns: "running:{}"                                           │
│        │                                                         │
│        ▼                                                         │
│  ✅ App proceeds normally (no port conflict)                    │
└─────────────────────────────────────────────────────────────────┘
```

## Files Modified

| File | Change |
|------|--------|
| `src-tauri/src/lib.rs` | Added direct health check to `check_supabase_status()` and `start_supabase()` |

## Rebuild Required

After modifying Rust code, rebuild the Tauri app:

```bash
npm run tauri build
```

Output location: `src-tauri/target/release/flow-state`

## Startup Script

Created `start-flowstate.sh` for convenience:

```bash
#!/bin/bash
# Check if Supabase is running
if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:54321/rest/v1/ | grep -q "200"; then
    echo "✅ Supabase already running"
else
    echo "⏳ Starting Supabase..."
    cd /path/to/flow-state
    supabase start
fi

# Start the Tauri app
/path/to/flow-state/src-tauri/target/release/flow-state &
```

## Verification

1. Start Supabase manually: `supabase start`
2. Launch Tauri app from any directory
3. App should detect running Supabase and proceed without errors

## Key Insight

**Health checks are more reliable than CLI status commands** because:
- They work regardless of working directory
- They directly verify the service is responding
- They're faster (no CLI parsing overhead)

## Related

- **SOP-013**: Cloudflare Tunnel with Local Supabase
- **useTauriStartup.ts**: Frontend startup composable

---
**Created**: 2026-01-21
**Author**: Claude Code
**Status**: Active
