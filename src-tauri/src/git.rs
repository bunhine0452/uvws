use serde::Serialize;
use tokio::process::Command;

#[derive(Serialize, Default)]
pub struct GitStatus {
    pub is_repo: bool,
    pub branch: String,
    pub ahead: u32,
    pub behind: u32,
    pub staged: u32,
    pub modified: u32,
    pub untracked: u32,
    pub has_remote: bool,
    pub has_upstream: bool,
}

#[derive(Serialize)]
pub struct GitCommit {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub date: String,
}

/// 지정한 경로에서 git 하위 명령을 실행합니다.
async fn git(path: &str, args: &[&str]) -> Result<std::process::Output, String> {
    Command::new("git")
        .current_dir(path)
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to run git: {}", e))
}

/// 프로젝트 폴더의 Git 상태(브랜치 / ahead·behind / 변경 파일 수)를 조회합니다.
#[tauri::command]
pub async fn git_status(path: String) -> Result<GitStatus, String> {
    let check = git(&path, &["rev-parse", "--is-inside-work-tree"]).await?;
    if !check.status.success() {
        return Ok(GitStatus::default());
    }

    let mut status = GitStatus {
        is_repo: true,
        ..Default::default()
    };

    if let Ok(out) = git(&path, &["rev-parse", "--abbrev-ref", "HEAD"]).await {
        status.branch = String::from_utf8_lossy(&out.stdout).trim().to_string();
    }

    if let Ok(out) = git(&path, &["remote"]).await {
        status.has_remote = !String::from_utf8_lossy(&out.stdout).trim().is_empty();
    }

    // 업스트림 대비 ahead/behind 커밋 수
    if let Ok(out) = git(
        &path,
        &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
    )
    .await
    {
        if out.status.success() {
            status.has_upstream = true;
            let s = String::from_utf8_lossy(&out.stdout);
            let parts: Vec<&str> = s.split_whitespace().collect();
            if parts.len() == 2 {
                status.ahead = parts[0].parse().unwrap_or(0);
                status.behind = parts[1].parse().unwrap_or(0);
            }
        }
    }

    // 작업트리 변경 사항 집계 (--porcelain)
    if let Ok(out) = git(&path, &["status", "--porcelain"]).await {
        for line in String::from_utf8_lossy(&out.stdout).lines() {
            let mut chars = line.chars();
            let (Some(x), Some(y)) = (chars.next(), chars.next()) else {
                continue;
            };
            if x == '?' && y == '?' {
                status.untracked += 1;
            } else {
                if x != ' ' {
                    status.staged += 1;
                }
                if y != ' ' {
                    status.modified += 1;
                }
            }
        }
    }

    Ok(status)
}

/// 최근 커밋 목록을 조회합니다.
#[tauri::command]
pub async fn git_log(path: String, limit: u32) -> Result<Vec<GitCommit>, String> {
    let n = format!("-{}", limit.max(1));
    // 필드 구분자로 Unit Separator(0x1f)를 사용해 안전하게 파싱
    let fmt = "--pretty=format:%h%x1f%s%x1f%an%x1f%ar";
    let out = git(&path, &["log", &n, fmt]).await?;
    if !out.status.success() {
        return Ok(vec![]);
    }

    let mut commits = Vec::new();
    for line in String::from_utf8_lossy(&out.stdout).lines() {
        let f: Vec<&str> = line.split('\u{1f}').collect();
        if f.len() == 4 {
            commits.push(GitCommit {
                hash: f[0].to_string(),
                message: f[1].to_string(),
                author: f[2].to_string(),
                date: f[3].to_string(),
            });
        }
    }
    Ok(commits)
}

/// git 액션을 실행하고 사람이 읽을 수 있는 결과/에러 메시지를 반환합니다.
async fn run_git_action(path: &str, args: &[&str]) -> Result<String, String> {
    let out = git(path, args).await?;
    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();

    if out.status.success() {
        let msg = if !stdout.is_empty() { stdout } else { stderr };
        Ok(if msg.is_empty() {
            "Done".to_string()
        } else {
            msg
        })
    } else {
        Err(if !stderr.is_empty() { stderr } else { stdout })
    }
}

#[tauri::command]
pub async fn git_fetch(path: String) -> Result<String, String> {
    run_git_action(&path, &["fetch", "--all", "--prune"]).await
}

#[tauri::command]
pub async fn git_pull(path: String) -> Result<String, String> {
    run_git_action(&path, &["pull", "--ff-only"]).await
}

#[tauri::command]
pub async fn git_push(path: String) -> Result<String, String> {
    run_git_action(&path, &["push"]).await
}
