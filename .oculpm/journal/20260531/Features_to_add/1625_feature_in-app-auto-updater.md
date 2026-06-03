---
schema_version: 1
type: feature
slug: "in-app-auto-updater"
status: done
difficulty: high
created_at: "2026-05-31T16:18:25+09:00"
updated_at: "2026-05-31T16:25:00+09:00"
session_id: "20260531-005"
agent:
  id: "antigravity"
  version: "1.0"
language: "ko"
verified_by_user: true
files_touched:
  - path: "src-tauri/Cargo.toml"
    op: update
    bytes_added: 60
    bytes_removed: 0
  - path: "package.json"
    op: update
    bytes_added: 60
    bytes_removed: 0
  - path: "src-tauri/src/lib.rs"
    op: update
    bytes_added: 120
    bytes_removed: 0
  - path: "src-tauri/tauri.conf.json"
    op: update
    bytes_added: 250
    bytes_removed: 0
  - path: "src/App.tsx"
    op: update
    bytes_added: 1200
    bytes_removed: 20
  - path: ".github/workflows/release.yml"
    op: update
    bytes_added: 150
    bytes_removed: 0
related: []
tags:
  - "updater"
  - "auto-update"
  - "tauri"
  - "github-releases"
  - "ci"
---

[x] 앱 내 자동 업데이트(In-App Auto Update) 기능 구현

## 추가 기능

- Tauri 공식 업데이트 플러그인(`@tauri-apps/plugin-updater`) 및 프로세스 제어 플러그인(`@tauri-apps/plugin-process`) 적용
- GitHub Releases 최신 버전(`latest.json`)을 타겟으로 하는 업데이트 확인 기능 추가
- `App.tsx`의 About 모달 내에 "업데이트 확인" 버튼 및 대화상자 추가
- 업데이트 감지 시, 앱 내에서 직접 `.dmg`/`.exe`를 백그라운드 다운로드하고 설치 후 자동 재시작
- GitHub Actions CI 연동: `TAURI_SIGNING_PRIVATE_KEY` 환경변수를 통해 앱 서명 자동화

## 동작 흐름

1. 로컬 환경에서 `tauri signer generate`로 Ed25519 공개키/비밀키 쌍 생성 (비밀번호 없음).
2. 생성된 공개키(`updater.key.pub`)를 `tauri.conf.json`의 `plugins.updater.pubkey`에 등록.
3. 업데이트 엔드포인트를 GitHub Releases의 기본 지원 포맷인 `https://github.com/bunhine0452/uvws/releases/latest/download/latest.json`으로 지정 (별도의 서버 구축 불필요).
4. `App.tsx`에서 `check()` 함수를 호출하여 현재 버전과 `latest.json` 버전을 비교.
5. 새 버전이 있을 경우 `update.downloadAndInstall()`을 실행 후 `relaunch()`로 앱 재시작.
6. GitHub Actions `release.yml`에 빌드 시 서명하도록 환경변수 추가 완료.

## 검증

- 코드 커밋 및 푸시 완료.
- 사용자에게 GitHub Secrets 등록을 요청해야 CI에서 정상적으로 `latest.json` 및 `.sig` 파일을 생성하고 서명 가능함.
