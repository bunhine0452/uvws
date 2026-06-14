---
schema_version: 1
type: feature
slug: open-project-folder
status: done
difficulty: verylow
created_at: "2026-06-15T03:49:54+09:00"
session_id: "manual-20260615-034954"
agent:
  id: claude-code
  version: "4.8"
language: ko
verified_by_user: false
files_touched:
  - path: src/App.tsx
    op: update
    bytes_added: 520
    bytes_removed: 40
  - path: src/i18n.tsx
    op: update
    bytes_added: 160
    bytes_removed: 0
  - path: src/App.css
    op: update
    bytes_added: 110
    bytes_removed: 0
  - path: src-tauri/capabilities/default.json
    op: update
    bytes_added: 35
    bytes_removed: 0
related:
  - ../../20260615/Features_to_add/0350_feature_linux-build-support.md
tags: ["opener", "ux", "file-manager", "header-actions"]
---

[x] 프로젝트 경로 폴더를 OS 파일 관리자에서 바로 여는 "폴더 열기" 버튼

## 추가 기능
프로젝트 헤더 액션 줄에 **폴더 열기** 버튼(FolderOpen 아이콘)을 추가. 클릭하면
선택된 프로젝트의 작업 경로(`editPath || proj.path`)를 OS 파일 관리자
(Finder / 탐색기 / 파일 매니저)에서 **폴더 내용이 보이도록** 연다.

- 프론트(`App.tsx`): `openPath`를 `@tauri-apps/plugin-opener`에서 import,
  `handleOpenFolder()` 추가(실패 시 `failed_open_folder` 다이얼로그), Copy Log 버튼 앞에
  `.folder-btn` 버튼 배치.
- 권한(`capabilities/default.json`): `opener:default`에는 `open-path`가 없어
  `opener:allow-open-path`(스코프 없이 허용되는 변형)를 추가. `reveal-item-in-dir`이 아닌
  `open-path`를 쓴 이유는 사용자가 "폴더 내용 열기"를 택했기 때문(상위 강조 X).
- i18n: ko/en `open_folder`, `failed_open_folder` 추가.
- CSS: `.folder-btn:hover`에 copy-btn과 동일한 accent 색 hover.

## 동작 흐름
프로젝트 선택 → 헤더의 "폴더 열기" 클릭 → `openPath(경로)` invoke →
OS 기본 파일 관리자가 해당 디렉터리를 연다. macOS=Finder, Windows=탐색기,
Linux=xdg-open 기본 파일 매니저(3개 OS 공통 동작).

## 검증
`pnpm build`(tsc + vite) 통과, `cargo check` 통과. 런타임에서 실제 폴더가 열리는지는
사용자 수동 확인 권장(headless 환경에서 GUI 파일 관리자 검증 불가).
