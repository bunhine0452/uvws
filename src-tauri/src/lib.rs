mod config;
mod git;
mod runner;
mod tunnel;
mod uv;

use config::{ConfigManager, Project};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::process::Command as TokioCommand;

/// 실행 중인 프로젝트의 리소스 사용량 1틱 페이로드.
#[derive(Clone, Serialize)]
struct MetricPayload {
    id: String,
    cpu: f32,        // CPU 사용률(%) — 코어 합산이라 100%를 넘을 수 있음
    mem_bytes: u64,  // 메모리(바이트)
}

/// 1초마다 활성 프로세스(+직접 자식)의 CPU/메모리를 모아 `process-metrics`로 emit한다.
/// uv가 그룹 리더로 뜨고 python이 직접 자식으로 돌기 때문에, 루트 PID와 그 자식들을
/// 합산해야 실제 사용량에 가깝다(더 깊은 손주는 과소집계 — 추후 개선 여지).
async fn metrics_sampler(app: AppHandle, registry: Arc<runner::ProcessRegistry>) {
    use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};

    let mut sys = System::new();
    let mut ticker = tokio::time::interval(std::time::Duration::from_secs(1));
    loop {
        ticker.tick().await;

        // 활성 (id, pid) 스냅샷
        let targets: Vec<(String, u32)> = {
            let active = registry.active_processes.lock().unwrap();
            active.iter().map(|(id, p)| (id.clone(), p.pid)).collect()
        };
        if targets.is_empty() {
            continue;
        }

        // CPU/메모리만 갱신(전체 프로세스 — 자식 합산을 위해 필요)
        sys.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::nothing().with_cpu().with_memory(),
        );

        let mut payload = Vec::with_capacity(targets.len());
        for (id, pid) in targets {
            let root = Pid::from_u32(pid);
            let mut cpu = 0.0f32;
            let mut mem = 0u64;
            for (ppid, proc_) in sys.processes() {
                if *ppid == root || proc_.parent() == Some(root) {
                    cpu += proc_.cpu_usage();
                    mem += proc_.memory();
                }
            }
            payload.push(MetricPayload { id, cpu, mem_bytes: mem });
        }

        app.emit("process-metrics", payload).ok();
    }
}

struct AppState {
    config_manager: Mutex<ConfigManager>,
}

/// 설정 파일에는 status가 항상 "Stopped"로만 저장되므로, 실제 실행 상태(Running/포트)는
/// 레지스트리에서 읽어 병합한다. get/add/update/delete 모든 커맨드가 동일한 목록을 반환해야
/// 프론트엔드가 setProjects로 실행 중 프로젝트의 상태를 덮어쓰지 않는다.
fn apply_live_status(projects: &mut [Project], registry: &runner::ProcessRegistry) {
    let active = registry.active_processes.lock().unwrap();
    for p in projects.iter_mut() {
        if let Some(process) = active.get(&p.id) {
            p.status = "Running".to_string();
            p.port = *process.port.lock().unwrap();
        } else {
            p.status = "Stopped".to_string();
            p.port = None;
        }
    }
}

#[tauri::command]
fn get_projects(state: State<'_, AppState>, registry: State<'_, Arc<runner::ProcessRegistry>>) -> Result<Vec<Project>, String> {
    let manager = state.config_manager.lock().unwrap();
    let mut config = manager.read_config();
    apply_live_status(&mut config.projects, &registry);
    Ok(config.projects)
}

#[tauri::command]
fn add_project(state: State<'_, AppState>, registry: State<'_, Arc<runner::ProcessRegistry>>, mut project: Project) -> Result<Vec<Project>, String> {
    let manager = state.config_manager.lock().unwrap();
    let mut config = manager.read_config();

    config.projects.retain(|p| p.id != project.id);
    project.status = "Stopped".to_string();
    config.projects.push(project);

    manager.write_config(&config)?;
    apply_live_status(&mut config.projects, &registry);
    Ok(config.projects)
}

#[tauri::command]
fn update_project(state: State<'_, AppState>, registry: State<'_, Arc<runner::ProcessRegistry>>, project: Project) -> Result<Vec<Project>, String> {
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
        // status는 변경하지 않음 (실행 상태는 아래에서 레지스트리 기준으로 병합)
    } else {
        return Err("Project not found".to_string());
    }

    manager.write_config(&config)?;
    apply_live_status(&mut config.projects, &registry);
    Ok(config.projects)
}

#[tauri::command]
fn delete_project(state: State<'_, AppState>, registry: State<'_, Arc<runner::ProcessRegistry>>, id: String) -> Result<Vec<Project>, String> {
    let manager = state.config_manager.lock().unwrap();
    let mut config = manager.read_config();

    config.projects.retain(|p| p.id != id);

    manager.write_config(&config)?;
    apply_live_status(&mut config.projects, &registry);
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

    // 공유 터널(cloudflared) 레지스트리. 종료 핸들러용 핸들도 미리 복제.
    let tunnel_registry = Arc::new(tunnel::TunnelRegistry::default());
    let tunnel_for_exit = Arc::clone(&tunnel_registry);

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

            // 리소스 모니터: 1초 주기 샘플러를 백그라운드로 띄운다(레지스트리 관리 전에 핸들 복제).
            let metrics_registry = Arc::clone(&process_registry);
            let metrics_app = app.handle().clone();
            tauri::async_runtime::spawn(metrics_sampler(metrics_app, metrics_registry));

            app.manage(process_registry);
            app.manage(tunnel_registry);
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
            git::git_push,
            tunnel::check_tunnel_available,
            tunnel::start_tunnel,
            tunnel::stop_tunnel
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    // 앱이 종료될 때(Cmd+Q, 창 닫기, 메뉴 종료 등) 실행 중인 모든 서버를 함께 정리합니다.
    app.run(move |_app_handle, event| {
        if let tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit = event {
            runner::kill_all_processes(&registry_for_exit);
            tunnel::kill_all_tunnels(&tunnel_for_exit);
        }
    });
}
