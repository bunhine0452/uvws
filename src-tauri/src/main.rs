// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // GUI apps on macOS/Linux don't inherit the user's shell PATH.
    // We manually append common installation paths for `uv`(및 git/kill/lsof/cloudflared)
    // 를 환경 변수에 보강한다. 존재하지 않는 경로를 넣어도 무해하다(런타임에 무시됨).
    #[cfg(unix)]
    if let Some(path) = std::env::var_os("PATH") {
        let mut paths = std::env::split_paths(&path).collect::<Vec<_>>();
        let mut additional_paths = vec![
            std::path::PathBuf::from("/opt/homebrew/bin"), // macOS (Apple Silicon Homebrew)
            std::path::PathBuf::from("/usr/local/bin"),    // macOS/Linux 공통
            std::path::PathBuf::from("/usr/bin"),          // Linux 기본 시스템 바이너리
            std::path::PathBuf::from("/bin"),              // Linux 기본 시스템 바이너리
        ];
        
        if let Ok(home) = std::env::var("HOME") {
            let home_path = std::path::PathBuf::from(home);
            additional_paths.push(home_path.join(".cargo/bin"));
            additional_paths.push(home_path.join(".local/bin"));
        }
        
        for p in additional_paths {
            if !paths.contains(&p) {
                paths.push(p);
            }
        }
        
        if let Ok(new_path) = std::env::join_paths(paths) {
            std::env::set_var("PATH", new_path);
        }
    }

    tauri_app_lib::run()
}
