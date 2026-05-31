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
use std::path::Path;

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
    pub kill_tx: oneshot::Sender<()>,
    pub logs: Arc<Mutex<String>>,
    pub port: Arc<Mutex<Option<u16>>>,
}

#[derive(Default)]
pub struct ProcessRegistry {
    pub active_processes: Mutex<HashMap<String, RunningProcess>>,
    pub historical_logs: Mutex<HashMap<String, String>>,
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
        app_handle.emit(&format!("log-stream-{}", id), "[PySpace] Virtual environment not found. Setting up first...\r\n").ok();
        
        app_handle.emit(&format!("log-stream-{}", id), "[PySpace] Creating uv virtual environment...\r\n").ok();
        uv::create_venv(&path).await?;
        
        app_handle.emit(&format!("log-stream-{}", id), "[PySpace] Installing python dependencies...\r\n").ok();
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

    app_handle.emit(&format!("log-stream-{}", id), format!("\x1b[38;2;100;100;110m[PySpace] Launching: {}\x1b[0m\r\n", run_command)).ok();

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
                        let exit_msg = format!("\r\n\x1b[38;2;100;100;110m[PySpace] Process exited with status: {}\x1b[0m\r\n", exit_status);
                        process_logs.lock().unwrap().push_str(&exit_msg);
                        app_clone.emit(&format!("log-stream-{}", id_clone), exit_msg).ok();
                    }
                    Err(e) => {
                        let err_msg = format!("\r\n[PySpace] Error waiting for process: {}\r\n", e);
                        process_logs.lock().unwrap().push_str(&err_msg);
                        app_clone.emit(&format!("log-stream-{}", id_clone), err_msg).ok();
                    }
                }
            }
            _ = kill_rx => {
                let _ = child.kill().await;
                let msg = "\r\n[PySpace] Process killed by user.\r\n";
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
    
    app_handle.emit(&format!("log-stream-{}", id), "[PySpace] Start synchronizing dependencies...\r\n").ok();
    app_handle.emit(&format!("log-stream-{}", id), "[PySpace] Ensuring virtual environment exists...\r\n").ok();
    uv::create_venv(&path).await?;
    
    app_handle.emit(&format!("log-stream-{}", id), "[PySpace] Syncing dependencies using uv...\r\n").ok();
    uv::install_dependencies(&path).await?;
    
    app_handle.emit(&format!("log-stream-{}", id), "[PySpace] Dependencies synchronized successfully!\r\n").ok();
    
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

/// 특정 포트를 점유하는 프로세스를 강제 종료합니다.
#[tauri::command]
pub async fn kill_port(port: u16) -> Result<String, String> {
    #[cfg(unix)]
    {
        // lsof로 해당 포트를 사용하는 PID 찾기
        let output = tokio::process::Command::new("lsof")
            .args(["-ti", &format!(":{}", port)])
            .output()
            .await
            .map_err(|e| format!("Failed to run lsof: {}", e))?;

        if !output.status.success() || output.stdout.is_empty() {
            return Err(format!("No process found on port {}", port));
        }

        let pids_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let pids: Vec<&str> = pids_str.lines().collect();

        for pid in &pids {
            let kill_result = tokio::process::Command::new("kill")
                .args(["-9", pid])
                .status()
                .await;

            if let Err(e) = kill_result {
                return Err(format!("Failed to kill PID {}: {}", pid, e));
            }
        }

        Ok(format!("Killed {} process(es) on port {}", pids.len(), port))
    }

    #[cfg(windows)]
    {
        // netstat로 해당 포트를 사용하는 PID 찾기
        let output = tokio::process::Command::new("cmd")
            .args(["/C", &format!("netstat -ano | findstr :{}", port)])
            .output()
            .await
            .map_err(|e| format!("Failed to run netstat: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        if stdout.trim().is_empty() {
            return Err(format!("No process found on port {}", port));
        }

        let mut killed_pids: Vec<String> = Vec::new();
        for line in stdout.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if let Some(pid_str) = parts.last() {
                if let Ok(pid) = pid_str.parse::<u32>() {
                    if pid > 0 && !killed_pids.contains(&pid.to_string()) {
                        let _ = tokio::process::Command::new("taskkill")
                            .args(["/F", "/PID", &pid.to_string()])
                            .status()
                            .await;
                        killed_pids.push(pid.to_string());
                    }
                }
            }
        }

        if killed_pids.is_empty() {
            return Err(format!("No process found on port {}", port));
        }

        Ok(format!("Killed {} process(es) on port {}", killed_pids.len(), port))
    }
}
