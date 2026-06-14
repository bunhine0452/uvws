---
schema_version: 1
type: feature
slug: uv-install-gate-onboarding
status: done
difficulty: medium
created_at: "2026-06-08T17:41:32+09:00"
session_id: "manual-20260608-174132"
agent:
  id: claude-code
  version: "4.8"
language: ko
verified_by_user: false
files_touched:
  - path: src-tauri/src/lib.rs
    op: update
    bytes_added: 3400
    bytes_removed: 0
  - path: src/App.tsx
    op: update
    bytes_added: 3600
    bytes_removed: 0
  - path: src/i18n.tsx
    op: update
    bytes_added: 1500
    bytes_removed: 0
related: []
tags: ["activation", "uv", "onboarding", "first-run", "growth"]
---

[x] uv 미설치 감지 + 원클릭 설치 게이트 & 빈 상태 온보딩 CTA

## 추가 기능
첫-실행 이탈의 최대 원인("uv를 미리 깔아야 함")을 제거하는 활성화 기능.

- 백엔드(`lib.rs`): `uv_bin()`(절대경로 우선 해석, `~/.local/bin`·`~/.cargo/bin`·homebrew 폴백 — cloudflared 전략과 동일), `check_uv`(설치/버전 반환), `install_uv`(Astral 공식 인스톨러: mac/linux `install.sh`, win `install.ps1`). 두 커맨드 `invoke_handler` 등록. 설치 위치 `~/.local/bin`은 `main.rs`가 시작 시 PATH에 이미 추가하므로 같은 세션에서 바로 uv 호출 가능.
- 프론트(`App.tsx`): 시작 시 `check_uv` → 미설치 시 차단형 게이트 모달(원클릭 설치 버튼/스피너, 실패 시 stderr, 수동 명령 코드블록, 다시 확인/uv 문서/일단 계속). About에 uv 버전 칩. 빈 상태에 "첫 프로젝트 추가" 기본 CTA 버튼 + AI 예시 문구(ComfyUI·SD·FastAPI…).
- i18n: ko/en 각 13키(uv_* + empty_*).

## 동작 흐름
앱 시작 → `check_uv` invoke → `{installed:false}`면 `uvStatus`가 셋되며 게이트 표시 → 사용자가 "uv 자동 설치" 클릭 → `install_uv` 실행 → 끝나면 `refreshUvStatus` 재확인 → 설치 확인되면 게이트 닫힘(`uvStatus.installed=true`), 미확인이면 수동 안내. "일단 계속"으로 게이트 dismiss 가능.

## 검증
`cargo check`(경고 0) + `pnpm build`(tsc + vite) 통과. 동일 번들 해시로 재빌드 확인. 런타임 E2E(실제 uv 제거 후 설치 흐름)는 사용자 수동 확인 권장.

## 메모
포지셔닝을 "로컬 AI 앱 런처"로 잡기로 한 결정에 맞춰 빈 상태 문구에 ComfyUI/SD를 명시. 후속 성장 레버: Linux 빌드, macOS 공증(별도). 관련 홍보 작업은 같은 날 chore 일지 참조.
