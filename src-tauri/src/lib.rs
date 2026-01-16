use tauri::Manager;
use tauri_plugin_shell::ShellExt;

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
#[tauri::command]
async fn check_supabase_status(app: tauri::AppHandle) -> Result<String, String> {
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
    // First check if already running to avoid port conflicts
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

/// Run Supabase database migrations
#[tauri::command]
async fn run_supabase_migrations(app: tauri::AppHandle) -> Result<String, String> {
    let output = app
        .shell()
        .command("supabase")
        .args(["db", "push"])
        .output()
        .await
        .map_err(|e| format!("Failed to run migrations: {}", e))?;

    if output.status.success() {
        Ok("migrations_complete".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        // Check if it's just "no migrations to apply"
        if stderr.contains("No migrations") || stderr.contains("already applied") {
            Ok("no_migrations_needed".to_string())
        } else {
            Err(format!("Migration failed: {}", stderr))
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
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
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
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
