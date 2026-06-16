---
schema_version: 1
type: chore
slug: release-v0.7.0
status: done
difficulty: verylow
created_at: "2026-06-16T20:57:23+09:00"
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
    bytes_added: 470
    bytes_removed: 0
related:
  - ../Features_to_add/2048_feature_uv-python-version-management.md
tags: ["release", "v0.7.0", "versioning", "changelog", "smoke-test"]
---

[x] v0.7.0 릴리스 — 프로젝트별 uv Python 버전 관리 배포

[[2048_feature_uv-python-version-management]] 기능을 v0.7.0으로 배포.

## 릴리스 전 스모크 테스트
`pnpm tauri dev`를 백그라운드로 띄워 부팅 확인: Rust 디버그 빌드 `Finished (21s)` →
`Running target/debug/tauri-app`, 로그 전체 패닉/에러 0건, clean exit(0)(크래시 시그널
아님). 즉 투명도 mount 이펙트 + Python 버전 로딩이 시작 시 백엔드를 죽이지 않음을 확인.
(칩 클릭→설치→핀의 *시각적* 인터랙션은 GUI라 미확인 — 코드 컴파일/부팅까지 검증.)

## 변경
- 버전 0.6.0 → **0.7.0** (minor; 신규 기능): `package.json`,
  `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` + `cargo check`로
  `Cargo.lock` 재동기화. `App.tsx` cosmetic fallback도 0.7.0.
- `CHANGELOG.md`에 `## v0.7.0` 섹션(프로젝트별 Python 버전). CI가 릴리스 노트 +
  인앱 업데이터 노트로 주입.

## 검증
`pnpm build`(tsc + vite) 통과, `cargo check`(0.7.0) 통과, Cargo.lock 0.7.0 확인.
커밋 → `v0.7.0` 주석 태그 푸시 → release.yml 트리거. **릴리스 후
`gh release view v0.7.0 --json assets`로 `latest.json` 존재 확인 필수.**
