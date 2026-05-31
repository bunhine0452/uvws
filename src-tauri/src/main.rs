// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // GUI apps on macOS don't inherit the user's shell PATH.
    // We manually append common installation paths for `uv` to the environment.
    #[cfg(unix)]
    if let Some(path) = std::env::var_os("PATH") {
        let mut paths = std::env::split_paths(&path).collect::<Vec<_>>();
        let mut additional_paths = vec![
            std::path::PathBuf::from("/opt/homebrew/bin"),
            std::path::PathBuf::from("/usr/local/bin"),
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
