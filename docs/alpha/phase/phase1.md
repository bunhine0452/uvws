# Phase 1: 기반 다지기 및 Tauri 환경 구축

Phase 1의 목표는 Tauri v2와 React+TypeScript 환경을 구축하고, 애플리케이션의 설정 파일(JSON)을 다루는 Rust 백엔드 기능과 이를 CRUD 할 수 있는 기본적인 UI 화면을 완성하는 것입니다.

---

## 1. 개발 내용 요약
- **Tauri v2 + React(Vite) + TS 프로젝트 초기화**
- **로컬 설정 매니저(Rust)**: 프로젝트 설정 정보(JSON)를 로컬 디바이스의 AppData 디렉토리에 읽고 쓰기
- **Tauri Commands 구현**: 프로젝트 추가, 목록 조회, 업데이트, 삭제 (CRUD)
- **UI 대시보드 기본 마크업 & 레이아웃**: 사이드바, 메인 영역, 프로젝트 추가 모달

---

## 2. 세부 아키텍처 및 구현 코드 예시

### 2.1. 프로젝트 폴더 구조
```text
PySpace/
├── src/                  # React Frontend (Vite)
│   ├── assets/           # 정적 파일 (로고 등)
│   ├── components/       # UI 컴포넌트 (Sidebar, Terminal, SettingsModal)
│   ├── App.tsx           # 메인 애플리케이션 진입점
│   ├── index.css         # 글로벌 CSS 스타일 및 테마 정의
│   └── main.tsx          # React 마운트
├── src-tauri/            # Tauri Rust Backend
│   ├── src/
│   │   ├── config.rs     # 설정 파일 CRUD 핵심 로직
│   │   └── main.rs       # Tauri App 진입점 및 Command 등록
│   ├── Cargo.toml        # Rust 의존성 설정
│   └── tauri.conf.json   # Tauri 빌드 및 권한 설정 (v2 규격)
└── package.json          # Node.js 패키지 설정
```

### 2.2. [Backend] 설정 파일 모델 및 매니저 (`src-tauri/src/config.rs`)
사용자의 프로젝트 설정 목록을 로컬 디렉토리(macOS의 경우 `~/Library/Application Support/com.pyspace.app/config.json`)에 저장합니다.

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    pub git_url: Option<String>,
    pub entrypoint: String,
    pub args: String,
    pub env: HashMap<String, String>,
    pub status: String, // "Stopped" | "Installing" | "Running" | "Error"
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
        let content = serde_json::to_string_pretty(config)
            .map_err(|e| e.to_string())?;
        fs::write(&self.config_path, content)
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}
```

### 2.3. [Backend] Tauri Commands 등록 (`src-tauri/src/main.rs`)
프론트엔드에서 호출할 수 있도록 CRUD 명령을 정의하고 Tauri State에 `ConfigManager`를 등록합니다.

```rust
// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;

use config::{AppConfig, ConfigManager, Project};
use std::sync::Mutex;
use tauri::State;

struct AppState {
    config_manager: Mutex<ConfigManager>,
}

#[tauri::command]
fn get_projects(state: State<'_, AppState>) -> Result<Vec<Project>, String> {
    let manager = state.config_manager.lock().unwrap();
    Ok(manager.read_config().projects)
}

#[tauri::command]
fn add_project(state: State<'_, AppState>, mut project: Project) -> Result<Vec<Project>, String> {
    let manager = state.config_manager.lock().unwrap();
    let mut config = manager.read_config();
    
    // 중복 ID 확인 후 삽입
    project.status = "Stopped".to_string();
    config.projects.push(project);
    
    manager.write_config(&config)?;
    Ok(config.projects)
}

#[tauri::command]
fn delete_project(state: State<'_, AppState>, id: String) -> Result<Vec<Project>, String> {
    let manager = state.config_manager.lock().unwrap();
    let mut config = manager.read_config();
    
    config.projects.retain(|p| p.id != id);
    
    manager.write_config(&config)?;
    Ok(config.projects)
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let config_manager = ConfigManager::new(&app.handle());
            app.manage(AppState {
                config_manager: Mutex::new(config_manager),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_projects,
            add_project,
            delete_project
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 3. 프론트엔드 레이아웃 및 스타일 가이드

### 3.1. 기본 레이아웃 구성 (`App.tsx`)
```tsx
import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

interface Project {
  id: string;
  name: string;
  path: string;
  entrypoint: string;
  args: string;
  status: string;
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const list: Project[] = await invoke("get_projects");
      setProjects(list);
      if (list.length > 0 && !selectedProjectId) {
        setSelectedProjectId(list[0].id);
      }
    } catch (err) {
      console.error("Failed to load projects", err);
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="app-container">
      {/* 1. 사이드바 */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>PySpace</h2>
        </div>
        <ul className="project-list">
          {projects.map((p) => (
            <li
              key={p.id}
              className={`project-item ${selectedProjectId === p.id ? "active" : ""}`}
              onClick={() => setSelectedProjectId(p.id)}
            >
              <span className={`status-dot ${p.status.toLowerCase()}`}></span>
              <span className="project-name">{p.name}</span>
            </li>
          ))}
        </ul>
        <button className="btn-add-project">+ Add Project</button>
      </aside>

      {/* 2. 메인 대시보드 */}
      <main className="main-content">
        {selectedProject ? (
          <>
            <header className="main-header">
              <div>
                <h1>{selectedProject.name}</h1>
                <p className="project-path">{selectedProject.path}</p>
              </div>
              <div className="header-actions">
                <button className="btn-run">Run Project</button>
                <button className="btn-stop" disabled>Stop</button>
              </div>
            </header>
            
            {/* 임시 터미널 로그 플레이스홀더 (Phase 2에서 구현) */}
            <div className="terminal-placeholder">
              <p className="console-line">> Ready to launch project...</p>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <p>등록된 프로젝트가 없습니다. 왼쪽 아래 버튼을 눌러 추가하세요.</p>
          </div>
        )}
      </main>
    </div>
  );
}
```

### 3.2. 핵심 디자인 토큰 (`index.css` 예시)
```css
:root {
  --bg-app: #0f1115;
  --bg-sidebar: #161920;
  --bg-panel: #1e222b;
  --border-color: #2b313e;
  --text-main: #e2e8f0;
  --text-muted: #94a3b8;
  --color-accent: #10b981; /* Neon Green */
  --color-error: #ef4444;  /* Soft Red */
  --color-warning: #f59e0b;/* Amber */
  --font-sans: 'Inter', system-ui, sans-serif;
}

body {
  margin: 0;
  background-color: var(--bg-app);
  color: var(--text-main);
  font-family: var(--font-sans);
}

.app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.sidebar {
  width: 260px;
  background-color: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px;
  background-color: var(--bg-app);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 8px;
}

.status-dot.running { background-color: var(--color-accent); }
.status-dot.stopped { background-color: var(--text-muted); }
.status-dot.installing { background-color: var(--color-warning); }
.status-dot.error { background-color: var(--color-error); }
```

---

## 4. 검증 항목 (Verification)
- **Tauri Dev 구동**: `npm run tauri dev`를 통해 데스크톱 창이 정상적으로 뜨는지 확인.
- **설정 파일 생성 검증**: 앱 실행 후 `config.json` 파일이 OS 로컬 앱 설정 경로에 정상 생성되는지 검증.
- **UI CRUD 검증**: React 화면에서 임의의 데이터를 추가했을 때 사이드바 목록이 즉시 갱신되며, 다시 시작해도 유지되는지 테스트.
