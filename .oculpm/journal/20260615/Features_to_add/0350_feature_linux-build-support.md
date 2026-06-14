---
schema_version: 1
type: feature
slug: linux-build-support
status: done
difficulty: medium
created_at: "2026-06-15T03:50:30+09:00"
session_id: "manual-20260615-034954"
agent:
  id: claude-code
  version: "4.8"
language: ko
verified_by_user: false
files_touched:
  - path: .github/workflows/release.yml
    op: update
    bytes_added: 1150
    bytes_removed: 0
  - path: src-tauri/src/main.rs
    op: update
    bytes_added: 560
    bytes_removed: 230
  - path: src-tauri/src/tunnel.rs
    op: update
    bytes_added: 760
    bytes_removed: 80
  - path: landing/index.html
    op: update
    bytes_added: 360
    bytes_removed: 0
  - path: CLAUDE.md
    op: update
    bytes_added: 380
    bytes_removed: 180
related:
  - ../../20260615/Features_to_add/0349_feature_open-project-folder.md
tags: ["linux", "release", "ci", "tauri", "cross-platform", "growth"]
---

[x] Linux(AppImage/deb/rpm) 빌드 지원 — CI 매트릭스 + 바이너리 경로 해석 + 다운로드 노출

## 추가 기능
macOS/Windows만 빌드하던 릴리스 파이프라인에 Linux를 추가하고, Linux GUI 런처에서
외부 바이너리(uv·git·kill·lsof·cloudflared)가 해석되도록 PATH/경로 폴백을 보강.

- CI(`release.yml`): 매트릭스에 `ubuntu-22.04` 러너 추가(넓은 glibc/webkit2gtk-4.1
  호환 위해 latest 대신 22.04). 빌드 전 apt로 Tauri v2 의존성 설치
  (`libwebkit2gtk-4.1-dev`, `librsvg2-dev`, `patchelf`, `libgtk-3-dev`, `libxdo-dev`,
  `libssl-dev`, `libappindicator3-dev`, build-essential 등). `bundle.targets:"all"`이라
  Linux에서 AppImage+deb+rpm 산출. 릴리스 노트 Downloads 표에 Linux 행, "🐧 Linux First
  Launch"(chmod +x, libfuse2) 안내 추가.
- PATH(`main.rs`): `#[cfg(unix)]` 보강 목록에 `/usr/bin`·`/bin` 추가(존재 안 해도 무해,
  중복은 dedup). 데스크톱 런처에서 셸 PATH를 못 받는 Linux에서 시스템 바이너리 해석 보장.
- 터널(`tunnel.rs`): `cloudflared_bin()`에 `#[cfg(target_os="linux")]` 분기 신설
  (`~/.local/bin` → `/usr/local/bin` → `/usr/bin` → PATH 폴백). 기존 macos/그-외 분기는
  `not(any(macos, linux))`로 정리.
- 랜딩(`landing/index.html`): 다운로드 카드에 Linux(AppImage) 추가 + 런타임 GitHub API
  리졸버에 `setHref("dl-linux", pick(/\.AppImage$/i))` 와이어링.
- 문서(`CLAUDE.md`): "macOS + Windows" → "macOS, Windows, Linux", Releasing 섹션에 Linux
  잡/의존성/AppImage만 auto-update 가능 메모.

## 동작 흐름
태그 `v*` 푸시 → release.yml 매트릭스(mac aarch64/x64, win, **ubuntu-22.04**) 병렬 빌드 →
Linux 잡은 apt 의존성 설치 후 tauri-action으로 AppImage/deb/rpm 번들 + (AppImage) 서명 →
release 자산 업로드, `latest.json`에 Linux 항목 포함. 랜딩 다운로드 버튼은 최신 릴리스의
`.AppImage` 자산을 런타임 해석.

## 검증
로컬(macOS)에서 `pnpm build` + `cargo check` 통과 — 단, Linux 전용 `cfg` 분기와 실제
Linux 번들은 로컬 크로스컴파일이 불가하므로 **ubuntu-22.04 CI가 실제 컴파일/번들 검증**이다.
코드 변경은 기존 macOS/`uv_bin` 패턴을 그대로 따라 위험 낮음. 첫 Linux 태그 릴리스 시
`gh release view`로 AppImage/deb/rpm + latest.json 자산 생성 확인 필요.

## 메모
deb/rpm는 Tauri 업데이터 미지원(AppImage만 auto-update). lsof 미설치 배포판에선 kill-port가
degrade될 수 있음(포트 자동 감지는 로그 파싱이라 영향 없음) — 후속으로 ss/fuser 폴백 여지.
랜딩의 SEO/FAQ/schema 카피의 "macOS · Windows" 문구는 별도 패스로 남김. 성장 레버 후속:
[[uv-install-gate-onboarding]] 메모에서 예고된 Linux 빌드 항목 완료.
