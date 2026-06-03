---
schema_version: 1
type: bug
slug: "macos-gatekeeper-damaged-app"
status: done
difficulty: medium
created_at: "2026-05-31T15:56:15+09:00"
updated_at: "2026-05-31T16:05:00+09:00"
session_id: "20260531-003"
agent:
  id: "antigravity"
  version: "1.0"
language: "ko"
verified_by_user: true
files_touched:
  - path: "src-tauri/tauri.conf.json"
    op: update
    bytes_added: 52
    bytes_removed: 0
  - path: ".github/workflows/release.yml"
    op: update
    bytes_added: 40
    bytes_removed: 30
  - path: "README.md"
    op: update
    bytes_added: 180
    bytes_removed: 150
related: []
tags:
  - "macos"
  - "gatekeeper"
  - "codesign"
  - "dmg"
---

[x] macOS Gatekeeper "손상된 앱" 오류 수정

## 발생 원인

GitHub Releases에서 다운로드한 `.dmg`의 앱이 코드 서명 없이 배포되어, macOS Gatekeeper가 "손상되었습니다" 메시지로 차단. 인터넷에서 다운로드된 파일에 `com.apple.quarantine` 확장 속성이 붙고, 서명 검증 실패 시 실행 자체가 거부됨.

## 해결 방법

1. `tauri.conf.json`의 `bundle.macOS.signingIdentity`를 `"-"`로 설정하여 **ad-hoc 서명** 적용
2. "손상되었습니다" → "확인되지 않은 개발자" 경고로 변경됨
3. 사용자는 **우클릭 → 열기**만 하면 됨 (터미널 명령어 불필요)
4. README에 first launch 안내 추가

## 검증

- `codesign --force --deep -s -` 로 로컬 앱 서명 확인
- v0.1.0 태그 재생성 후 GitHub Actions 빌드 트리거
