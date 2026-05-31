use std::path::Path;
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

    if has_req {
        cmd.arg("pip").arg("install").arg("-r").arg("requirements.txt");
    } else if has_toml && p.join("uv.lock").exists() {
        cmd.arg("sync");
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
