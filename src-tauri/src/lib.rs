use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use std::process;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

const DEFAULT_BACKUP_INTERVAL_MINUTES: u32 = 30;
const DEFAULT_SQL_KEEP_BACKUPS: u32 = 10;
const DEFAULT_SHADOW_DB_BACKUP_EVERY: u32 = 12;
const DEFAULT_SHADOW_DB_KEEP_BACKUPS: u32 = 5;
const DEFAULT_SHADOW_DB_BACKUP_MIN_INTERVAL_MINUTES: u32 = 360;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalBackupPolicy {
    interval_minutes: u32,
    sql_keep_backups: u32,
    shadow_db_backup_every: u32,
    shadow_db_keep_backups: u32,
    shadow_db_backup_min_interval_minutes: u32,
    env_local_path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LocalBackupPolicyInput {
    interval_minutes: u32,
    sql_keep_backups: u32,
    shadow_db_backup_every: u32,
    shadow_db_keep_backups: u32,
    shadow_db_backup_min_interval_minutes: u32,
}

fn parse_positive_env(content: &str, key: &str, fallback: u32) -> u32 {
    content
        .lines()
        .find_map(|line| {
            let trimmed = line.trim();
            if trimmed.starts_with('#') || !trimmed.starts_with(&format!("{key}=")) {
                return None;
            }
            trimmed
                .split_once('=')
                .and_then(|(_, value)| value.trim().parse::<u32>().ok())
        })
        .filter(|value| *value > 0)
        .unwrap_or(fallback)
}

fn find_flow_state_project_root() -> Result<PathBuf, String> {
    let mut candidates = Vec::new();

    if let Ok(current_dir) = std::env::current_dir() {
        candidates.push(current_dir);
    }

    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            candidates.push(parent.to_path_buf());
        }
    }

    for candidate in candidates {
        for dir in candidate.ancestors() {
            let package_json = dir.join("package.json");
            let backup_script = dir.join("scripts/auto-backup-daemon.cjs");
            if package_json.exists() && backup_script.exists() {
                return Ok(dir.to_path_buf());
            }
        }
    }

    Err("Could not locate the FlowState project root. This control is intended for local dev/Tauri runs inside the repo.".to_string())
}

fn load_local_backup_policy() -> Result<LocalBackupPolicy, String> {
    let project_root = find_flow_state_project_root()?;
    let env_local_path = project_root.join(".env.local");
    let content = std::fs::read_to_string(&env_local_path).unwrap_or_default();

    Ok(LocalBackupPolicy {
        interval_minutes: parse_positive_env(&content, "FLOW_STATE_BACKUP_INTERVAL_MINUTES", DEFAULT_BACKUP_INTERVAL_MINUTES),
        sql_keep_backups: parse_positive_env(&content, "FLOW_STATE_SQL_KEEP_BACKUPS", DEFAULT_SQL_KEEP_BACKUPS),
        shadow_db_backup_every: parse_positive_env(&content, "FLOW_STATE_SHADOW_DB_BACKUP_EVERY", DEFAULT_SHADOW_DB_BACKUP_EVERY),
        shadow_db_keep_backups: parse_positive_env(&content, "FLOW_STATE_SHADOW_DB_KEEP_BACKUPS", DEFAULT_SHADOW_DB_KEEP_BACKUPS),
        shadow_db_backup_min_interval_minutes: parse_positive_env(&content, "FLOW_STATE_SHADOW_DB_BACKUP_MIN_INTERVAL_MINUTES", DEFAULT_SHADOW_DB_BACKUP_MIN_INTERVAL_MINUTES),
        env_local_path: env_local_path.display().to_string(),
    })
}

fn upsert_env_line(lines: &mut Vec<String>, key: &str, value: u32) {
    let new_line = format!("{key}={value}");
    if let Some(index) = lines.iter().position(|line| line.trim_start().starts_with(&format!("{key}="))) {
        lines[index] = new_line;
    } else {
        lines.push(new_line);
    }
}

#[tauri::command]
fn get_local_backup_policy() -> Result<LocalBackupPolicy, String> {
    load_local_backup_policy()
}

#[tauri::command]
fn set_local_backup_policy(policy: LocalBackupPolicyInput) -> Result<LocalBackupPolicy, String> {
    let project_root = find_flow_state_project_root()?;
    let env_local_path = project_root.join(".env.local");
    let existing = std::fs::read_to_string(&env_local_path).unwrap_or_default();
    let mut lines = if existing.is_empty() {
        Vec::new()
    } else {
        existing.lines().map(|line| line.to_string()).collect::<Vec<_>>()
    };

    if !lines.is_empty() && !lines.last().is_some_and(|line| line.is_empty()) {
        lines.push(String::new());
    }

    if !existing.contains("FLOW_STATE_BACKUP_INTERVAL_MINUTES=") {
        lines.push("# Local backup policy".to_string());
    }

    upsert_env_line(&mut lines, "FLOW_STATE_BACKUP_INTERVAL_MINUTES", policy.interval_minutes);
    upsert_env_line(&mut lines, "FLOW_STATE_SQL_KEEP_BACKUPS", policy.sql_keep_backups);
    upsert_env_line(&mut lines, "FLOW_STATE_SHADOW_DB_BACKUP_EVERY", policy.shadow_db_backup_every);
    upsert_env_line(&mut lines, "FLOW_STATE_SHADOW_DB_KEEP_BACKUPS", policy.shadow_db_keep_backups);
    upsert_env_line(&mut lines, "FLOW_STATE_SHADOW_DB_BACKUP_MIN_INTERVAL_MINUTES", policy.shadow_db_backup_min_interval_minutes);

    let output = lines.join("\n");
    std::fs::write(&env_local_path, format!("{output}\n"))
        .map_err(|e| format!("Failed to write {}: {}", env_local_path.display(), e))?;

    load_local_backup_policy()
}

/// Get current process memory usage (for SIGTERM debugging - TASK-1060)
#[tauri::command]
fn get_memory_usage() -> Result<String, String> {
    let pid = process::id();

    // Read from /proc/self/status on Linux
    #[cfg(target_os = "linux")]
    {
        if let Ok(status) = std::fs::read_to_string("/proc/self/status") {
            let mut vm_rss = "unknown".to_string();
            let mut vm_size = "unknown".to_string();

            for line in status.lines() {
                if line.starts_with("VmRSS:") {
                    vm_rss = line.replace("VmRSS:", "").trim().to_string();
                } else if line.starts_with("VmSize:") {
                    vm_size = line.replace("VmSize:", "").trim().to_string();
                }
            }

            return Ok(format!(
                r#"{{"pid":{},"rss":"{}","virtual":"{}","platform":"linux"}}"#,
                pid, vm_rss, vm_size
            ));
        }
    }

    // Fallback for other platforms
    Ok(format!(
        r#"{{"pid":{},"rss":"unknown","virtual":"unknown","platform":"other"}}"#,
        pid
    ))
}

/// Check if Docker daemon is running
#[tauri::command]
async fn check_docker_status(app: tauri::AppHandle) -> Result<String, String> {
    let output = app
        .shell()
        .command("docker")
        .args(["info", "--format", "{{.ServerVersion}}"])
        .output()
        .await
        .map_err(|e| format!("Failed to run docker: {}", e))?;

    if output.status.success() {
        let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(format!("running:{}", version))
    } else {
        Ok("not_running".to_string())
    }
}

/// Start Docker Desktop (cross-platform)
#[tauri::command]
async fn start_docker_desktop(app: tauri::AppHandle) -> Result<String, String> {
    // Try the Docker Desktop CLI first (v4.37+)
    let output = app
        .shell()
        .command("docker")
        .args(["desktop", "start"])
        .output()
        .await;

    match output {
        Ok(o) if o.status.success() => Ok("started".to_string()),
        _ => {
            // Fallback to platform-specific methods
            #[cfg(target_os = "macos")]
            {
                let result = app
                    .shell()
                    .command("open")
                    .args(["-a", "Docker", "--background"])
                    .output()
                    .await
                    .map_err(|e| format!("Failed to start Docker: {}", e))?;

                if result.status.success() {
                    Ok("started".to_string())
                } else {
                    Err("Failed to start Docker Desktop".to_string())
                }
            }
            #[cfg(target_os = "windows")]
            {
                let result = app
                    .shell()
                    .command("cmd")
                    .args(["/c", "start", "", "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"])
                    .output()
                    .await
                    .map_err(|e| format!("Failed to start Docker: {}", e))?;

                if result.status.success() {
                    Ok("started".to_string())
                } else {
                    Err("Failed to start Docker Desktop".to_string())
                }
            }
            #[cfg(target_os = "linux")]
            {
                let result = app
                    .shell()
                    .command("systemctl")
                    .args(["--user", "start", "docker-desktop"])
                    .output()
                    .await
                    .map_err(|e| format!("Failed to start Docker: {}", e))?;

                if result.status.success() {
                    Ok("started".to_string())
                } else {
                    Err("Failed to start Docker Desktop".to_string())
                }
            }
        }
    }
}

/// Check if Supabase local is running
/// Uses direct API health check (more reliable than CLI which requires project directory)
#[tauri::command]
async fn check_supabase_status(app: tauri::AppHandle) -> Result<String, String> {
    // First try direct health check - works regardless of working directory
    let health_check = app
        .shell()
        .command("curl")
        .args(["-s", "-o", "/dev/null", "-w", "%{http_code}", "http://127.0.0.1:54321/rest/v1/", "--max-time", "2"])
        .output()
        .await;

    if let Ok(output) = health_check {
        let status_code = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if status_code == "200" {
            // Supabase is responding, try to get full config
            let config = app
                .shell()
                .command("supabase")
                .args(["status", "-o", "json"])
                .output()
                .await;

            if let Ok(c) = config {
                if c.status.success() {
                    let stdout = String::from_utf8_lossy(&c.stdout).to_string();
                    return Ok(format!("running:{}", stdout));
                }
            }
            // API is up but can't get config (wrong directory) - still running
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

/// Start Supabase local development stack
#[tauri::command]
async fn start_supabase(app: tauri::AppHandle) -> Result<String, String> {
    // First check if already running via direct health check (more reliable)
    let health_check = app
        .shell()
        .command("curl")
        .args(["-s", "-o", "/dev/null", "-w", "%{http_code}", "http://127.0.0.1:54321/rest/v1/", "--max-time", "2"])
        .output()
        .await;

    if let Ok(output) = health_check {
        let status_code = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if status_code == "200" {
            // Already running - don't try to start again
            return Ok("already_running".to_string());
        }
    }

    // Fallback check via CLI
    let status = app
        .shell()
        .command("supabase")
        .args(["status", "-o", "json"])
        .output()
        .await;

    if let Ok(s) = status {
        if s.status.success() {
            return Ok("already_running".to_string());
        }
    }

    // Start Supabase
    let output = app
        .shell()
        .command("supabase")
        .args(["start"])
        .output()
        .await
        .map_err(|e| format!("Failed to start supabase: {}", e))?;

    if output.status.success() {
        Ok("started".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Failed to start Supabase: {}", stderr))
    }
}

/// Stop Supabase local development stack
#[tauri::command]
async fn stop_supabase(app: tauri::AppHandle) -> Result<String, String> {
    let output = app
        .shell()
        .command("supabase")
        .args(["stop"])
        .output()
        .await
        .map_err(|e| format!("Failed to stop supabase: {}", e))?;

    if output.status.success() {
        Ok("stopped".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Failed to stop Supabase: {}", stderr))
    }
}

/// Get Supabase connection details (API URL, keys, etc.)
#[tauri::command]
async fn get_supabase_config(app: tauri::AppHandle) -> Result<String, String> {
    let output = app
        .shell()
        .command("supabase")
        .args(["status", "-o", "json"])
        .output()
        .await
        .map_err(|e| format!("Failed to get supabase config: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err("Supabase is not running".to_string())
    }
}

/// Check if a remote Supabase project is linked
fn is_remote_project_linked() -> bool {
    // Supabase CLI creates .supabase/project-ref when linked to a remote project
    let project_ref_path = std::path::Path::new(".supabase/project-ref");
    if project_ref_path.exists() {
        // Verify the file has content (not empty)
        if let Ok(content) = std::fs::read_to_string(project_ref_path) {
            return !content.trim().is_empty();
        }
    }
    false
}

/// Verify database schema is ready (check if required tables exist)
/// This is preferred over running migrations, which should be done during setup
#[tauri::command]
async fn run_supabase_migrations(app: tauri::AppHandle) -> Result<String, String> {
    // Instead of pushing migrations (which requires project directory),
    // verify the database has the required tables by checking the REST API
    let health_check = app
        .shell()
        .command("curl")
        .args([
            "-s", "-o", "/dev/null", "-w", "%{http_code}",
            "http://127.0.0.1:54321/rest/v1/tasks?limit=1",
            "-H", "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODMzMzkxMjR9.quujL-cYcPusBhirDQFq9p-iTN0hRwjY2GLx6XUtYDg",
            "--max-time", "5"
        ])
        .output()
        .await;

    match health_check {
        Ok(output) => {
            let status_code = String::from_utf8_lossy(&output.stdout).trim().to_string();
            // 200 = table exists with data, 406 = table exists but empty, 401 = auth issue but table exists
            if status_code == "200" || status_code == "406" || status_code == "401" {
                log::info!("Database schema verified (status: {})", status_code);
                Ok("migrations_complete".to_string())
            } else {
                log::warn!("Database check returned status: {}", status_code);
                // Table might not exist - provide helpful error
                Err(format!(
                    "Database schema not ready (status {}). Please run 'supabase db push --local' from the FlowState project directory to set up the database.",
                    status_code
                ))
            }
        }
        Err(e) => {
            log::error!("Failed to verify database: {}", e);
            Err(format!("Failed to verify database: {}", e))
        }
    }
}

/// Check if Docker CLI is installed
#[tauri::command]
async fn check_docker_installed(app: tauri::AppHandle) -> Result<String, String> {
    let output = app
        .shell()
        .command("docker")
        .args(["--version"])
        .output()
        .await;

    match output {
        Ok(o) if o.status.success() => {
            let version = String::from_utf8_lossy(&o.stdout).trim().to_string();
            Ok(format!("installed:{}", version))
        }
        _ => Ok("not_installed".to_string()),
    }
}

/// Check if Supabase CLI is installed
#[tauri::command]
async fn check_supabase_installed(app: tauri::AppHandle) -> Result<String, String> {
    let output = app
        .shell()
        .command("supabase")
        .args(["--version"])
        .output()
        .await;

    match output {
        Ok(o) if o.status.success() => {
            let version = String::from_utf8_lossy(&o.stdout).trim().to_string();
            Ok(format!("installed:{}", version))
        }
        _ => Ok("not_installed".to_string()),
    }
}

/// Cleanup services on app exit
#[tauri::command]
async fn cleanup_services(app: tauri::AppHandle, stop_supabase_flag: bool) -> Result<String, String> {
    if stop_supabase_flag {
        let _ = app
            .shell()
            .command("supabase")
            .args(["stop"])
            .output()
            .await;
    }
    Ok("cleanup_complete".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir { file_name: None }),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                ])
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        // BUG-1289: tauri-plugin-notification DISABLED — Notification::show()
        // calls block_on() inside tokio runtime on Linux, causing fatal panic.
        // Using Browser Notification API from JS instead (works in Tauri webview).
        // .plugin(tauri_plugin_notification::init())
        // FEATURE-1194: tauri-plugin-updater 2.10 plugin Builder has no event hooks
        // (on_before_exit is on UpdaterBuilder, not the plugin Builder).
        // Updater diagnostics are logged at startup in setup() below instead.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        // FEATURE-1202: OAuth localhost redirect server for Google sign-in in desktop app
        .plugin(tauri_plugin_oauth::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Focus the main window when a second instance is launched
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            check_docker_status,
            check_docker_installed,
            start_docker_desktop,
            check_supabase_status,
            check_supabase_installed,
            start_supabase,
            stop_supabase,
            get_supabase_config,
            run_supabase_migrations,
            cleanup_services,
            get_memory_usage,
            get_local_backup_policy,
            set_local_backup_policy,
        ])
        .setup(|app| {
            // Note: tauri_plugin_log is registered early in the builder chain above
            // with Stdout + LogDir + Webview targets at Info level.

            // FEATURE-1194: Log $APPIMAGE path for updater diagnostics
            // The Tauri updater replaces the file at $APPIMAGE during updates.
            // If $APPIMAGE is unset, the updater cannot locate the binary to replace.
            // Note: eprintln! used alongside log! because the log plugin is only
            // registered in debug builds, but we need this output in release too.
            match std::env::var("APPIMAGE") {
                Ok(path) => {
                    eprintln!("[updater-diag] $APPIMAGE = {}", path);
                    log::info!("[updater-diag] $APPIMAGE = {}", path);
                    if std::path::Path::new(&path).exists() {
                        eprintln!("[updater-diag] $APPIMAGE path exists on disk");
                        log::info!("[updater-diag] $APPIMAGE path exists on disk");
                    } else {
                        eprintln!("[updater-diag] WARNING: $APPIMAGE path does NOT exist: {}", path);
                        log::warn!("[updater-diag] $APPIMAGE path does NOT exist on disk: {}", path);
                    }
                }
                Err(_) => {
                    eprintln!("[updater-diag] WARNING: $APPIMAGE is NOT set - updater will fail to replace binary");
                    eprintln!("[updater-diag] This may be a .deb install instead of AppImage");
                    log::warn!("[updater-diag] $APPIMAGE is NOT set - updater will fail to replace binary");
                }
            }

            // Also log the current executable path for reference
            match std::env::current_exe() {
                Ok(exe) => {
                    eprintln!("[updater-diag] current_exe = {}", exe.display());
                    log::info!("[updater-diag] current_exe = {}", exe.display());
                }
                Err(e) => {
                    eprintln!("[updater-diag] Failed to get current_exe: {}", e);
                    log::warn!("[updater-diag] Failed to get current_exe: {}", e);
                }
            }

            // DevTools: Right-click → Inspect works in dev builds only
            // BUG-1115: devtools feature moved to conditional (tauri.conf.json "features")
            // Release builds have no devtools overhead

            Ok(())
        })
        .run(tauri::generate_context!())
        // TASK-1060: Replace panic-inducing .expect() with graceful error handling
        .unwrap_or_else(|e| {
            eprintln!("CRITICAL: Tauri application failed to start: {}", e);
            eprintln!("Possible causes:");
            eprintln!("  - Display server unavailable (X11/Wayland on Linux)");
            eprintln!("  - WebKitGTK initialization failure");
            eprintln!("  - Resource exhaustion (memory, file descriptors)");
            eprintln!("  - Permission issues with app capabilities");
            std::process::exit(1);
        });
}
