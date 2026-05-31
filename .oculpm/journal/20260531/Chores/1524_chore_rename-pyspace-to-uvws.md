---
schema_version: 1
type: chore
slug: "rename-pyspace-to-uvws"
status: done
difficulty: verylow
created_at: "2026-05-31T15:24:17+09:00"
updated_at: "2026-05-31T15:24:40+09:00"
session_id: "20260531-001"
agent:
  id: "antigravity"
  version: "1.0"
language: "ko"
verified_by_user: true
files_touched:
  - path: "src/App.tsx"
    op: update
    bytes_added: 40
    bytes_removed: 50
related: []
tags:
  - "branding"
  - "ui-text"
---

[x] UI의 PySpace 텍스트를 uvws로 변경 및 기본값 제거

## 변경 사항
1. `App.tsx` 파일 내에서 사이드바 브랜드명, About 모달 타이틀, 프로젝트 삭제 경고창 등에 있는 "PySpace" 텍스트를 "uvws"로 일괄 변경
2. 프로젝트 추가 시 기본적으로 입력되어 있던 `python main.py` 커맨드 초기값을 빈 문자열로 변경
3. UI의 브랜드 아이콘을 앱 번들 아이콘(`public/icons/128x128.png`) 이미지로 교체하여 브랜드 통일성 향상

## 검증
- UI 상에서 모든 PySpace 단어가 uvws로 변경되었음을 코드 레벨에서 확인
- 새 프로젝트 추가 모달을 열었을 때 Run Command 입력칸이 비어있는지 핫리로딩된 앱에서 확인
