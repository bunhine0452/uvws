# PROGRESS — 진척도 트래커 (단일 진실 소스)

> 새 세션은 **이 파일을 먼저 읽는다.** 작업할 때마다 체크박스와 `NEXT ACTION`을 갱신한다.
> 상태 표기: `[ ]` 미착수 · `[~]` 진행 중 · `[x]` 완료(검증됨)

---

## 🧭 현재 상태

- **마지막 업데이트:** 2026-06-07 (계획 문서 최초 작성)
- **전체 단계:** 설계 완료 ✅ → 구현 시작 전
- **현재 기능:** (없음 — 아직 시작 안 함)
- **NEXT ACTION:** 기능 **#1 터널+QR 공유**의 `01-tunnel-qr-share.md`를 열고, 백엔드 첫 체크박스(`check_tunnel_available` 커맨드)부터 시작한다.

> 구현 순서 권장: **1 → 2 → 4 → 9** (1·2는 runner 확장, 4는 1·2의 이벤트와 잘 묶임, 9는 독립적이라 마지막/병렬 가능).

---

## 기능 #1 — 터널 + QR 공유  (`01-tunnel-qr-share.md`)
상태: ⬜ 시작 전

### 백엔드 (`src-tauri/src/tunnel.rs` 신규 + lib.rs)
- [ ] `tunnel.rs` 모듈 생성 + `TunnelRegistry` 상태 정의, `lib.rs`에서 `mod tunnel;` + `app.manage(...)`
- [ ] `check_tunnel_available() -> bool` (cloudflared PATH 감지)
- [ ] `start_tunnel(id, port)` — cloudflared 스폰, `https://*.trycloudflare.com` 파싱 → `tunnel-url` 이벤트
- [ ] `stop_tunnel(id)` — 터널 프로세스 종료
- [ ] `stop_project`/`kill_all_processes`에서 해당 프로젝트 터널도 함께 정리
- [ ] `lib.rs` `invoke_handler!`에 3개 커맨드 등록

### 프론트엔드
- [ ] `qrcode` npm 패키지 추가
- [ ] "Share" 버튼(헤더, open_in_browser 근처) — running + port 있을 때만
- [ ] 공유 모달: URL + QR + 복사 + "공유 중지" + cloudflared 미설치 안내
- [ ] `tunnel-url` listen, 상태 관리(projectId → url)
- [ ] i18n 키(ko/en)

### 검증
- [ ] cargo check + npm run build 통과
- [ ] (수동) 서버 실행 → Share → trycloudflare URL/QR → 폰에서 로드 → 중지

---

## 기능 #2 — 리소스 모니터  (`02-resource-monitor.md`)
상태: ⬜ 시작 전

### 백엔드
- [ ] `Cargo.toml`에 `sysinfo` 추가
- [ ] `lib.rs setup`에 1초 주기 샘플러 tokio 태스크(활성 PID들의 CPU/RAM 수집)
- [ ] `process-metrics` 이벤트(배열 `[{id, cpu, mem_bytes}]`) emit
- [ ] (정확도) 자식 프로세스 합산 처리 또는 caveat 주석

### 프론트엔드
- [ ] `process-metrics` listen → `metrics` 상태 + id별 링버퍼(스파크라인용)
- [ ] 헤더 통계 행에 CPU%·MEM 표시
- [ ] 사이드바 실행 중 프로젝트에 미니 표시(선택)
- [ ] 인라인 SVG 스파크라인 컴포넌트
- [ ] i18n 키(ko/en)

### 검증
- [ ] cargo check + npm run build 통과
- [ ] (수동) 실행 시 ~1Hz로 CPU/MEM 갱신, 중지 시 사라짐

---

## 기능 #4 — 네이티브 알림  (`04-native-notifications.md`)
상태: ⬜ 시작 전

### 백엔드
- [ ] `tauri-plugin-notification` Cargo 의존성 + `lib.rs` `.plugin(init())`
- [ ] `capabilities/default.json`에 `notification:default` 권한
- [ ] `runner.rs` 종료 모니터에서 `process-exit { id, code, by_user }` 이벤트 추가(크래시 판별용)

### 프론트엔드
- [ ] `@tauri-apps/plugin-notification` npm 추가, 권한 요청(최초 1회)
- [ ] `process-port` listen → "준비됨" 알림(창 비포커스 시에만 권장)
- [ ] `process-exit` listen → `!by_user && code!=0`일 때 "크래시" 알림
- [ ] About/설정에 알림 on/off 토글(localStorage)
- [ ] i18n 키(ko/en)

### 검증
- [ ] cargo check + npm run build 통과
- [ ] (수동) 실행→준비 알림 / 외부 kill→크래시 알림 / 사용자 Stop→무알림

---

## 기능 #9 — 의존성 닥터  (`09-dependency-doctor.md`)
상태: ⬜ 시작 전

### 백엔드 (lib.rs, `list_dependencies` 패턴 모방)
- [ ] `list_outdated(path) -> Vec<Value>` (`uv pip list --outdated --format json`)
- [ ] `upgrade_package(path, name)` (`uv pip install --upgrade <name>`)
- [ ] `upgrade_all(path, names)` 
- [ ] (선택/2차) `audit_dependencies(path)` — `uvx pip-audit --format json`
- [ ] `lib.rs` 핸들러 등록

### 프론트엔드 (의존성 탭 ≈849–900행 확장)
- [ ] "업데이트 확인" 버튼 → 구버전 목록(현재→최신) 테이블
- [ ] 행별 "업그레이드" + "전체 업그레이드" + 진행 스피너 + 완료 후 새로고침
- [ ] 업데이트 개수 배지
- [ ] (선택) "취약점 점검" 버튼
- [ ] i18n 키(ko/en)

### 검증
- [ ] cargo check + npm run build 통과
- [ ] (수동) 구버전 패키지 → 확인 → 업그레이드 → 버전 상승 → 목록 갱신

---

## 변경 로그 (append-only, 최신이 위)

- 2026-06-07 — 계획 문서 6종 작성(MASTER_PROMPT, PROGRESS, 01/02/04/09). 구현 미착수.
