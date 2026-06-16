---
schema_version: 1
type: feature
slug: theme-picker-and-transparency
status: done
difficulty: medium
created_at: "2026-06-16T19:02:12+09:00"
session_id: "manual-20260616-190212"
agent:
  id: claude-code
  version: "4.8"
language: ko
verified_by_user: false
files_touched:
  - path: src/App.css
    op: update
    bytes_added: 1500
    bytes_removed: 1300
  - path: src/App.tsx
    op: update
    bytes_added: 2100
    bytes_removed: 120
  - path: src/i18n.tsx
    op: update
    bytes_added: 480
    bytes_removed: 0
  - path: index.html
    op: update
    bytes_added: 720
    bytes_removed: 150
  - path: src-tauri/Cargo.toml
    op: update
    bytes_added: 480
    bytes_removed: 0
  - path: src-tauri/src/lib.rs
    op: update
    bytes_added: 1750
    bytes_removed: 0
related: []
tags: ["theme", "dark-mode", "transparency", "settings", "appearance", "objc2", "css-vars"]
---

[x] 설정에 테마 선택(시스템/라이트/다크) + 창 투명도 + UI 글래스 강도 슬라이더 추가

## 추가 기능
About/설정 모달(좌상단 브랜드 클릭)에 **외관** 컨트롤 3종을 추가했다. 기존엔 OS
다크모드만 자동 추종할 뿐 사용자가 직접 고르는 설정이 없었다.

1. **테마 선택** — 시스템 / 라이트 / 다크 3-버튼 세그먼트(언어 토글과 동일 스타일).
2. **창 투명도** — 창 *전체*를 OS 네이티브 알파로 반투명화(바탕화면이 비침). 30~100%.
3. **UI 글래스 강도** — 반투명 패널 fill 알파를 배율로 조절. 30~150%.

영속화는 기존 패턴대로 `localStorage`(`uvws.theme` / `uvws.windowOpacity` /
`uvws.glassStrength`).

- **테마 메커니즘 변경(App.css)**: 다크 팔레트를 `@media (prefers-color-scheme: dark)`
  → `:root[data-theme="dark"]` 속성 선택자로 이전. JS가 선택값을 light/dark로 *해석*해
  `<html data-theme>`에 항상 구체값을 박는다("시스템"이면 `matchMedia` 추종 +
  `change` 리스너). `color-scheme`도 테마별로 명시. 중복 없는 단일 라이트/다크 블록.
- **글래스 강도(App.css)**: `--glass-strength`(기본 1) 도입, 핵심 4개 glass-fill 토큰의
  알파를 `calc(0.xx * var(--glass-strength))`로 변수화(라이트/다크 모두). 슬라이더가
  `<html>` 인라인 스타일로 이 변수를 덮어쓴다. 최대 1.5에서도 알파 ≤1이라 클램프 불필요.
- **무플래시(index.html)**: 페인트 전 인라인 스크립트가 저장된 테마/글래스 강도를
  `data-theme` + `--glass-strength`로 선적용. 인라인 `<style>`도 `data-theme` 기준 배경.
- **창 투명도(Rust)**: `set_window_opacity(window, opacity)` 커맨드 신규 + 등록.
  `transparent:true` 없이 동작 → 100%일 땐 기존과 완전 동일, 낮추면 창 전체가 비침.
  - macOS: `NSWindow.setAlphaValue:`(objc2 `msg_send!`).
  - Windows: 레이어드 윈도우(`WS_EX_LAYERED` + `SetLayeredWindowAttributes`/`LWA_ALPHA`).
  - Linux: GTK `WidgetExt::set_opacity`.
  - Cargo.toml에 플랫폼별 의존성(objc2 0.6 / windows 0.57 / gtk 0.18) 추가 — 모두 이미
    트리에 있던 transitive 버전과 동일하게 핀해 단일 인스턴스로 통합.
- **App.tsx**: `theme`/`windowOpacity`/`glassStrength` 상태 + 3개 useEffect(해석·영속·
  네이티브 적용), 설정 모달에 세그먼트 + 슬라이더 2개. lucide `Palette/Eye/Layers` import.
- **i18n**: ko/en `settings_appearance`, `settings_theme`, `theme_system/light/dark`,
  `settings_window_opacity`, `settings_glass_strength`.

## 동작 흐름
설정 모달 열기 → 테마 버튼 클릭 시 `<html data-theme>` 즉시 교체(전 컴포넌트가 CSS
변수로 재색칠) → 투명도 슬라이더 드래그 시 `set_window_opacity` invoke(창 전체 페이드)
→ 글래스 강도 슬라이더는 `--glass-strength` 인라인 변수만 바꿔 패널 진하기 조절.
모든 값은 localStorage에 저장되어 재시작/다음 페인트 전에 복원된다.

## 검증
`pnpm build`(tsc + vite) 통과, `src-tauri` `cargo check` 통과(macOS 경로 — objc2
`setAlphaValue:` 컴파일 확인). `prefers-color-scheme` 잔존은 의도된 리졸버 로직
(App.tsx matchMedia, index.html)만 남음을 grep으로 확인.

## 메모
- Windows/Linux의 `set_window_opacity` 경로는 cfg-gate라 macOS에서 컴파일되지 않아
  **이 환경에서 미검증**. 버전은 Cargo.lock 기존 인스턴스(windows 0.57 / gtk 0.18)와
  동일하게 핀했으나, 다음 릴리스 전 Windows/Linux 빌드에서 실제 컴파일·동작 확인 권장.
  특히 Windows는 WebView2 + 레이어드 윈도우 조합에서 알파가 안 먹을 가능성 존재.
- 런타임 시각 효과(실제 창이 비치는지, 테마 전환)는 GUI라 headless에서 확인 불가 →
  `pnpm tauri dev`로 사용자 수동 확인 권장.
