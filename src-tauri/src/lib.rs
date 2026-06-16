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

/// `uv python list`로 본 마이너 버전 1개의 요약.
#[derive(Clone, Serialize)]
struct PythonVersionInfo {
    minor: String,   // "3.12"
    version: String, // 설치돼 있으면 설치된 최신 패치, 아니면 받을 수 있는 최신 패치
    installed: bool, // 해당 마이너의 빌드가 하나라도 설치돼 있는지
}

/// 형식 안전: 버전 요청은 숫자와 점만 (예: "3", "3.12", "3.12.7").
fn is_valid_py_request(v: &str) -> bool {
    regex::Regex::new(r"^\d+(\.\d+){0,2}$").unwrap().is_match(v)
}

/// uv가 아는 CPython 마이너 버전(설치/미설치)을 정리해 반환한다.
/// 프리릴리스(a/b/rc)·freethreaded·非cpython은 제외하고, 마이너별 최신 패치만 남긴다.
#[tauri::command]
async fn uv_python_list() -> Result<Vec<PythonVersionInfo>, String> {
    let output = TokioCommand::new("uv")
        .args(["python", "list", "--output-format", "json"])
        .output()
        .await
        .map_err(|e| format!("Failed to list Python versions: {}", e))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    let arr: Vec<serde_json::Value> =
        serde_json::from_str(&String::from_utf8_lossy(&output.stdout)).unwrap_or_default();

    let stable = regex::Regex::new(r"^\d+\.\d+\.\d+$").unwrap();
    // (major, minor) -> (avail_patch, avail_ver, inst_patch, inst_ver)
    let mut map: std::collections::BTreeMap<(u64, u64), (u64, String, Option<u64>, Option<String>)> =
        std::collections::BTreeMap::new();

    for e in &arr {
        if e.get("implementation").and_then(|v| v.as_str()) != Some("cpython") {
            continue;
        }
        if e.get("variant").and_then(|v| v.as_str()).unwrap_or("default") != "default" {
            continue;
        }
        let version = match e.get("version").and_then(|v| v.as_str()) {
            Some(v) if stable.is_match(v) => v,
            _ => continue,
        };
        let parts = match e.get("version_parts") {
            Some(p) => p,
            None => continue,
        };
        let major = parts.get("major").and_then(|v| v.as_u64()).unwrap_or(0);
        let minor = parts.get("minor").and_then(|v| v.as_u64()).unwrap_or(0);
        let patch = parts.get("patch").and_then(|v| v.as_u64()).unwrap_or(0);
        if major < 3 || (major == 3 && minor < 8) {
            continue; // 3.8+ 만 노출
        }
        let installed = e.get("path").map(|p| !p.is_null()).unwrap_or(false);

        let ent = map
            .entry((major, minor))
            .or_insert((0, String::new(), None, None));
        if ent.1.is_empty() || patch >= ent.0 {
            ent.0 = patch;
            ent.1 = version.to_string();
        }
        if installed && ent.2.map_or(true, |ip| patch >= ip) {
            ent.2 = Some(patch);
            ent.3 = Some(version.to_string());
        }
    }

    let result = map
        .into_iter()
        .rev() // 최신 마이너가 위로
        .map(|((maj, min), (_, avail_ver, inst_patch, inst_ver))| PythonVersionInfo {
            minor: format!("{}.{}", maj, min),
            version: inst_ver.unwrap_or(avail_ver),
            installed: inst_patch.is_some(),
        })
        .collect();
    Ok(result)
}

/// uv로 특정 Python 버전을 설치한다(다운로드라 수십 초 걸릴 수 있음).
#[tauri::command]
async fn uv_python_install(version: String) -> Result<String, String> {
    if !is_valid_py_request(&version) {
        return Err(format!("Invalid Python version: {}", version));
    }
    let output = TokioCommand::new("uv")
        .args(["python", "install", &version])
        .output()
        .await
        .map_err(|e| format!("Failed to install Python: {}", e))?;
    if output.status.success() {
        Ok(format!("Python {} installed", version))
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

/// 프로젝트 디렉터리에 `.python-version`을 써서 Python 버전을 고정한다.
/// `uv run`/`uv venv`가 이 핀을 따르므로 별도 실행 로직 변경이 필요 없다.
#[tauri::command]
async fn uv_python_pin(path: String, version: String) -> Result<(), String> {
    if !is_valid_py_request(&version) {
        return Err(format!("Invalid Python version: {}", version));
    }
    let output = TokioCommand::new("uv")
        .current_dir(&path)
        .args(["python", "pin", &version])
        .output()
        .await
        .map_err(|e| format!("Failed to pin Python: {}", e))?;
    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

/// 프로젝트의 현재 핀(`.python-version` 내용)을 읽는다. 없으면 None.
#[tauri::command]
async fn get_python_pin(path: String) -> Result<Option<String>, String> {
    let pin_file = Path::new(&path).join(".python-version");
    if let Ok(s) = std::fs::read_to_string(&pin_file) {
        let s = s.trim().to_string();
        if !s.is_empty() {
            return Ok(Some(s));
        }
    }
    Ok(None)
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

/// 업데이트 가능한(구버전) 패키지 목록: uv pip list --outdated --format json
/// 각 항목 예: { "name", "version"(현재), "latest_version", "latest_filetype" }
#[tauri::command]
async fn list_outdated(path: String) -> Result<Vec<serde_json::Value>, String> {
    let venv_path = Path::new(&path).join(".venv");
    if !venv_path.exists() {
        return Ok(vec![]);
    }

    let output = TokioCommand::new("uv")
        .current_dir(&path)
        .args(["pip", "list", "--outdated", "--format", "json"])
        .output()
        .await
        .map_err(|e| format!("Failed to list outdated packages: {}", e))?;

    if output.status.success() {
        let json_str = String::from_utf8_lossy(&output.stdout);
        Ok(serde_json::from_str(&json_str).unwrap_or_default())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// 단일 패키지를 최신으로 업그레이드: uv pip install --upgrade <name>
#[tauri::command]
async fn upgrade_package(path: String, name: String) -> Result<String, String> {
    let output = TokioCommand::new("uv")
        .current_dir(&path)
        .args(["pip", "install", "--upgrade", &name])
        .output()
        .await
        .map_err(|e| format!("Failed to upgrade {}: {}", name, e))?;

    if output.status.success() {
        Ok(format!("{} upgraded", name))
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// 여러 패키지를 한 번에 업그레이드: uv pip install --upgrade <names...>
#[tauri::command]
async fn upgrade_all(path: String, names: Vec<String>) -> Result<String, String> {
    if names.is_empty() {
        return Ok("nothing to upgrade".to_string());
    }

    let mut args: Vec<String> = vec!["pip".into(), "install".into(), "--upgrade".into()];
    args.extend(names.iter().cloned());

    let output = TokioCommand::new("uv")
        .current_dir(&path)
        .args(&args)
        .output()
        .await
        .map_err(|e| format!("Failed to upgrade packages: {}", e))?;

    if output.status.success() {
        Ok(format!("{} packages upgraded", names.len()))
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// uv 실행 파일 경로를 해석합니다. GUI 앱은 셸 PATH를 상속받지 못할 수 있으므로
/// 잘 알려진 설치 경로(uv 공식 인스톨러 기본값 `~/.local/bin`, 구버전 `~/.cargo/bin` 포함)를
/// 우선 확인하고, 없으면 PATH의 `uv`로 폴백합니다. (cloudflared 해석과 동일 전략)
fn uv_bin() -> String {
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(home) = std::env::var("HOME") {
            for rel in [".local/bin/uv", ".cargo/bin/uv"] {
                let p = Path::new(&home).join(rel);
                if p.exists() {
                    return p.to_string_lossy().to_string();
                }
            }
        }
        for p in ["/opt/homebrew/bin/uv", "/usr/local/bin/uv"] {
            if Path::new(p).exists() {
                return p.to_string();
            }
        }
    }
    #[cfg(target_os = "windows")]
    {
        if let Ok(home) = std::env::var("USERPROFILE") {
            for rel in [".local\\bin\\uv.exe", ".cargo\\bin\\uv.exe"] {
                let p = Path::new(&home).join(rel);
                if p.exists() {
                    return p.to_string_lossy().to_string();
                }
            }
        }
    }
    "uv".to_string()
}

#[derive(Serialize)]
struct UvStatus {
    installed: bool,
    version: Option<String>,
}

/// uv 설치 여부와 버전을 확인합니다. (`uv --version` → "uv x.y.z")
#[tauri::command]
async fn check_uv() -> Result<UvStatus, String> {
    let bin = uv_bin();
    match TokioCommand::new(&bin).arg("--version").output().await {
        Ok(o) if o.status.success() => {
            let v = String::from_utf8_lossy(&o.stdout)
                .trim()
                .trim_start_matches("uv ")
                .to_string();
            Ok(UvStatus {
                installed: true,
                version: Some(v),
            })
        }
        _ => Ok(UvStatus {
            installed: false,
            version: None,
        }),
    }
}

/// uv를 Astral 공식 인스톨러로 설치합니다(사용자가 버튼으로 명시적 동의한 경우에만 호출됨).
/// macOS/Linux: astral.sh/uv/install.sh, Windows: install.ps1.
/// 설치 위치(`~/.local/bin`)는 main.rs가 시작 시 PATH에 이미 추가하므로,
/// 같은 세션에서 곧바로 uv를 호출할 수 있습니다.
#[tauri::command]
async fn install_uv() -> Result<String, String> {
    #[cfg(not(target_os = "windows"))]
    let output = TokioCommand::new("sh")
        .args(["-c", "curl -LsSf https://astral.sh/uv/install.sh | sh"])
        .output()
        .await
        .map_err(|e| format!("Failed to run installer: {}", e))?;

    #[cfg(target_os = "windows")]
    let output = TokioCommand::new("powershell")
        .args([
            "-ExecutionPolicy",
            "ByPass",
            "-NoProfile",
            "-Command",
            "irm https://astral.sh/uv/install.ps1 | iex",
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run installer: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(format!(
            "{}{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        )
        .trim()
        .to_string())
    }
}

/// 창 전체의 불투명도(0.3~1.0)를 OS 네이티브 API로 설정한다.
/// `transparent: true` 없이 동작하므로 1.0(기본)일 땐 기존과 완전히 동일하고,
/// 낮추면 창 전체(텍스트 포함)가 바탕화면 위로 서서히 비쳐 보인다.
/// macOS: NSWindow.alphaValue · Linux: GTK opacity.
/// Windows는 WebView2 호스팅 창에서 레이어드 윈도우 알파가 안정적으로 먹지 않아
/// (콘텐츠 미반영/검은 렌더) 지원하지 않는다 — no-op.
#[tauri::command]
fn set_window_opacity(window: tauri::Window, opacity: f64) -> Result<(), String> {
    let o = opacity.clamp(0.2, 1.0);

    #[cfg(target_os = "macos")]
    {
        use objc2::{msg_send, runtime::AnyObject};
        let ns_window = window.ns_window().map_err(|e| e.to_string())? as *mut AnyObject;
        unsafe {
            let _: () = msg_send![&*ns_window, setAlphaValue: o];
        }
    }

    #[cfg(target_os = "linux")]
    {
        use gtk::prelude::WidgetExt;
        let gtk_window = window.gtk_window().map_err(|e| e.to_string())?;
        gtk_window.set_opacity(o);
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    let _ = (o, &window); // 미지원 플랫폼(Windows 등): unused 경고 방지용 no-op

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
        .plugin(tauri_plugin_notification::init())
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
            uv_python_list,
            uv_python_install,
            uv_python_pin,
            get_python_pin,
            check_venv_exists,
            list_dependencies,
            check_requirements_exists,
            setup_project_env,
            list_outdated,
            upgrade_package,
            upgrade_all,
            check_uv,
            install_uv,
            set_window_opacity,
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
