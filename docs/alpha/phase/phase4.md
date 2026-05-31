# Phase 4: 폴리싱 & 크로스 플랫폼 배포

Phase 4의 목표는 애플리케이션의 예외 상황을 완벽하게 예방하고, 개발 편의성을 높이는 UI/UX 미세 조정을 수행하며, macOS 및 Windows용 빌드(패키징) 파이프라인을 최종 구성하는 것입니다.

---

## 1. 개발 내용 요약
- **안정성 강화 (Robustness)**:
  - **자식 프로세스 누수 방지**: 앱 강제 종료 시 백엔드 상의 좀비 프로세스 자동 수거 (`Tauri Exit Hook`).
  - **포트 충돌 사전 예방**: 실행 전 대상 포트가 선점되었는지 사전 바인딩 테스트 수행.
- **UI/UX 폴리싱**:
  - Xterm.js 텍스트 검색 및 터미널 오토스크롤 락(Auto-scroll Lock) 구현.
  - 에디터 연동 기능: "Open in VS Code" / "Finder(탐색기)에서 열기" 기능 지원.
- **패키징 및 배포 자동화**:
  - Tauri 번들러 설정을 조율하여 `.dmg` (macOS), `.msi` / `.exe` (Windows) 생성.
  - GitHub Actions CI/CD 스크립트를 통한 릴리즈 자동화.

---

## 2. 세부 아키텍처 및 구현 코드 예시

### 2.1. [Backend] 프로세스 안전 청소 및 포트 선점 여부 검증
앱이 예기치 않게 닫히거나 정상 종료될 때 구동 중이던 자식 파이썬 프로세스들이 좀비 프로세스로 남지 않도록 완전히 제거하고, 구동 전 포트 충돌 여부를 체크합니다.

```rust
// src-tauri/src/main.rs 수정 (라이프사이클 훅 추가 및 포트 바인딩 테스트)
use std::net::TcpListener;
use crate::runner::ProcessRegistry;
use tauri::{RunEvent, Manager};

/// 특정 포트가 현재 열려 있거나 사용 중인지 확인합니다.
#[tauri::command]
fn check_port_availability(port: u16) -> bool {
    // 127.0.0.1의 해당 포트에 바인딩을 시도합니다.
    // 바인딩이 성공하면 포트가 비어 있는 상태이고, 실패하면 이미 사용 중인 상태입니다.
    TcpListener::bind(("127.0.0.1", port)).is_ok()
}

fn main() {
    let process_registry = std::sync::Arc::new(ProcessRegistry::default());
    let registry_for_hook = std::sync::Arc::clone(&process_registry);

    tauri::Builder::default()
        .setup(move |app| {
            app.manage(process_registry);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_port_availability,
            // ... 기존 커맨드들 ...
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |app_handle, event| match event {
            // 앱이 완전히 종료될 때 호출되는 수명 주기 훅
            RunEvent::Exit | RunEvent::ExitRequested { .. } => {
                let mut active = registry_for_hook.active_processes.lock().unwrap();
                for (id, process) in active.drain() {
                    // 실행 중인 모든 자식 프로세스를 정리합니다.
                    println!("[PySpace Cleanup] Killing orphaned process ID: {} (PID: {})", id, process.pid);
                    let _ = process.kill_tx.send(());
                }
            }
            _ => {}
        });
}
```

### 2.2. [Frontend] 개발 편의 기능 연동 (VS Code 및 Finder 오픈)
사용자가 작업 중인 프로젝트 디렉토리를 원클릭으로 에디터에서 열어 볼 수 있도록 Tauri Shell API를 활용합니다.

```tsx
import { Command } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";

interface SelectedProjectProps {
  path: string;
}

export function ProjectActions({ path }: SelectedProjectProps) {
  const openInVSCode = async () => {
    try {
      // 'code <project_path>' 명령어 실행
      const cmd = Command::create("code", [path]);
      await cmd.execute();
    } catch (err) {
      alert("VS Code 실행에 실패했습니다. PATH 설정을 확인해주세요.");
    }
  };

  const openInFinder = async () => {
    // macOS의 경우 open 커맨드로 디렉토리를 띄우고 Windows는 explorer.exe 사용
    const opener = window.__TAURI_INTERNALS__?.metadata?.platform === "windows" 
      ? "explorer.exe" 
      : "open";
    
    const cmd = Command::create(opener, [path]);
    await cmd.execute();
  };

  return (
    <div className="action-row">
      <button onClick={openInVSCode}>💻 Open in VS Code</button>
      <button onClick={openInFinder}>📂 Open Folder</button>
    </div>
  );
}
```

---

## 3. 배포 패키징 및 CI/CD 인프라

### 3.1. `tauri.conf.json` 번들 설정 조율
Tauri 빌드 툴이 릴리즈 바이너리를 만들 때 DMG와 MSI 인스톨러를 함께 래핑하도록 구조화합니다.

```json
{
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "identifier": "com.pyspace.app",
    "macOS": {
      "frameworks": [],
      "minimumSystemVersion": "10.15",
      "exceptionDomain": "",
      "signingIdentity": null,
      "entitlements": null
    },
    "windows": {
      "wix": {
        "language": "ko-KR"
      },
      "nsis": {
        "languages": ["Korean"]
      }
    }
  }
}
```

### 3.2. GitHub Actions 자동화 스크립트 (`.github/workflows/release.yml`)
저장소에 태그(`v*`)가 생성되었을 때 자동으로 멀티 플랫폼 빌드를 트리거하고 패키지 산출물(DMG, MSI)을 릴리즈 페이지에 등록합니다.

```yaml
name: "publish"
on:
  push:
    tags:
      - 'v*'

jobs:
  publish-tauri:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        platform: [macos-latest, windows-latest]

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: setup node
        uses: actions/setup-node@v4
        with:
          node-size: 20
          cache: 'npm'

      - name: install Rust stable
        uses: dtolnay/rust-toolchain@stable

      - name: install dependencies (ubuntu only)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.0-dev libappindicator3-dev librsvg2-dev patchelf

      - name: install frontend dependencies
        run: npm ci

      - name: Build and Publish Tauri app
        uses: tauri-apps/tauri-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: app-v__VERSION__
          releaseName: "PySpace v__VERSION__"
          releaseBody: "Automated production build of PySpace."
          releaseDraft: true
          prerelease: false
```

---

## 4. 검증 항목 (Verification)
- **자식 프로세스 정리 기능 검증**: 고의로 PySpace 앱 프로세스를 강제 종료(`pkill pyspace`)했을 때 백그라운드에서 실행되던 가상환경 내 Python 프로세스가 유실 없이 자동 종료되는지 확인.
- **포트 선점 차단 검증**: 별도의 터미널에서 `nc -l 8188` 또는 다른 툴로 포트를 일부러 차단해 놓고 PySpace를 실행했을 때, 충돌 경고 모달이 동작하며 실행이 제어되는지 확인.
- **설치 프로그램 빌드 동작**: 로컬 빌드 명령어(`npm run tauri build`)를 완료하여 실제로 더블 클릭하여 설치할 수 있는 파일(`.dmg`, `.msi`)이 올바르게 아웃풋 디렉토리에 산출되는지 패키징 완료성 점검.
