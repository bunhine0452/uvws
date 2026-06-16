---
schema_version: 1
type: chore
slug: revert-python-picker-widen-drag-v0.7.1
status: done
difficulty: low
created_at: "2026-06-16T22:19:50+09:00"
session_id: "manual-20260616-190212"
agent:
  id: claude-code
  version: "4.8"
language: ko
verified_by_user: true
files_touched:
  - path: src/App.tsx
    op: update
    bytes_added: 5
    bytes_removed: 2700
  - path: src-tauri/src/lib.rs
    op: update
    bytes_added: 0
    bytes_removed: 3400
  - path: src/i18n.tsx
    op: update
    bytes_added: 0
    bytes_removed: 900
  - path: src/App.css
    op: update
    bytes_added: 10
    bytes_removed: 1700
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
  - path: CHANGELOG.md
    op: update
    bytes_added: 480
    bytes_removed: 0
related:
  - ../Features_to_add/2048_feature_uv-python-version-management.md
  - ../Chores/2057_chore_release-v0.7.0.md
tags: ["revert", "ux", "drag-region", "titlebar", "v0.7.1", "user-feedback"]
---

[x] v0.7.0 피드백 반영 — Python 버전 선택기 제거 + 상단 드래그 영역 확대 (v0.7.1)

## 동기
사용자가 v0.7.0 실사용 후 3가지 지적: (1) UI 겹침 — 위치 확인 결과 "파이썬 선택하는 곳"
(방금 만든 카드), (2) "파이썬 버전 선택기는 왜 있는거임?" → 제거 선택, (3) 상단 창-이동
드래그 영역이 좁음. 카드가 기존 Python Interpreter 필드 + `.venv`(이미 3.13.12로 생성됨)
+ 상단 Python 배지와 의미상 중복이라 핀을 바꿔도 효과가 없어 혼란만 줌.

## 변경 요약
- **Python 버전 선택기 전면 롤백**([[2048_feature_uv-python-version-management]] 되돌림):
  - 프론트: config 탭 카드 JSX, `PythonVersionInfo` 인터페이스, 상태 4개,
    `loadPythonInfo`/config-load effect/`handlePinPython` 제거.
  - 백엔드: `uv_python_list`/`uv_python_install`/`uv_python_pin`/`get_python_pin`
    커맨드 + `PythonVersionInfo` 구조체 + `is_valid_py_request` 헬퍼 + 등록 제거.
  - i18n: 추가했던 python_* 키 제거(`python_version`은 셋업 모달에서 쓰여 유지).
  - CSS: `.py-ver-*` 스타일 제거.
- **상단 드래그 영역 확대**: `.main-drag-region` / `.sidebar-drag-region` 36px → **52px**.
  스트립이 커지며 브랜드가 내려가 정렬이 깨지므로 `.sidebar-collapse-btn` top 42→60px로
  맞춤. `.sidebar-open-btn`(접힘 상태 플로팅, 신호등 아래)은 스트립과 무관해 그대로.
- 버전 0.7.0 → **0.7.1**(4파일) + `cargo check`로 Cargo.lock 동기화 + CHANGELOG.

## 검증
`pnpm build`(tsc, noUnusedLocals=true 통과 — Box/RotateCw/message 모두 타 위치에서
사용 확인), `cargo check`(0.7.1) 통과. 겹침은 카드 제거로 해소. 드래그 영역 확대 폭(52px)
및 시각은 사용자가 실제 앱(설치/업데이트)에서 확인 권장 — 부족하면 값만 조정해 재배포.

## 메모
- 시각 효과(드래그 느낌/정렬)는 GUI라 headless 검증 불가. 52px는 +16px(약 44%) 확대.
- v0.7.0이 직전에 광고한 기능을 v0.7.1에서 되돌리는 모양새지만, 사용자 피드백 우선.
