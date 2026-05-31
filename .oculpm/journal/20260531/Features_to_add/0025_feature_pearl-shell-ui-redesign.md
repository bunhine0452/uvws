---
schema_version: 1
type: feature
slug: "pearl-shell-ui-redesign"
status: done
difficulty: low
created_at: "2026-05-31T00:25:00+09:00"
session_id: "manual-20260531-002500"
agent:
  id: "antigravity"
  version: "3.1"
language: "ko"
verified_by_user: true
files_touched:
  - path: "src/App.css"
    op: update
  - path: "src/App.tsx"
    op: update
related: []
tags:
  - "ui"
  - "design"
  - "theme"
  - "css"
---

[x] 앱 아이콘과 UI 테마 조화(Pearl/Shell 테마) 디자인 개편

## 추가 기능
- 기존 어두운 테마(Dark Theme) 기반의 UI를 앱 아이콘(조개와 진주 라인아트)에 어울리도록 펄 화이트(Pearl White) 기반의 미니멀/모노톤 라이트 테마로 전면 개편했습니다.

## 동작 흐름
1. `src/App.css`의 CSS 변수(`:root`)를 밝은 테마용 색상 코드로 수정. (배경: 화이트/오프화이트, 텍스트/포인트: 다크 슬레이트/블랙)
2. 아이콘 스타일의 둥근 곡선을 살리기 위해 전체적인 `border-radius` 반경 증가 및 그림자 톤을 밝고 은은하게(Soft Shadow) 조정.
3. `src/App.tsx`의 `ICON_COLORS` 배열을 형광색에서 징크/파스텔/모노톤으로 변경.
4. CSS에 하드코딩되어 있던 `rgba(255,255,255,x)` 컬러들을 라이트 테마에 맞게 `rgba(0,0,0,x)`로 일괄 변경.

## 검증
- 활성화된 `npm run tauri dev` 데브 서버를 통해 프론트엔드 HMR(Hot Module Replacement) 자동 적용.
