# SOP-017: Tauri Working Directory Constraint

**Created**: 2026-01-22
**Status**: Active
**Related Task**: TASK-356

---

## Problem Statement

Tauri desktop apps run from arbitrary working directories (`/usr/bin/`, `~/`, etc.), NOT the project directory. Any Rust command that depends on project-relative files will fail at runtime.

## Root Cause

When users install FlowState via `.deb`, `.AppImage`, or system package:
- Binary is placed at `/usr/bin/flow-state` or similar
- User launches from desktop shortcut or terminal
- Working directory is user's home or `/`
- No access to `supabase/migrations/`, `package.json`, etc.

## Affected Operations

| Operation | Why It Fails |
|-----------|--------------|
| `supabase db push` | Needs `supabase/migrations/` directory |
| `supabase migration` | Needs migration files |
| `supabase db reset` | Needs project config |
| `npm run X` | Needs `package.json` |
| Reading relative paths | Files don't exist from `/usr/bin/` |

## Solution Pattern

### Before (Broken)
```rust
// ❌ FAILS - Requires project directory
#[tauri::command]
async fn run_migrations(app: tauri::AppHandle) -> Result<String, String> {
    app.shell()
        .command("supabase")
        .args(["db", "push", "--local"])
        .output()
        .await
}
```

### After (Fixed)
```rust
// ✅ WORKS - Uses REST API, directory-independent
#[tauri::command]
async fn verify_database(app: tauri::AppHandle) -> Result<String, String> {
    let health_check = app
        .shell()
        .command("curl")
        .args([
            "-s", "-o", "/dev/null", "-w", "%{http_code}",
            "http://127.0.0.1:54321/rest/v1/tasks?limit=1",
            "-H", "apikey: <anon-key>",
            "--max-time", "5"
        ])
        .output()
        .await;

    match health_check {
        Ok(output) => {
            let status = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if status == "200" || status == "406" || status == "401" {
                Ok("database_ready".to_string())
            } else {
                Err(format!("Database not ready (status {})", status))
            }
        }
        Err(e) => Err(format!("Health check failed: {}", e))
    }
}
```

## Architectural Rules

### Rule 1: Separate Setup from Runtime
| Phase | Who Does It | What Happens |
|-------|-------------|--------------|
| **Setup** | Developer | Runs `supabase db push`, creates schema |
| **Runtime** | App | Only verifies database is ready |

### Rule 2: Use Absolute Paths or APIs
```rust
// ❌ Relative paths fail
let config = std::fs::read_to_string("config.json");

// ✅ Use app data directory
let app_dir = app.path().app_data_dir()?;
let config = std::fs::read_to_string(app_dir.join("config.json"));

// ✅ Or use REST APIs
let response = reqwest::get("http://127.0.0.1:54321/rest/v1/").await?;
```

### Rule 3: Embed Required Resources
If you need files at runtime, embed them in the binary:
```rust
// In build.rs or using include_str!
const SCHEMA_SQL: &str = include_str!("../resources/schema.sql");
```

## Checklist for New Tauri Commands

Before adding a new `#[tauri::command]`:

- [ ] Does it run shell commands? → Check if they need project files
- [ ] Does it read files? → Use absolute paths or embed resources
- [ ] Does it use Supabase CLI? → Replace with REST API calls
- [ ] Test from `/tmp/` directory to verify it works

## Testing

```bash
# Simulate installed app environment
cd /tmp
/path/to/target/release/flow-state

# Should work without errors
```

## Related Files

| File | Purpose |
|------|---------|
| `src-tauri/src/lib.rs` | All Tauri commands |
| `src/composables/useTauriStartup.ts` | Frontend startup sequence |
| `docs/sop/SOP-011-tauri-distribution.md` | Full Tauri distribution SOP |

## Error Messages

If you see these errors, this SOP applies:

```
Remote migration versions not found in local migrations directory
```
```
Cannot find supabase/config.toml
```
```
ENOENT: no such file or directory
```

## Summary

**Golden Rule**: Tauri runtime commands must work from ANY working directory. Use APIs and absolute paths, never project-relative operations.
