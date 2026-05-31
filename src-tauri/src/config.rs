use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    pub git_url: Option<String>,
    pub run_command: String,
    pub env: HashMap<String, String>,
    pub status: String, // "Stopped" | "Installing" | "Running" | "Error"
    #[serde(default)]
    pub python_path: Option<String>,
    #[serde(default)]
    pub icon_color: Option<String>,
    #[serde(skip_deserializing, default)]
    pub port: Option<u16>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppConfig {
    pub default_workspace: String,
    pub projects: Vec<Project>,
}

pub struct ConfigManager {
    config_path: PathBuf,
}

impl ConfigManager {
    pub fn new(app_handle: &tauri::AppHandle) -> Self {
        let mut path = app_handle
            .path()
            .app_config_dir()
            .unwrap_or_else(|_| PathBuf::from("./"));

        fs::create_dir_all(&path).ok();
        path.push("config.json");

        ConfigManager { config_path: path }
    }

    pub fn read_config(&self) -> AppConfig {
        if !self.config_path.exists() {
            return AppConfig {
                default_workspace: "".to_string(),
                projects: vec![],
            };
        }

        let content = fs::read_to_string(&self.config_path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_else(|_| AppConfig {
            default_workspace: "".to_string(),
            projects: vec![],
        })
    }

    pub fn write_config(&self, config: &AppConfig) -> Result<(), String> {
        let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
        fs::write(&self.config_path, content).map_err(|e| e.to_string())?;
        Ok(())
    }
}
