---
schema_version: 1
type: chore
slug: release-v051-landing-dl-cards
status: done
difficulty: low
created_at: "2026-06-15T04:26:30+09:00"
session_id: "manual-20260615-034954"
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
    bytes_added: 520
    bytes_removed: 0
  - path: landing/index.html
    op: update
    bytes_added: 1900
    bytes_removed: 700
related:
  - ../Bugs/0425_bug_open-folder-not-allowed-path.md
tags: ["release", "v0.5.1", "landing", "ui", "download-cards"]
---

[x] v0.5.1 릴리즈 + 랜딩 다운로드 카드 한 줄·로고 정리

## 검증
- 버전 0.5.0 → 0.5.1 (package.json/Cargo.toml/tauri.conf.json + App.tsx fallback),
  `cargo check`로 Cargo.lock 동기화, `pnpm build` 통과.
- 랜딩 다운로드 카드: `.dl-grid` 3열 → **4열(반응형 4→2→1)**, 각 카드에 OS 로고 추가
  (Apple ×2 / Windows 4-square / Linux 펭귄 SVG, 전부 monochrome `currentColor`로 다크모드 대응).
  헤드리스 크롬으로 렌더 스크린샷 찍어 4개가 한 줄에 로고와 함께 정렬됨을 육안 확인.
- 랜딩 softwareVersion + dl 폴백 URL 0.5.1로 갱신. 푸시 시 Vercel Git 연동 자동 배포.

## 메모
이번 릴리즈의 핵심은 [[open-folder-not-allowed-path]] 버그 수정 전달(컴파일된 capability라
재빌드 필요). 랜딩 카드 정리는 사용자 피드백("3+1로 깨져 보임, 각 로고와 한 줄로")을 반영.
Linux 펭귄은 FA Tux 대신 손으로 그린 단색 실루엣(eye는 evenodd 홀)로 처리해 깨짐 위험 제거.
