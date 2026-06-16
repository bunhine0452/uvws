---
schema_version: 1
type: chore
slug: release-v0.6.0
status: done
difficulty: low
created_at: "2026-06-16T19:25:00+09:00"
session_id: "manual-20260616-190212"
agent:
  id: claude-code
  version: "4.8"
language: ko
verified_by_user: false
files_touched:
  - path: package.json
    op: update
    bytes_added: 1
    bytes_removed: 1
  - path: src-tauri/Cargo.toml
    op: update
    bytes_added: 1
    bytes_removed: 1
  - path: src-tauri/tauri.conf.json
    op: update
    bytes_added: 1
    bytes_removed: 1
  - path: src-tauri/Cargo.lock
    op: update
    bytes_added: 1
    bytes_removed: 1
  - path: src/App.tsx
    op: update
    bytes_added: 1
    bytes_removed: 1
  - path: CHANGELOG.md
    op: update
    bytes_added: 620
    bytes_removed: 0
  - path: src-tauri/src/lib.rs
    op: update
    bytes_added: 120
    bytes_removed: 800
  - path: src-tauri/Cargo.toml
    op: update
    bytes_added: 90
    bytes_removed: 220
related:
  - ../Features_to_add/1902_feature_theme-picker-and-transparency.md
tags: ["release", "v0.6.0", "versioning", "windows-scope", "changelog"]
---

[x] v0.6.0 릴리스 — 테마 선택 + 창/UI 투명도 기능 배포

테마 선택 + 창 투명도 + UI 글래스 강도 기능([[1902_feature_theme-picker-and-transparency]])
을 v0.6.0으로 배포한다.

## 릴리스 전 하드닝 (Windows 스코프 축소)
태그 푸시는 4개 플랫폼(mac aarch64/x64, Windows, Linux) CI 빌드를 트리거하는데,
`set_window_opacity`의 Windows 브랜치는 이 macOS 개발기에서 컴파일 검증이 불가했다
(`cargo check --target x86_64-pc-windows-gnu`가 mingw C 컴파일러 부재로 내 크레이트
도달 전에 실패). 게다가 Windows는 WebView2 + 레이어드 윈도우 알파가 런타임에서도
불안정한 알려진 문제가 있다. → **창 투명도는 macOS + Linux만 지원, Windows는 no-op**
으로 축소. `windows` 직접 의존성 제거 → Windows CI 컴파일 위험 0. (테마·글래스 강도는
Windows 포함 전 플랫폼 정상.)

## 변경
- 버전 0.5.1 → **0.6.0** (minor; 신규 기능): `package.json`, `src-tauri/Cargo.toml`,
  `src-tauri/tauri.conf.json` 동시 갱신 + `cargo check`로 `Cargo.lock` 재동기화.
  `App.tsx`의 cosmetic fallback도 0.6.0.
- `CHANGELOG.md`에 `## v0.6.0` 섹션(테마 선택 / 창 투명도 / UI 글래스 강도). CI가 이
  섹션을 릴리스 노트 + 인앱 업데이터 노트로 주입.
- `lib.rs`/`Cargo.toml`: Windows 네이티브 opacity 브랜치 + `windows` 의존성 제거.

## 검증
`pnpm build`(tsc + vite) 통과, `src-tauri` `cargo check`(0.6.0) 통과. Cargo.lock의
`tauri-app` 버전 0.6.0 확인. 커밋 후 `v0.6.0` 주석 태그 푸시 → release.yml 트리거.
**릴리스 후 `gh release view v0.6.0 --json assets`로 `latest.json` 산출물 존재를 반드시
확인**(인앱 자동 업데이터가 이 파일을 가져감).
