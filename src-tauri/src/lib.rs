mod config;
mod git;
mod runner;
mod uv;

use config::{ConfigManager, Project};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{Manager, State};
use tokio::process::Command as TokioCommand;

struct AppState {
    config_manager: Mutex<ConfigManager>,
}

#[tauri::command]
fn get_projects(state: State<'_, AppState>, registry: State<'_, Arc<runner::ProcessRegistry>>) -> Result<Vec<Project>, String> {
    let manager = state.config_manager.lock().unwrap();
    let mut config = manager.read_config();
    let active = registry.active_processes.lock().unwrap();

    for p in &mut config.projects {
        if let Some(process) = active.get(&p.id) {
            p.status = "Running".to_string();
            p.port = *process.port.lock().unwrap();
        } else {
            p.status = "Stopped".to_string();
            p.port = None;
        }
    }
    
    Ok(config.projects)
}

#[tauri::command]
fn add_project(state: State<'_, AppState>, mut project: Project) -> Result<Vec<Project>, String> {
    let manager = state.config_manager.lock().unwrap();
    let mut config = manager.read_config();

    config.projects.retain(|p| p.id != project.id);
    project.status = "Stopped".to_string();
    config.projects.push(project);

    manager.write_config(&config)?;
    Ok(config.projects)
}

#[tauri::command]
fn update_project(state: State<'_, AppState>, project: Project) -> Result<Vec<Project>, String> {
    let manager = state.config_manager.lock().unwrap();
    let mut config = manager.read_config();

    if let Some(existing) = config.projects.iter_mut().find(|p| p.id == project.id) {
        existing.name = project.name;
        existing.path = project.path;
        existing.run_command = project.run_command;
        existing.git_url = project.git_url;
        existing.env = project.env;
        existing.python_path = project.python_path;
        existing.icon_color = project.icon_color;
        // status는 변경하지 않음
    } else {
        return Err("Project not found".to_string());
    }

    manager.write_config(&config)?;
    Ok(config.projects)
}

#[tauri::command]
fn delete_project(state: State<'_, AppState>, id: String) -> Result<Vec<Project>, String> {
    let manager = state.config_manager.lock().unwrap();
    let mut config = manager.read_config();

    config.projects.retain(|p| p.id != id);

    manager.write_config(&config)?;
    Ok(config.projects)
}

/// .venv 내 Python 인터프리터 버전을 감지합니다.
#[tauri::command]
async fn detect_python_version(path: String) -> Result<String, String> {
    let venv_python = if cfg!(target_os = "windows") {
        Path::new(&path).join(".venv").join("Scripts").join("python.exe")
    } else {
        Path::new(&path).join(".venv").join("bin").join("python")
    };

    let python_path = if venv_python.exists() {
        venv_python.to_string_lossy().to_string()
    } else {
        "python3".to_string()
    };

    let output = TokioCommand::new(&python_path)
        .args(["--version"])
        .output()
        .await
        .map_err(|e| format!("Failed to detect Python: {}", e))?;

    if output.status.success() {
        let version_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
        // "Python 3.11.9" → "3.11.9"
        Ok(version_str.replace("Python ", ""))
    } else {
        Err("Could not detect Python version".to_string())
    }
}

/// 프로젝트 경로에 .venv가 존재하는지 확인합니다.
#[tauri::command]
async fn check_venv_exists(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).join(".venv").exists())
}

/// .venv에 설치된 패키지 목록을 반환합니다.
#[tauri::command]
async fn list_dependencies(path: String) -> Result<Vec<serde_json::Value>, String> {
    let venv_path = Path::new(&path).join(".venv");
    if !venv_path.exists() {
        return Ok(vec![]);
    }

    let output = TokioCommand::new("uv")
        .current_dir(&path)
        .args(["pip", "list", "--format", "json"])
        .output()
        .await
        .map_err(|e| format!("Failed to list deps: {}", e))?;

    if output.status.success() {
        let json_str = String::from_utf8_lossy(&output.stdout);
        let pkgs: Vec<serde_json::Value> = serde_json::from_str(&json_str)
            .unwrap_or_default();
        Ok(pkgs)
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
async fn check_requirements_exists(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).join("requirements.txt").exists())
}

#[tauri::command]
async fn setup_project_env(path: String, python_version: String, install_reqs: bool) -> Result<(), String> {
    // 1. uv venv --python <version>
    let mut venv_cmd = TokioCommand::new("uv");
    venv_cmd.current_dir(&path).args(["venv", "--python", &python_version]);
    let output = venv_cmd.output().await.map_err(|e| format!("Failed to run uv venv: {}", e))?;
    
    if !output.status.success() {
        return Err(format!("uv venv failed: {}", String::from_utf8_lossy(&output.stderr)));
    }

    // 2. uv pip install -r requirements.txt (if true)
    if install_reqs {
        let mut pip_cmd = TokioCommand::new("uv");
        pip_cmd.current_dir(&path).args(["pip", "install", "-r", "requirements.txt"]);
        let pip_out = pip_cmd.output().await.map_err(|e| format!("Failed to run uv pip install: {}", e))?;
        if !pip_out.status.success() {
            return Err(format!("uv pip install failed: {}", String::from_utf8_lossy(&pip_out.stderr)));
        }
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let process_registry = Arc::new(runner::ProcessRegistry::default());
    // 앱 종료 이벤트 핸들러에서 사용할 레지스트리 핸들 (setup으로 move되기 전에 복제)
    let registry_for_exit = Arc::clone(&process_registry);

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            let config_manager = ConfigManager::new(app.handle());
            app.manage(AppState {
                config_manager: Mutex::new(config_manager),
            });

            // 이전 세션이 SIGKILL 등으로 강제 종료되어 남은 고아 서버를 정리하고,
            // 이번 세션의 실행 중 PID를 보존할 파일 경로를 레지스트리에 설정합니다.
            let pid_file: PathBuf = app
                .handle()
                .path()
                .app_config_dir()
                .unwrap_or_else(|_| PathBuf::from("."))
                .join("uvws_running_pids.json");
            runner::cleanup_orphans(&pid_file);
            *process_registry.pid_file.lock().unwrap() = Some(pid_file);

            app.manage(process_registry);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_projects,
            add_project,
            update_project,
            delete_project,
            detect_python_version,
            check_venv_exists,
            list_dependencies,
            check_requirements_exists,
            setup_project_env,
            runner::start_project,
            runner::stop_project,
            runner::sync_project_dependencies,
            runner::get_process_logs,
            runner::kill_port,
            git::git_status,
            git::git_log,
            git::git_fetch,
            git::git_pull,
            git::git_push
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    // 앱이 종료될 때(Cmd+Q, 창 닫기, 메뉴 종료 등) 실행 중인 모든 서버를 함께 정리합니다.
    app.run(move |_app_handle, event| {
        if let tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit = event {
            runner::kill_all_processes(&registry_for_exit);
        }
    });
}
