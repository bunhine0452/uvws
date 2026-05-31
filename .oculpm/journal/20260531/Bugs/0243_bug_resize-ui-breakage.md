---
schema_version: 1
type: bug
slug: "resize-ui-breakage"
status: done
difficulty: low
created_at: "2026-05-31T02:43:28+09:00"
session_id: "manual-20260531-024328"
agent:
  id: "antigravity"
  version: "4.6"
language: "ko"
verified_by_user: true
files_touched:
  - path: "src/App.css"
    op: update
related: []
tags:
  - "ui"
  - "layout"
  - "resize"
  - "css"
  - "flex"
---

[x] 창 크기 조절 시 UI 깨짐 버그 수정

## 발생 원인
- 여러 flex 컨테이너가 `flex-shrink: 0`이면서 `flex-wrap`이 없어서 좁은 창에서 오버플로 발생.
- 프로젝트 제목(`h1`) 및 경로 텍스트에 `text-overflow: ellipsis` 없이 넘침.
- `.tab-content`가 `overflow: hidden`이라 내부 패널이 축소 불가 시 잘림.

## 해결 방법
- 헤더, 액션 버튼, Stats 바, Deps 헤더 등에 `flex-wrap: wrap` 추가.
- 제목/경로에 `ellipsis` 처리.
- `.tab-content`를 `overflow-y: auto`로 변경하고 내부 패널의 `flex-shrink: 0` 제거.
- `.config-field-row`에 `flex-wrap: wrap` + `flex: 1 1 260px` 적용.
- 터미널 영역에 `min-height: 120px` 보장.

## 검증
- 활성화된 `npm run tauri dev`에서 HMR 적용 후 창 크기를 다양하게 조절하여 확인.
