---
schema_version: 1
type: bug
slug: "macos-gui-path-not-found-uv"
status: done
difficulty: medium
created_at: "2026-05-31T16:12:38+09:00"
updated_at: "2026-05-31T16:15:00+09:00"
session_id: "20260531-004"
agent:
  id: "antigravity"
  version: "1.0"
language: "ko"
verified_by_user: true
files_touched:
  - path: "src-tauri/src/main.rs"
    op: update
    bytes_added: 800
    bytes_removed: 0
related: []
tags:
  - "macos"
  - "path"
  - "env"
  - "uv"
  - "gui"
---

[x] macOS GUI 환경에서 uv 실행 파일을 찾지 못하는 문제 수정

## 발생 원인

macOS에서 앱을 Finder나 Dock을 통해 실행할 경우, 터미널 환경(`.zshrc`, `.bashrc` 등)의 `PATH` 환경변수를 상속받지 않습니다. 이로 인해 `uv`가 설치된 경로(`~/.cargo/bin`, `~/.local/bin`, `/opt/homebrew/bin` 등)가 `PATH`에 포함되지 않아 `No such file or directory (os error 2)` 오류가 발생했습니다.

## 해결 방법

`src-tauri/src/main.rs`의 `main()` 함수가 시작될 때, 현재 시스템의 `PATH`를 읽어온 뒤 `uv`가 주로 설치되는 공통 경로들을 명시적으로 `PATH` 환경변수에 추가(Append)하도록 수정했습니다.

추가된 경로:
- `/opt/homebrew/bin`
- `/usr/local/bin`
- `~/.cargo/bin`
- `~/.local/bin`

## 검증

- 수정된 코드를 적용하여 `v0.1.1` 태그로 릴리스 배포 완료.
- Finder에서 실행 시 `PATH`에 경로들이 정상적으로 포함되어 `uv` 명령어가 작동함을 확인.
