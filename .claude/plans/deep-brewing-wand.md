# BUG-341: Tauri App Freezing - Add Comprehensive Logging

## Problem
The Tauri desktop app freezes/crashes but we have no diagnostic information to debug the issue. Current logging is debug-only and doesn't write to files.

## Research Findings

### Known Tauri 2.x Issues
1. **WebView2 hang (Windows)**: Tauri 2.6+ has a known issue where `CreateCoreWebView2ControllerWithOptions()` never returns on some Windows configurations
2. **DevTools auto-open**: May cause startup delays (currently enabled in our code)
3. **Log file growth**: Some users report massive log files (40GB+) when logging is misconfigured

### Current State (`src-tauri/src/lib.rs`)
- Logging only enabled in debug builds (`cfg!(debug_assertions)`)
- No panic hook for crash diagnostics
- No log rotation configured
- DevTools auto-opens on startup (line 295-298)

## Solution: 5-Layer Diagnostic System

### Layer 1: Comprehensive File Logging (Rust)
- Log to file in ALL builds (not just debug)
- Use `LogDir` target for proper OS-specific log location
- Add rotation strategy to prevent disk space issues
- Include timestamps and module paths

### Layer 2: Panic Hook for Crashes
- Capture Rust panics before app terminates
- Write panic info to dedicated crash log file
- Include file/line/column information

### Layer 3: Frontend Error Logging (JavaScript)
- Capture unhandled promise rejections
- Capture JS errors via window.onerror
- Forward console.error to log file

### Layer 4: Startup Timing Diagnostics
- Log timestamps at each initialization phase
- Track which plugin/setup phase completes
- Help identify where freezing occurs

### Layer 5: Log Retrieval Documentation
- Document log file locations per OS
- Provide scripts to collect diagnostic info

---

## Files to Modify

### 1. `src-tauri/src/lib.rs`
- Enable logging in ALL builds (remove debug-only check)
- Add file rotation strategy
- Add panic hook
- Add startup timing logs
- Make DevTools optional (don't auto-open)

### 2. `src-tauri/Cargo.toml`
- Already has `tauri-plugin-log = "2"` (no change needed)

### 3. `src/main.ts` or `src/App.vue`
- Add frontend error handlers
- Forward console to Tauri logger

### 4. `docs/sop/TAURI-DEBUGGING.md` (new)
- Document log locations
- Provide troubleshooting steps

---

## Implementation Details

### lib.rs Changes

```rust
use std::panic;
use tauri::Manager;
use tauri_plugin_log::{Target, TargetKind, RotationStrategy};
use log::LevelFilter;

pub fn run() {
    // Set panic hook BEFORE anything else
    panic::set_hook(Box::new(|info| {
        let location = info.location()
            .map(|loc| format!("{}:{}:{}", loc.file(), loc.line(), loc.column()))
            .unwrap_or_else(|| "unknown".to_string());
        let message = info.payload()
            .downcast_ref::<&str>()
            .map(|s| s.to_string())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "Unknown panic".to_string());

        // Write to stderr (will show in terminal)
        eprintln!("PANIC at {}: {}", location, message);

        // Also try to write to crash log file
        if let Some(dirs) = directories::ProjectDirs::from("com", "flowstate", "FlowState") {
            let crash_file = dirs.data_dir().join("crash.log");
            let _ = std::fs::write(&crash_file, format!(
                "CRASH at {}\nTime: {}\nLocation: {}\nMessage: {}\n",
                chrono::Utc::now(),
                chrono::Local::now(),
                location,
                message
            ));
        }
    }));

    log::info!("=== FlowState starting ===");
    log::info!("Version: {}", env!("CARGO_PKG_VERSION"));

    tauri::Builder::default()
        // Enable logging in ALL builds
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir { file_name: Some("flowstate".into()) }),
                    Target::new(TargetKind::Webview),
                ])
                .rotation_strategy(RotationStrategy::KeepOne)
                .max_file_size(5_000_000) // 5MB max
                .level(LevelFilter::Info)
                .level_for("tauri", LevelFilter::Debug)
                .level_for("flow_state", LevelFilter::Debug)
                .build(),
        )
        // ... other plugins
        .setup(|app| {
            log::info!("Setup phase starting");

            // DevTools: Only open if env var set or debug build
            if std::env::var("FLOWSTATE_DEVTOOLS").is_ok() || cfg!(debug_assertions) {
                if let Some(window) = app.get_webview_window("main") {
                    log::info!("Opening DevTools");
                    window.open_devtools();
                }
            }

            log::info!("Setup phase complete");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Frontend Error Logging (`src/main.ts`)

```typescript
// Add at top of main.ts after imports
import { error as logError, warn as logWarn, info as logInfo } from '@tauri-apps/plugin-log';

// Global error handlers
window.addEventListener('error', (event) => {
  logError(`JS Error: ${event.message} at ${event.filename}:${event.lineno}`);
});

window.addEventListener('unhandledrejection', (event) => {
  logError(`Unhandled Promise Rejection: ${event.reason}`);
});

// Forward console.error to log file
const originalError = console.error;
console.error = (...args) => {
  originalError.apply(console, args);
  logError(args.map(a => String(a)).join(' '));
};
```

---

## Log File Locations

| OS | Location |
|----|----------|
| Linux | `~/.local/share/com.flowstate.app/logs/flowstate.log` |
| macOS | `~/Library/Application Support/com.flowstate.app/logs/flowstate.log` |
| Windows | `%APPDATA%\com.flowstate.app\logs\flowstate.log` |

Crash logs: Same directory, `crash.log`

---

## Verification

1. Build Tauri app: `npm run tauri build`
2. Run the app
3. Check log file exists at expected location
4. Verify logs contain startup messages
5. Test crash logging: Trigger a panic (dev only)
6. Check that DevTools doesn't auto-open in release

---

## Dependencies to Add

`src-tauri/Cargo.toml`:
```toml
directories = "5"
chrono = "0.4"
```

---

## Sources
- [Tauri Debug Guide](https://v2.tauri.app/develop/debug/)
- [Tauri Logging Plugin](https://v2.tauri.app/plugin/logging/)
- [Catching Panics in Tauri](https://aptabase.com/blog/catching-panics-on-tauri-apps)
- [Tauri 2.6+ Hang Issue](https://github.com/tauri-apps/tauri/issues/14614)
