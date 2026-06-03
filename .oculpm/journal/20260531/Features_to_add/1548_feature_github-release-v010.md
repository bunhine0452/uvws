---
schema_version: 1
type: feature
slug: "github-release-v010"
status: done
difficulty: high
created_at: "2026-05-31T15:36:43+09:00"
updated_at: "2026-05-31T15:48:00+09:00"
session_id: "20260531-002"
agent:
  id: "antigravity"
  version: "1.0"
language: "ko"
verified_by_user: true
files_touched:
  - path: ".gitignore"
    op: update
    bytes_added: 120
    bytes_removed: 0
  - path: "src-tauri/src/runner.rs"
    op: update
    bytes_added: 1800
    bytes_removed: 600
  - path: "src/App.tsx"
    op: update
    bytes_added: 45
    bytes_removed: 30
  - path: "src-tauri/tauri.conf.json"
    op: update
    bytes_added: 5
    bytes_removed: 5
  - path: "README.md"
    op: update
    bytes_added: 5200
    bytes_removed: 378
  - path: "LICENSE"
    op: create
    bytes_added: 1070
    bytes_removed: 0
  - path: ".github/workflows/release.yml"
    op: create
    bytes_added: 1850
    bytes_removed: 0
  - path: "docs/alpha/preview.png"
    op: create
    bytes_added: 150000
    bytes_removed: 0
related: []
tags:
  - "github"
  - "release"
  - "ci"
  - "readme"
  - "windows-compat"
  - "cross-platform"
---

[x] GitHub 연결, README 작성, Windows 호환 수정, v0.1.0 릴리스 출시

## 추가 기능

- GitHub 리포지토리 `bunhine0452/uvws`에 프로젝트 연결 및 7개 커밋 push
- 홍보용 README.md 작성 (배지, 기능 테이블, 아키텍처, 설치가이드, 로드맵)
- Windows 호환 수정: `kill_port` (netstat/taskkill), `CREATE_NEW_PROCESS_GROUP`, `shortenPath`
- GitHub Actions CI 워크플로우 (macOS aarch64/x64 + Windows 자동 빌드)
- MIT LICENSE 파일 추가
- v0.1.0 태그 push로 릴리스 자동 빌드 트리거

## 동작 흐름

1. `.gitignore` 정리 → 불필요한 파일 제외
2. `runner.rs`의 `kill_port` 함수를 `#[cfg(unix)]` / `#[cfg(windows)]`로 분기
3. `runner.rs`에 Windows용 `CREATE_NEW_PROCESS_GROUP` 추가
4. `App.tsx`의 `shortenPath`에 Windows 경로 패턴 추가
5. 프로페셔널 README.md 작성
6. GitHub Actions `release.yml` 생성 (tag push 시 3-platform 빌드)
7. 7개 커밋으로 나누어 push
8. `pnpm tauri build`로 macOS .dmg 생성 (4.7MB)
9. `v0.1.0` 태그 push → CI 릴리스 빌드 트리거

## 검증

- `pnpm tauri build` 성공 확인 (macOS aarch64, 14.2s)
- `git push origin main` 성공 (7 commits)
- `git push origin v0.1.0` 태그 push 성공
- GitHub Actions release workflow 트리거 확인
