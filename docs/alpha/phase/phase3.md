# Phase 3: uv 연동 및 포트 감지 자동화

Phase 3의 목표는 Python 프로젝트의 핵심 종속성을 완벽히 분리 관리할 수 있도록 **`uv` 패키지 매니저**를 연동하고, 프로젝트가 정상 실행되었을 때 터미널 로그 스트림을 실시간 분석하여 **호스트 포트를 자동 검출**하는 것입니다.

---

## 1. 개발 내용 요약
- **`uv` 환경 검사 및 안내**: 시스템 내 `uv` 실행 파일 존재 여부 진단.
- **가상 환경 생성 (`uv venv`)**: 프로젝트 경로에 `.venv` 폴더가 없을 경우 자동 환경 조성.
- **의존성 설치 자동화 (`uv pip` / `uv sync`)**: `requirements.txt` 또는 `pyproject.toml` 감지 시 자동으로 패키지 동기화 진행.
- **로그 정규식 매칭 기반 포트 검출**: 로그 메시지 중 웹 서버 포트 구문을 분석하여 브라우저 활성화 버튼 연동.

---

## 2. 세부 아키텍처 및 구현 코드 예시

### 2.1. [Backend] `uv` 및 가상환경 오케스트레이터 (`src-tauri/src/uv.rs`)
시스템의 `uv` 설치 상황을 진단하고 가상환경 격리 실행 파일(`.venv/bin/python` 또는 `.venv/Scripts/python.exe`)의 절대 경로를 획득하여 프로젝트 실행 단계에 주입합니다.

```rust
use std::path::{Path, PathBuf};
use std::process::Command as StdCommand;
use tokio::process::Command as TokioCommand;

/// 시스템에 uv가 설치되어 있는지 확인합니다.
pub fn is_uv_installed() -> bool {
    #[cfg(target_os = "windows")]
    let check_cmd = "where";
    #[cfg(not(target_os = "windows"))]
    let check_cmd = "which";

    StdCommand::new(check_cmd)
        .arg("uv")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// 가상환경의 파이썬 인터프리터 경로를 반환합니다.
pub fn get_venv_python_path(project_path: &str) -> PathBuf {
    let p = Path::new(project_path);
    #[cfg(target_os = "windows")]
    let python_relative = ".venv\\Scripts\\python.exe";
    #[cfg(not(target_os = "windows"))]
    let python_relative = ".venv/bin/python";

    p.join(python_relative)
}

/// 가상환경(.venv)이 존재하지 않는 경우 새로 만듭니다.
pub async fn create_venv(project_path: &str) -> Result<(), String> {
    let has_venv = Path::new(project_path).join(".venv").exists();
    if has_venv {
        return Ok(());
    }

    if !is_uv_installed() {
        return Err("Astral 'uv' is not installed in the system. Please install it first.".to_string());
    }

    let mut cmd = TokioCommand::new("uv");
    cmd.current_dir(project_path).arg("venv");

    let status = cmd.status().await.map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err("Failed to initialize virtual environment using 'uv venv'".to_string())
    }
}

/// requirements.txt 또는 pyproject.toml 의존성을 설치합니다.
pub async fn install_dependencies(project_path: &str) -> Result<(), String> {
    let p = Path::new(project_path);
    let has_req = p.join("requirements.txt").exists();
    let has_toml = p.join("pyproject.toml").exists();

    if !has_req && !has_toml {
        return Ok(()); // 의존성 파일이 없으면 그냥 건너뜀
    }

    let mut cmd = TokioCommand::new("uv");
    cmd.current_dir(project_path);

    if has_toml && p.join("uv.lock").exists() {
        cmd.arg("sync");
    } else if has_req {
        cmd.arg("pip").arg("install").arg("-r").arg("requirements.txt");
    } else {
        cmd.arg("pip").arg("install").arg(".");
    }

    let status = cmd.status().await.map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err("Failed to install dependencies via uv".to_string())
    }
}
```

### 2.2. [Backend] 프로젝트 실행 로직에 가상환경 및 포트 감지 필터 통합
Phase 2에서 작성했던 `start_project`를 확장하여, 구동 전 `create_venv`와 `install_dependencies`를 실행하고 로그 데이터 전송 중 Regex 매칭을 돌려 포트를 실시간 감출합니다.

```rust
// src-tauri/src/runner.rs의 일부 수정
use once_cell::sync::Lazy;
use regex::Regex;
use crate::uv; // 위에서 작성한 uv 모듈

static PORT_REGEX: Lazy<Regex> = Lazy::new(|| {
    // http://localhost:8188, http://127.0.0.1:7860, http://0.0.0.0:8501 포맷 파싱
    Regex::new(r"https?://(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::\]):(\d+)").unwrap()
});

#[tauri::command]
pub async fn start_project_v3(
    id: String,
    path: String,
    entrypoint: String,
    args: String,
    registry: tauri::State<'_, Arc<ProcessRegistry>>,
    app_handle: AppHandle,
) -> Result<String, String> {
    // 1. 가상환경 및 의존성 사전 빌드
    app_handle.emit(&format!("status-changed-{}", id), "Installing").ok();
    
    // 로그 스트림에 빌드 진행 상황 안내 전송
    app_handle.emit(&format!("log-stream-{}", id), "[PySpace] Checking uv virtual environment...\r\n").ok();
    uv::create_venv(&path).await?;
    
    app_handle.emit(&format!("log-stream-{}", id), "[PySpace] Installing/Syncing Python dependencies...\r\n").ok();
    uv::install_dependencies(&path).await?;

    // 2. 가상환경 파이썬 바이너리 설정
    let python_bin = uv::get_venv_python_path(&path);
    if !python_bin.exists() {
        return Err("Virtual environment python binary not found.".to_string());
    }

    let argument_list: Vec<&str> = args.split_whitespace().collect();
    let mut command = TokioCommand::new(python_bin);
    
    command
        .current_dir(&path)
        .arg(&entrypoint)
        .args(&argument_list)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let mut child = command.spawn().map_err(|e| format!("Spawn failed: {}", e))?;
    let pid = child.id().ok_or("Failed to get PID")?;
    let stdout = child.stdout.take().ok_or("Failed to open stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to open stderr")?;
    
    let (kill_tx, kill_rx) = oneshot::channel::<()>();
    {
        let mut active = registry.active_processes.lock().unwrap();
        active.insert(id.clone(), RunningProcess { pid, kill_tx });
    }

    app_handle.emit(&format!("status-changed-{}", id), "Running").ok();

    let app_clone = app_handle.clone();
    let id_clone = id.clone();
    let registry_clone = Arc::clone(&registry);

    tokio::spawn(async move {
        let mut stdout_reader = BufReader::new(stdout).lines();
        let mut stderr_reader = BufReader::new(stderr).lines();
        
        let id_for_loop = id_clone.clone();
        let app_for_loop = app_clone.clone();

        let stdout_handle = tokio::spawn(async move {
            while let Ok(Some(line)) = stdout_reader.next_line().await {
                // 실시간 포트 정규식 검사
                if let Some(caps) = PORT_REGEX.captures(&line) {
                    if let Some(port_str) = caps.get(1) {
                        if let Ok(port) = port_str.as_str().parse::<u16>() {
                            app_for_loop.emit(&format!("port-detected-{}", id_for_loop), port).ok();
                        }
                    }
                }
                app_for_loop.emit(&format!("log-stream-{}", id_for_loop), format!("{}\r\n", line)).ok();
            }
        });

        let id_for_err = id_clone.clone();
        let app_for_err = app_clone.clone();
        let stderr_handle = tokio::spawn(async move {
            while let Ok(Some(line)) = stderr_reader.next_line().await {
                if let Some(caps) = PORT_REGEX.captures(&line) {
                    if let Some(port_str) = caps.get(1) {
                        if let Ok(port) = port_str.as_str().parse::<u16>() {
                            app_for_err.emit(&format!("port-detected-{}", id_for_err), port).ok();
                        }
                    }
                }
                app_for_err.emit(&format!("log-stream-{}", id_for_err), format!("\x1b[31m{}\x1b[0m\r\n", line)).ok();
            }
        });

        tokio::select! {
            status = child.wait() => {
                let status_str = status.map(|s| s.to_string()).unwrap_or_else(|e| e.to_string());
                app_clone.emit(&format!("log-stream-{}", id_clone), format!("\r\n[PySpace] Exit: {}\r\n", status_str)).ok();
            }
            _ = kill_rx => {
                let _ = child.kill().await;
            }
        }

        stdout_handle.abort();
        stderr_handle.abort();
        
        {
            let mut active = registry_clone.active_processes.lock().unwrap();
            active.remove(&id_clone);
        }
        app_clone.emit(&format!("status-changed-{}", id_clone), "Stopped").ok();
    });

    Ok(format!("Started successfully (PID: {})", pid))
}
```

---

## 3. 프론트엔드 포트 연동 및 오픈 브라우저 동작
포트가 동적으로 검출되면 브라우저 열기 버튼이 활성화되어 사용자가 즉각 해당 포트로 접근 가능하게 합니다.

```tsx
// App.tsx 내 프로젝트 관리 제어 부분
import { open } from "@tauri-apps/plugin-shell"; // Tauri Shell 플러그인을 사용하여 시스템 기본 브라우저 제어

const [detectedPort, setDetectedPort] = useState<number | null>(null);

useEffect(() => {
  if (!selectedProjectId) return;
  setDetectedPort(null); // 프로젝트 변경 시 포트 리셋

  const unsubPort = listen<number>(`port-detected-${selectedProjectId}`, (event) => {
    setDetectedPort(event.payload);
  });

  return () => {
    unsubPort.then(fn => fn());
  };
}, [selectedProjectId]);

const handleOpenBrowser = async () => {
  if (!detectedPort) return;
  // 시스템 기본 브라우저를 구동하여 링크 오픈
  await open(`http://localhost:${detectedPort}`);
};

// ... JSX 렌더링 영역 ...
<button 
  className="btn-open-browser" 
  disabled={!detectedPort || status !== "Running"}
  onClick={handleOpenBrowser}
>
  🌐 Open Browser {detectedPort ? `(Port: ${detectedPort})` : ""}
</button>
```

---

## 4. 검증 항목 (Verification)
- **가상 격리 유효성 테스트**: PySpace를 통하지 않고 시스템 전체에 깔린 글로벌 파이썬 라이브러리와 무관하게, PySpace 폴더 하위에 생성된 `.venv`에만 패키지가 격리 설치되는지 `sys.path` 조사 코드를 띄워 점검.
- **포트 탐지 정밀도**: ComfyUI(기본 8188), Gradio(기본 7860), Streamlit(기본 8501) 서버를 구동해 콘솔 로그가 뜰 때 포트 값이 지연 없이 프론트엔드로 수신되는지 확인.
- **다양한 로그 포맷 호환**: `0.0.0.0:포트` 또는 IPv6 형식인 `[::]:포트`가 정규식에 걸리는지 패턴 단위 유닛 테스트 구동.
