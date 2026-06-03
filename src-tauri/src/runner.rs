use std::collections::HashMap;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::oneshot;
use tauri::{AppHandle, Emitter};
use serde::Serialize;
use once_cell::sync::Lazy;
use regex::Regex;
use std::path::{Path, PathBuf};

use crate::uv;

static PORT_REGEX: Lazy<Regex> = Lazy::new(|| {
    // Match both "http(s)://host:port" and bare "host:port" patterns
    Regex::new(r"(?:https?://)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::\]):(\d+)").unwrap()
});

#[derive(Clone, Serialize)]
pub struct StatusPayload {
    pub id: String,
    pub status: String,
}

#[derive(Clone, Serialize)]
pub struct PortPayload {
    pub id: String,
    pub port: u16,
}

pub struct RunningProcess {
    pub pid: u32,
    /// 드롭되면 oneshot 채널이 닫혀 모니터링 태스크의 kill_rx가 깨어나
    /// 자식 프로세스를 종료하는 RAII 안전장치. 직접 읽지는 않는다.
    #[allow(dead_code)]
    pub kill_tx: oneshot::Sender<()>,
    pub logs: Arc<Mutex<String>>,
    pub port: Arc<Mutex<Option<u16>>>,
}

#[derive(Default)]
pub struct ProcessRegistry {
    pub active_processes: Mutex<HashMap<String, RunningProcess>>,
    pub historical_logs: Mutex<HashMap<String, String>>,
    /// 앱이 SIGKILL 등으로 강제 종료되어도 다음 실행 시 고아 서버를 정리할 수 있도록
    /// 현재 실행 중인 프로세스(그룹 리더) PID 목록을 디스크에 보존하는 파일 경로.
    pub pid_file: Mutex<Option<PathBuf>>,
}

impl ProcessRegistry {
    /// 현재 활성 프로세스의 PID 목록을 pid_file에 기록합니다.
    /// (start/stop/프로세스 종료 시마다 호출되어 항상 최신 상태를 유지)
    pub fn persist(&self) {
        let path = self.pid_file.lock().unwrap().clone();
        if let Some(path) = path {
            let pids: Vec<u32> = self
                .active_processes
                .lock()
                .unwrap()
                .values()
                .map(|p| p.pid)
                .collect();
            let _ = std::fs::write(&path, serde_json::to_string(&pids).unwrap_or_default());
        }
    }
}

#[tauri::command]
pub async fn start_project(
    id: String,
    path: String,
    run_command: String,
    registry: tauri::State<'_, Arc<ProcessRegistry>>,
    app_handle: AppHandle,
) -> Result<String, String> {
    // 1. 이미 실행 중인지 확인
    {
        let active = registry.active_processes.lock().unwrap();
        if active.contains_key(&id) {
            return Err("Project is already running".to_string());
        }
    }

    // 2. 가상환경이 존재하는지 검증 (없을 때만 설치하여 첫 구동 이후에는 즉시 실행되도록 최적화)
    let has_venv = Path::new(&path).join(".venv").exists();
    if !has_venv {
        app_handle.emit("process-status", StatusPayload { id: id.clone(), status: "Installing".to_string() }).ok();
        app_handle.emit(&format!("log-stream-{}", id), "[uvws] Virtual environment not found. Setting up first...\r\n").ok();
        
        app_handle.emit(&format!("log-stream-{}", id), "[uvws] Creating uv virtual environment...\r\n").ok();
        uv::create_venv(&path).await?;
        
        app_handle.emit(&format!("log-stream-{}", id), "[uvws] Installing python dependencies...\r\n").ok();
        uv::install_dependencies(&path).await?;
    }

    // 3. 명령어 파싱 및 'uv run' 오케스트레이션 구성
    let mut split_cmd: Vec<String> = run_command.split_whitespace().map(|s| s.to_string()).collect();
    if !split_cmd.is_empty() && split_cmd[0] == "uv" {
        split_cmd.remove(0);
    }
    if !split_cmd.is_empty() && split_cmd[0] == "run" {
        split_cmd.remove(0);
    }

    // 최종 실행: uv run <명령어> <인자들>
    let mut uv_args = vec!["run".to_string()];
    uv_args.extend(split_cmd);

    app_handle.emit(&format!("log-stream-{}", id), format!("\x1b[38;2;100;100;110m[uvws] Launching: {}\x1b[0m\r\n", run_command)).ok();

    let mut command = Command::new("uv");
    command
        .current_dir(&path)
        .args(&uv_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    #[cfg(unix)]
    {
        command.process_group(0);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x00000200); // CREATE_NEW_PROCESS_GROUP
    }

    // 4. 프로세스 스폰
    let mut child = command.spawn().map_err(|e| format!("Failed to spawn process via uv: {}", e))?;
    let pid = child.id().ok_or_else(|| "Failed to get PID".to_string())?;
    
    let stdout = child.stdout.take().ok_or_else(|| "Failed to pipe stdout".to_string())?;
    let stderr = child.stderr.take().ok_or_else(|| "Failed to pipe stderr".to_string())?;

    let (kill_tx, kill_rx) = oneshot::channel::<()>();
    let process_logs = Arc::new(Mutex::new(String::new()));
    let process_port = Arc::new(Mutex::new(None));

    // 5. 레지스트리에 저장
    {
        let mut active = registry.active_processes.lock().unwrap();
        active.insert(id.clone(), RunningProcess { pid, kill_tx, logs: process_logs.clone(), port: process_port.clone() });
        let mut hist = registry.historical_logs.lock().unwrap();
        hist.remove(&id); // Clear history for new run
    }
    // 강제 종료 대비: 현재 실행 중인 PID 목록을 디스크에 보존
    registry.persist();

    // 상태 변경 이벤트 발송 (Running)
    app_handle.emit("process-status", StatusPayload { id: id.clone(), status: "Running".to_string() }).ok();

    // 6. 비동기 로그 모니터링 태스크 시작
    let app_clone = app_handle.clone();
    let id_clone = id.clone();
    let registry_clone = Arc::clone(&registry);

    tokio::spawn(async move {
        let mut stdout_reader = BufReader::new(stdout).lines();
        let mut stderr_reader = BufReader::new(stderr).lines();

        let id_for_out = id_clone.clone();
        let app_for_out = app_clone.clone();
        let logs_out = process_logs.clone();
        let port_out = process_port.clone();
        let stdout_handle = tokio::spawn(async move {
            while let Ok(Some(line)) = stdout_reader.next_line().await {
                if let Some(caps) = PORT_REGEX.captures(&line) {
                    if let Some(port_str) = caps.get(1) {
                        if let Ok(port) = port_str.as_str().parse::<u16>() {
                            *port_out.lock().unwrap() = Some(port);
                            app_for_out.emit("process-port", PortPayload { id: id_for_out.clone(), port }).ok();
                        }
                    }
                }
                let msg = format!("{}\r\n", line);
                logs_out.lock().unwrap().push_str(&msg);
                app_for_out.emit(&format!("log-stream-{}", id_for_out), msg).ok();
            }
        });

        let id_for_err = id_clone.clone();
        let app_for_err = app_clone.clone();
        let logs_err = process_logs.clone();
        let port_err = process_port.clone();
        let stderr_handle = tokio::spawn(async move {
            while let Ok(Some(line)) = stderr_reader.next_line().await {
                if let Some(caps) = PORT_REGEX.captures(&line) {
                    if let Some(port_str) = caps.get(1) {
                        if let Ok(port) = port_str.as_str().parse::<u16>() {
                            *port_err.lock().unwrap() = Some(port);
                            app_for_err.emit("process-port", PortPayload { id: id_for_err.clone(), port }).ok();
                        }
                    }
                }
                let msg = format!("\x1b[31m{}\x1b[0m\r\n", line);
                logs_err.lock().unwrap().push_str(&msg);
                app_for_err.emit(&format!("log-stream-{}", id_for_err), msg).ok();
            }
        });

        // 프로세스 종료 및 시그널 모니터링
        tokio::select! {
            status = child.wait() => {
                match status {
                    Ok(exit_status) => {
                        let exit_msg = format!("\r\n\x1b[38;2;100;100;110m[uvws] Process exited with status: {}\x1b[0m\r\n", exit_status);
                        process_logs.lock().unwrap().push_str(&exit_msg);
                        app_clone.emit(&format!("log-stream-{}", id_clone), exit_msg).ok();
                    }
                    Err(e) => {
                        let err_msg = format!("\r\n[uvws] Error waiting for process: {}\r\n", e);
                        process_logs.lock().unwrap().push_str(&err_msg);
                        app_clone.emit(&format!("log-stream-{}", id_clone), err_msg).ok();
                    }
                }
            }
            _ = kill_rx => {
                let _ = child.kill().await;
                let msg = "\r\n[uvws] Process killed by user.\r\n";
                process_logs.lock().unwrap().push_str(msg);
                app_clone.emit(&format!("log-stream-{}", id_clone), msg).ok();
            }
        }

        // 스레드 핸들 강제 종료 및 리소스 반환
        stdout_handle.abort();
        stderr_handle.abort();

        // 레지스트리 정리
        {
            let mut active = registry_clone.active_processes.lock().unwrap();
            if let Some(process) = active.remove(&id_clone) {
                let mut hist = registry_clone.historical_logs.lock().unwrap();
                hist.insert(id_clone.clone(), process.logs.lock().unwrap().clone());
            }
        }
        registry_clone.persist();

        app_clone.emit("process-status", StatusPayload { id: id_clone.clone(), status: "Stopped".to_string() }).ok();
    });

    Ok(format!("Project started successfully with PID: {}", pid))
}

#[tauri::command]
pub async fn stop_project(
    id: String,
    registry: tauri::State<'_, Arc<ProcessRegistry>>,
) -> Result<String, String> {
    let pid_opt = {
        let mut active = registry.active_processes.lock().unwrap();
        active.remove(&id).map(|p| p.pid)
    };
    registry.persist();

    if let Some(pid) = pid_opt {
        #[cfg(unix)]
        {
            let pgid = format!("-{}", pid);
            let _ = tokio::process::Command::new("kill")
                .args(["-9", &pgid])
                .status()
                .await;
        }
        #[cfg(not(unix))]
        {
            // Fallback for non-unix if kill_tx were still around, 
            // but we removed kill_tx extraction. For Windows we can use taskkill.
            let _ = tokio::process::Command::new("taskkill")
                .args(["/F", "/T", "/PID", &pid.to_string()])
                .status()
                .await;
        }
        Ok("Stop command triggered".to_string())
    } else {
        Err("Process is not running".to_string())
    }
}

/// 수동으로 가상환경을 동기화하고 패키지 의존성을 재설치하는 커맨드
#[tauri::command]
pub async fn sync_project_dependencies(
    id: String,
    path: String,
    app_handle: AppHandle,
) -> Result<String, String> {
    app_handle.emit("process-status", StatusPayload { id: id.clone(), status: "Installing".to_string() }).ok();
    
    app_handle.emit(&format!("log-stream-{}", id), "[uvws] Start synchronizing dependencies...\r\n").ok();
    app_handle.emit(&format!("log-stream-{}", id), "[uvws] Ensuring virtual environment exists...\r\n").ok();
    uv::create_venv(&path).await?;
    
    app_handle.emit(&format!("log-stream-{}", id), "[uvws] Syncing dependencies using uv...\r\n").ok();
    uv::install_dependencies(&path).await?;
    
    app_handle.emit(&format!("log-stream-{}", id), "[uvws] Dependencies synchronized successfully!\r\n").ok();
    
    app_handle.emit("process-status", StatusPayload { id: id.clone(), status: "Stopped".to_string() }).ok();
    Ok("Sync completed".to_string())
}

#[tauri::command]
pub fn get_process_logs(id: String, registry: tauri::State<'_, Arc<ProcessRegistry>>) -> Result<String, String> {
    let active = registry.active_processes.lock().unwrap();
    if let Some(process) = active.get(&id) {
        return Ok(process.logs.lock().unwrap().clone());
    }
    
    let hist = registry.historical_logs.lock().unwrap();
    if let Some(logs) = hist.get(&id) {
        return Ok(logs.clone());
    }
    
    Ok("".to_string())
}

// ───────────────────────────────────────────────────────────────────────────
// 포트 / 프로세스 강제 종료 유틸리티
// ───────────────────────────────────────────────────────────────────────────

/// GUI 앱은 사용자 셸 PATH를 상속받지 못하므로 lsof 절대경로를 우선 사용합니다.
#[cfg(unix)]
fn lsof_bin() -> &'static str {
    if Path::new("/usr/sbin/lsof").exists() {
        "/usr/sbin/lsof"
    } else if Path::new("/usr/bin/lsof").exists() {
        "/usr/bin/lsof"
    } else {
        "lsof"
    }
}

/// 해당 포트를 점유 중인 프로세스 PID 목록을 찾습니다. (Unix)
#[cfg(unix)]
async fn find_port_pids(port: u16) -> Vec<u32> {
    let bin = lsof_bin();

    let parse = |out: std::process::Output| -> Vec<u32> {
        String::from_utf8_lossy(&out.stdout)
            .lines()
            .filter_map(|l| l.trim().parse::<u32>().ok())
            .collect()
    };

    // 1차: 포트를 실제로 LISTEN 중인 프로세스(포트를 점유하는 주체)만 정확히 타깃팅
    if let Ok(out) = tokio::process::Command::new(bin)
        .args(["-nP", "-t", &format!("-iTCP:{}", port), "-sTCP:LISTEN"])
        .output()
        .await
    {
        let pids = parse(out);
        if !pids.is_empty() {
            return pids;
        }
    }

    // 2차: TCP LISTEN으로 못 찾으면 해당 포트를 참조하는 모든 프로세스(UDP 등 포함)
    if let Ok(out) = tokio::process::Command::new(bin)
        .args(["-nP", "-t", &format!("-i:{}", port)])
        .output()
        .await
    {
        return parse(out);
    }

    Vec::new()
}

/// 특정 포트를 점유하는 프로세스를 무조건 강제(SIGKILL)로 종료합니다.
/// 포트가 실제로 비워질 때까지 재시도하고, 마지막에 비워졌는지 검증합니다.
#[tauri::command]
pub async fn kill_port(port: u16) -> Result<String, String> {
    #[cfg(unix)]
    {
        use std::collections::HashSet;

        let mut killed: HashSet<u32> = HashSet::new();

        for _ in 0..4 {
            let pids = find_port_pids(port).await;
            if pids.is_empty() {
                break;
            }
            for pid in pids {
                // SIGKILL(-9)은 트랩/무시가 불가능하므로 포트 점유 프로세스를 확실히 종료합니다.
                let _ = tokio::process::Command::new("kill")
                    .args(["-9", &pid.to_string()])
                    .status()
                    .await;
                killed.insert(pid);
            }
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        }

        // 강제 종료 후에도 포트가 살아있는지 최종 검증
        let remaining = find_port_pids(port).await;
        if !remaining.is_empty() {
            return Err(format!(
                "포트 {}을(를) 강제 종료했지만 여전히 PID {:?}이(가) 점유 중입니다.",
                port, remaining
            ));
        }

        if killed.is_empty() {
            return Err(format!("포트 {}에서 실행 중인 프로세스를 찾지 못했습니다.", port));
        }

        Ok(format!("포트 {}의 프로세스 {}개를 강제 종료했습니다.", port, killed.len()))
    }

    #[cfg(windows)]
    {
        use std::collections::HashSet;

        let mut killed: HashSet<u32> = HashSet::new();

        for _ in 0..4 {
            let output = tokio::process::Command::new("cmd")
                .args(["/C", &format!("netstat -ano | findstr :{}", port)])
                .output()
                .await
                .map_err(|e| format!("Failed to run netstat: {}", e))?;

            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let mut found = false;

            for line in stdout.lines() {
                // 정확히 해당 포트를 사용하는 라인만 대상으로 합니다.
                if !line.contains(&format!(":{}", port)) {
                    continue;
                }
                if let Some(pid_str) = line.split_whitespace().last() {
                    if let Ok(pid) = pid_str.parse::<u32>() {
                        if pid > 0 {
                            found = true;
                            // /T: 자식 프로세스 트리까지 함께 강제 종료
                            let _ = tokio::process::Command::new("taskkill")
                                .args(["/F", "/T", "/PID", &pid.to_string()])
                                .status()
                                .await;
                            killed.insert(pid);
                        }
                    }
                }
            }

            if !found {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        }

        if killed.is_empty() {
            return Err(format!("포트 {}에서 실행 중인 프로세스를 찾지 못했습니다.", port));
        }

        Ok(format!("포트 {}의 프로세스 {}개를 강제 종료했습니다.", port, killed.len()))
    }
}

// ───────────────────────────────────────────────────────────────────────────
// 앱 종료 시 / 재시작 시 실행 중이던 서버 정리
// ───────────────────────────────────────────────────────────────────────────

/// 단일 프로세스와 그 프로세스 그룹(자식 포함)을 강제 종료합니다.
fn kill_process_tree(pid: u32) {
    #[cfg(unix)]
    {
        // start_project에서 process_group(0)으로 스폰했으므로 pgid == pid 입니다.
        // 그룹(-pid)을 먼저 죽여 uv가 띄운 python 자식까지 함께 정리합니다.
        let _ = std::process::Command::new("kill")
            .args(["-9", &format!("-{}", pid)])
            .status();
        let _ = std::process::Command::new("kill")
            .args(["-9", &pid.to_string()])
            .status();
    }
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .status();
    }
}

/// 레지스트리에 등록된 모든 활성 프로세스(그룹)를 강제 종료합니다.
/// 앱이 정상 종료(Cmd+Q, 창 닫기, 메뉴 종료 등)될 때 호출됩니다.
pub fn kill_all_processes(registry: &ProcessRegistry) {
    let pids: Vec<u32> = {
        let mut active = registry.active_processes.lock().unwrap();
        active.drain().map(|(_, p)| p.pid).collect()
    };

    for pid in pids {
        kill_process_tree(pid);
    }

    // 정상 종료이므로 보존 파일을 비웁니다(고아 없음).
    registry.persist();
}

/// 이전 세션이 SIGKILL 등으로 정리되지 못해 남은 고아 서버를 종료합니다.
/// 앱 시작 시 1회 호출됩니다.
pub fn cleanup_orphans(path: &Path) {
    let Ok(content) = std::fs::read_to_string(path) else {
        return;
    };
    if let Ok(pids) = serde_json::from_str::<Vec<u32>>(&content) {
        for pid in pids {
            // 프로세스 '그룹'만 종료합니다. PID가 재사용되었더라도 동일 PID가 다시
            // 그룹 리더일 가능성은 낮아 엉뚱한 프로세스를 죽일 위험을 줄입니다.
            #[cfg(unix)]
            {
                let _ = std::process::Command::new("kill")
                    .args(["-9", &format!("-{}", pid)])
                    .status();
            }
            #[cfg(windows)]
            {
                let _ = std::process::Command::new("taskkill")
                    .args(["/F", "/T", "/PID", &pid.to_string()])
                    .status();
            }
        }
    }
    let _ = std::fs::remove_file(path);
}
