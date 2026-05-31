---
schema_version: 1
type: feature
slug: "seamless-titlebar-overlay"
status: done
difficulty: low
created_at: "2026-05-31T15:18:00+09:00"
updated_at: "2026-05-31T15:20:00+09:00"
session_id: "20260531-001"
agent:
  id: "antigravity"
  version: "1.0"
language: "ko"
verified_by_user: true
files_touched:
  - path: "src-tauri/tauri.conf.json"
    op: update
    bytes_added: 60
    bytes_removed: 24
  - path: "src/App.css"
    op: update
    bytes_added: 520
    bytes_removed: 40
  - path: "src/App.tsx"
    op: update
    bytes_added: 120
    bytes_removed: 0
related: []
tags:
  - "titlebar"
  - "macos"
  - "ui"
  - "tauri-window"
---

[x] 앱 상단 바를 앱과 물아일체가 되도록 overlay 타이틀바 적용

## 추가 기능

macOS 네이티브 타이틀바를 제거하고, 앱 콘텐츠가 타이틀바 영역까지 확장되도록 `titleBarStyle: "overlay"` 적용. 트래픽 라이트(닫기/최소화/최대화) 버튼은 유지하면서 타이틀 텍스트를 숨기고, 앱이 하나로 이어지는 느낌을 줌.

## 동작 흐름

1. `tauri.conf.json`: `decorations: true` → `titleBarStyle: "overlay"` + `hiddenTitle: true`
2. `App.css`: 사이드바와 메인 콘텐츠 상단에 36px 드래그 영역 추가 (창 이동용)
3. `App.tsx`: `sidebar-drag-region`, `main-drag-region` div 추가
4. 인터랙티브 요소(버튼, 브랜드 클릭 등)에 `-webkit-app-region: no-drag` 적용하여 클릭 가능 유지
5. empty state에서도 드래그 영역이 투명 배경으로 작동

## 검증

- `pnpm tauri dev` 재시작 후 타이틀바가 사라지고 앱 콘텐츠가 상단까지 확장되는지 확인 필요
- 트래픽 라이트 버튼 동작 확인 (닫기/최소화/최대화)
- 드래그 영역으로 창 이동 가능 확인
