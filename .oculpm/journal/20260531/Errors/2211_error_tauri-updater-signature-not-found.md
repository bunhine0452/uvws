---
schema_version: 1
type: error
slug: "tauri-updater-signature-not-found"
status: done
difficulty: low
created_at: "2026-05-31T22:05:00+09:00"
updated_at: "2026-05-31T22:11:00+09:00"
session_id: "20260531-006"
agent:
  id: "antigravity"
  version: "1.0"
language: "ko"
verified_by_user: true
files_touched:
  - path: ".github/workflows/release.yml"
    op: update
    bytes_added: 0
    bytes_removed: 50
  - path: "src-tauri/tauri.conf.json"
    op: update
    bytes_added: 5
    bytes_removed: 5
related: []
tags:
  - "updater"
  - "tauri-action"
  - "github-actions"
  - "signature"
---

[x] "Could not fetch a valid release JSON from the remote" (Signature not found) 에러 해결

## 발생 원인

1. 사용자가 "Check for Updates" 버튼을 클릭했을 때 `Could not fetch a valid release JSON from the remote` 에러 발생.
2. 확인 결과 GitHub Releases에 `latest.json` 파일이 업로드되지 않았음.
3. GitHub Actions 빌드 로그에 `Signature not found for the updater JSON. Skipping upload...` 오류가 기록됨.
4. `tauri build` 단계에서 `.sig` (전자서명) 파일이 생성되지 않아 `tauri-action`이 `latest.json` 생성을 취소한 것임.
5. `.sig` 파일이 생성되지 않은 근본 원인은 `release.yml`의 환경변수 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_KEY_PASSWORD }}` 구문 때문.
6. 키 생성 시 비밀번호를 설정하지 않아 해당 Secret이 비어있었는데, 환경변수에는 **빈 문자열(`""`)**로 할당됨.
7. Tauri v2 CLI는 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`가 아예 없으면 비밀번호가 없다고 간주하지만, 빈 문자열로라도 설정되어 있으면 잘못된 비밀번호 처리 로직에 꼬여 서명 자체를 건너뛰거나 실패함.

## 해결 방법

- `.github/workflows/release.yml`에서 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 환경변수 라인을 삭제함. (비밀번호 없는 키를 사용 중이므로)
- `v0.1.4` 버전으로 범프하고 새로 태깅하여 CI 재실행 유도.

## 검증

- `v0.1.4` 태그를 푸시하여 빌드를 시작함.
- `v0.1.4` 빌드가 성공하여 `latest.json`과 `.sig`가 릴리스에 업로드되는지 확인 예정 (사용자가 직접 `v0.1.3` 앱에서 테스트 가능).
