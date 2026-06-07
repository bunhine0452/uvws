use std::collections::HashMap;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::io::{AsyncRead, AsyncReadExt};
use tokio::process::Command;
use tauri::{AppHandle, Emitter};
use serde::Serialize;
use once_cell::sync::Lazy;
use regex::Regex;

// cloudflared 퀵 터널이 출력하는 공개 URL(https://<랜덤>.trycloudflare.com) 패턴
static TRYCF_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"https://[-a-z0-9]+\.trycloudflare\.com").unwrap());

#[derive(Clone, Serialize)]
pub struct TunnelUrlPayload {
    pub id: String,
    pub url: String,
}

#[derive(Clone, Serialize)]
pub struct TunnelErrorPayload {
    pub id: String,
    pub message: String,
}

#[derive(Clone, Serialize)]
pub struct TunnelStoppedPayload {
    pub id: String,
}

pub struct TunnelProcess {
    /// cloudflared 프로세스(그룹 리더) PID. stop 시 그룹째 종료한다.
    pub pid: u32,
    /// 감지된 공개 URL(파싱 전에는 None). 스캔 태스크가 채우며, 현재는 보관만 한다
    /// (추후 "활성 터널 목록/재조회" 커맨드용).
    #[allow(dead_code)]
    pub url: Arc<Mutex<Option<String>>>,
}

#[derive(Default)]
pub struct TunnelRegistry {
    pub tunnels: Mutex<HashMap<String, TunnelProcess>>,
}

/// GUI 앱은 사용자 셸 PATH를 상속받지 못할 수 있으므로(runner의 lsof와 동일한 이유)
/// 잘 알려진 설치 경로를 우선 사용하고, 없으면 PATH의 cloudflared로 폴백합니다.
#[cfg(target_os = "macos")]
fn cloudflared_bin() -> String {
    for p in ["/opt/homebrew/bin/cloudflared", "/usr/local/bin/cloudflared"] {
        if std::path::Path::new(p).exists() {
            return p.to_string();
        }
    }
    "cloudflared".to_string()
}

#[cfg(not(target_os = "macos"))]
fn cloudflared_bin() -> String {
    "cloudflared".to_string()
}

/// cloudflared 가 실행 가능한지(설치되어 있는지) 확인합니다.
#[tauri::command]
pub fn check_tunnel_available() -> Result<bool, String> {
    // 1) 잘 알려진 절대경로 우선
    let bin = cloudflared_bin();
    if bin.starts_with('/') && std::path::Path::new(&bin).exists() {
        return Ok(true);
    }

    // 2) which/where 폴백
    #[cfg(target_os = "windows")]
    let check = "where";
    #[cfg(not(target_os = "windows"))]
    let check = "which";

    Ok(std::process::Command::new(check)
        .arg("cloudflared")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false))
}

/// 한 스트림(stdout 또는 stderr)을 읽으며 trycloudflare URL을 1회 탐지해 이벤트로 알립니다.
/// cloudflared 는 보통 URL 배너를 stderr로 출력하므로 두 스트림 모두 스캔합니다.
async fn scan_for_url<R: AsyncRead + Unpin>(
    mut reader: R,
    app: AppHandle,
    id: String,
    url_store: Arc<Mutex<Option<String>>>,
    found: Arc<Mutex<bool>>,
) {
    let mut buf = [0u8; 4096];
    let mut acc = String::new();
    loop {
        match reader.read(&mut buf).await {
            Ok(0) | Err(_) => break,
            Ok(n) => {
                acc.push_str(&String::from_utf8_lossy(&buf[..n]));

                let already = *found.lock().unwrap();
                if already {
                    // 이미 찾았으면 스트림을 계속 비워주기만 한다(파이프 막힘 방지).
                    acc.clear();
                    continue;
                }

                if let Some(m) = TRYCF_RE.find(&acc) {
                    let url = m.as_str().to_string();
                    *url_store.lock().unwrap() = Some(url.clone());
                    *found.lock().unwrap() = true;
                    app.emit("tunnel-url", TunnelUrlPayload { id: id.clone(), url })
                        .ok();
                } else if acc.len() > 16384 {
                    // URL 패턴이 청크 경계에 걸칠 수 있으니 최근 일부만 유지(문자 경계 보존)
                    let mut cut = acc.len() - 8192;
                    while cut < acc.len() && !acc.is_char_boundary(cut) {
                        cut += 1;
                    }
                    acc.drain(..cut);
                }
            }
        }
    }
}

/// 주어진 포트로 cloudflared 퀵 터널을 띄우고, 공개 URL을 파싱해 프론트로 알립니다.
#[tauri::command]
pub async fn start_tunnel(
    id: String,
    port: u16,
    registry: tauri::State<'_, Arc<TunnelRegistry>>,
    app: AppHandle,
) -> Result<(), String> {
    // 이미 이 프로젝트의 터널이 떠 있으면 무시
    {
        let tunnels = registry.tunnels.lock().unwrap();
        if tunnels.contains_key(&id) {
            return Ok(());
        }
    }

    let bin = cloudflared_bin();
    let url_arg = format!("http://localhost:{}", port);

    let mut command = Command::new(&bin);
    command
        .args(["tunnel", "--url", &url_arg])
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

    let mut child = command
        .spawn()
        .map_err(|e| format!("cloudflared 실행 실패: {} (cloudflared가 설치돼 있나요?)", e))?;
    let pid = child
        .id()
        .ok_or_else(|| "cloudflared PID 획득 실패".to_string())?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "cloudflared stdout 파이프 실패".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "cloudflared stderr 파이프 실패".to_string())?;

    let url_store = Arc::new(Mutex::new(None));

    // 레지스트리에 저장(stop/앱 종료 시 정리)
    {
        let mut tunnels = registry.tunnels.lock().unwrap();
        tunnels.insert(
            id.clone(),
            TunnelProcess {
                pid,
                url: url_store.clone(),
            },
        );
    }

    let app_clone = app.clone();
    let id_clone = id.clone();
    let registry_arc = Arc::clone(&registry);

    tokio::spawn(async move {
        let found = Arc::new(Mutex::new(false));

        let h_out = tokio::spawn(scan_for_url(
            stdout,
            app_clone.clone(),
            id_clone.clone(),
            url_store.clone(),
            found.clone(),
        ));
        let h_err = tokio::spawn(scan_for_url(
            stderr,
            app_clone.clone(),
            id_clone.clone(),
            url_store.clone(),
            found.clone(),
        ));

        // URL이 잡힐 때까지(최대 25초) 대기. child는 죽이지 않고 계속 살린다.
        let found_for_wait = found.clone();
        let waited = tokio::time::timeout(Duration::from_secs(25), async move {
            loop {
                let done = *found_for_wait.lock().unwrap();
                if done {
                    return;
                }
                tokio::time::sleep(Duration::from_millis(150)).await;
            }
        })
        .await;

        if waited.is_err() && !*found.lock().unwrap() {
            app_clone
                .emit(
                    "tunnel-error",
                    TunnelErrorPayload {
                        id: id_clone.clone(),
                        message: "공개 URL을 받지 못했습니다 (시간 초과).".to_string(),
                    },
                )
                .ok();
        }

        // 터널 유지: cloudflared가 종료될 때까지 대기.
        // stop_tunnel이 프로세스 그룹을 종료하면 여기서 깨어난다.
        let _ = child.wait().await;

        // 정리: 레지스트리에서 제거하고 종료를 알린다.
        {
            registry_arc.tunnels.lock().unwrap().remove(&id_clone);
        }
        app_clone
            .emit(
                "tunnel-stopped",
                TunnelStoppedPayload {
                    id: id_clone.clone(),
                },
            )
            .ok();

        let _ = h_out.await;
        let _ = h_err.await;
    });

    Ok(())
}

/// 특정 프로젝트의 터널을 종료합니다.
#[tauri::command]
pub async fn stop_tunnel(
    id: String,
    registry: tauri::State<'_, Arc<TunnelRegistry>>,
) -> Result<(), String> {
    let pid_opt = {
        let mut tunnels = registry.tunnels.lock().unwrap();
        tunnels.remove(&id).map(|t| t.pid)
    };

    if let Some(pid) = pid_opt {
        kill_pid_group(pid);
    }
    // 이미 없으면 조용히 성공 처리(프론트 상태 정리는 tunnel-stopped로 수렴)
    Ok(())
}

/// cloudflared 프로세스(그룹)를 강제 종료합니다. (runner의 kill_process_tree와 동일 전략)
fn kill_pid_group(pid: u32) {
    #[cfg(unix)]
    {
        // start_tunnel에서 process_group(0)으로 스폰했으므로 pgid == pid.
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

/// 앱 종료 시 실행 중이던 모든 터널을 정리합니다.
pub fn kill_all_tunnels(registry: &TunnelRegistry) {
    let pids: Vec<u32> = {
        let mut tunnels = registry.tunnels.lock().unwrap();
        tunnels.drain().map(|(_, t)| t.pid).collect()
    };
    for pid in pids {
        kill_pid_group(pid);
    }
}
