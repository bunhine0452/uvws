# PROGRESS — 진척도 트래커 (단일 진실 소스)

> 새 세션은 **이 파일을 먼저 읽는다.** 작업할 때마다 체크박스와 `NEXT ACTION`을 갱신한다.
> 상태 표기: `[ ]` 미착수 · `[~]` 진행 중 · `[x]` 완료(검증됨)

---

## 🧭 현재 상태

- **마지막 업데이트:** 2026-06-07
- **전체 단계:** 기능 #1·#2·#4·#9 **전부 코드 완료** ✅ (자동 검증 통과)
- **현재 기능:** 없음 — 4종 모두 코드 완료. 남은 건 **런타임 수동 E2E**뿐.
- **NEXT ACTION:** `pnpm tauri dev`로 실제 동작 확인. ① 터널은 `brew install cloudflared` 후 테스트. ② 리소스 모니터/알림/의존성 닥터는 바로 확인 가능. 확인되면 각 기능의 "(수동)" 체크박스를 닫고, 필요 시 버전 범프 후 릴리스.

> 구현 순서 권장: **1 → 2 → 4 → 9** (1·2는 runner 확장, 4는 1·2의 이벤트와 잘 묶임, 9는 독립적이라 마지막/병렬 가능).

---

## 기능 #1 — 터널 + QR 공유  (`01-tunnel-qr-share.md`)
상태: ✅ 코드 완료 (수동 E2E만 남음)

### 백엔드 (`src-tauri/src/tunnel.rs` 신규 + lib.rs)
- [x] `tunnel.rs` 모듈 생성 + `TunnelRegistry` 상태 정의, `lib.rs`에서 `mod tunnel;` + `app.manage(...)`
- [x] `check_tunnel_available() -> bool` (cloudflared 절대경로 우선 + which 폴백)
- [x] `start_tunnel(id, port)` — cloudflared 스폰, `https://*.trycloudflare.com` 파싱 → `tunnel-url` 이벤트(+ `tunnel-error`/`tunnel-stopped`, 25s 타임아웃)
- [x] `stop_tunnel(id)` — 터널 프로세스(그룹) 종료
- [x] 앱 종료 시 `tunnel::kill_all_tunnels`로 정리(`lib.rs` exit 핸들러). ※프로젝트 Stop 시 정리는 프론트에서 stop_tunnel 호출로 처리(설계대로)
- [x] `lib.rs` `invoke_handler!`에 3개 커맨드 등록

### 프론트엔드
- [x] `qrcode` + `@types/qrcode` 추가
- [x] "Share" 버튼(헤더) — `isRunning && detectedPort`일 때만
- [x] 공유 모달: QR + URL + 복사/열기 + "공유 중지" + cloudflared 미설치 안내 + 공개 경고
- [x] `tunnel-url`/`tunnel-error`/`tunnel-stopped` listen, QR 생성 useEffect
- [x] i18n 키(ko/en) 11종

### 검증
- [x] cargo check (경고 0) + npm run build 통과
- [ ] (수동) 서버 실행 → Share → trycloudflare URL/QR → 폰에서 로드 → 중지  ※**이 머신엔 cloudflared 미설치** → 설치 후 확인 필요. (미설치 시 모달이 설치 안내를 띄우는 graceful 경로는 코드상 처리됨)

---

## 기능 #2 — 리소스 모니터  (`02-resource-monitor.md`)
상태: ✅ 코드 완료 (런타임 수동 확인 권장)

### 백엔드
- [x] `Cargo.toml`에 `sysinfo = "0.33"` 추가
- [x] `lib.rs setup`에 1초 주기 샘플러(`metrics_sampler`) async 태스크
- [x] `process-metrics` 이벤트(배열 `[{id, cpu, mem_bytes}]`) emit
- [x] 루트 PID + 직접 자식 합산(uv→python), caveat 주석(손주 과소집계)

### 프론트엔드
- [x] `process-metrics` listen → `metrics` 상태(매 틱 교체) + `sparkRef` 링버퍼
- [x] 헤더 통계 행에 CPU%·MEM 칩(`liveMetric`/`liveSpark`)
- [ ] 사이드바 실행 중 프로젝트 미니 표시 — (선택, 미구현)
- [x] 인라인 SVG `Spark` 컴포넌트 + `formatBytes`
- [x] i18n 키(ko/en): cpu, memory

### 검증
- [x] cargo check(경고 0) + npm run build 통과
- [ ] (수동) `pnpm tauri dev`에서 실행 시 ~1Hz CPU/MEM 갱신·스파크라인, 중지 시 "—"

---

## 기능 #4 — 네이티브 알림  (`04-native-notifications.md`)
상태: ✅ 코드 완료 (런타임 수동 확인 권장)

### 백엔드
- [x] `tauri-plugin-notification = "2"` Cargo + `lib.rs` `.plugin(init())`
- [x] `capabilities/default.json`에 `notification:default` 권한
- [x] `runner.rs` 종료 모니터에서 `process-exit { id, code, by_user }` 이벤트(종료코드/사용자종료 캡처)

### 프론트엔드
- [x] `@tauri-apps/plugin-notification` 추가, 권한 요청(최초 1회)
- [x] `process-port` listen → "준비됨" 알림(창 비포커스 시에만, ref로 stale 방지)
- [x] `process-exit` listen → `!by_user && code!=0`일 때 "크래시" 알림
- [x] About에 알림 on/off 토글(localStorage `uvws.notify`)
- [x] i18n 키(ko/en): settings_notifications, notif_ready_*, notif_crash_*

### 검증
- [x] cargo check(경고 0) + npm run build 통과
- [ ] (수동) 실행→준비 알림 / 외부 `kill -9`→크래시 알림 / 사용자 Stop→무알림 / 토글 off→무알림. ※macOS는 최초 알림 권한 허용 필요, 창 비포커스 시에만 발사

---

## 기능 #9 — 의존성 닥터  (`09-dependency-doctor.md`)
상태: ✅ 코드 완료 (런타임 수동 확인 권장)

### 백엔드 (lib.rs, `list_dependencies` 패턴 모방)
- [x] `list_outdated(path) -> Vec<Value>` (`uv pip list --outdated --format json`)
- [x] `upgrade_package(path, name)` (`uv pip install --upgrade <name>`)
- [x] `upgrade_all(path, names)`
- [ ] (선택/2차) `audit_dependencies(path)` — `uvx pip-audit --format json` ※미구현(2차)
- [x] `lib.rs` 핸들러 등록(3종)

### 프론트엔드 (의존성 탭 확장)
- [x] "업데이트 확인" 버튼 → 구버전 목록(현재→최신) 테이블 카드
- [x] 행별 "업그레이드" + "전체 업그레이드" + 진행 표시 + 완료 후 목록/설치목록 새로고침
- [x] 업데이트 개수 배지 + "최신 상태" 안내 + 프로젝트 전환 시 초기화
- [ ] (선택) "취약점 점검" 버튼 ※미구현(2차)
- [x] i18n 키(ko/en) 10종

### 검증
- [x] cargo check(경고 0) + npm run build 통과
- [ ] (수동) 구버전 설치(`uv pip install "requests==2.20"`) → 확인 → 업그레이드 → 버전 상승 → 목록 갱신

---

## 변경 로그 (append-only, 최신이 위)

- 2026-06-07 — **기능 #9 코드 완료(= 4종 전부 완료).** lib.rs에 `list_outdated`/`upgrade_package`/`upgrade_all`(uv 래퍼) + 핸들러 등록. App.tsx deps 탭: "업데이트 확인" 버튼, 업데이트 카드(현재→최신 테이블, 행별/전체 업그레이드, 배지, 프로젝트 전환 초기화), i18n 10키. cargo check/npm build 통과.
- 2026-06-07 — **기능 #4 코드 완료.** Cargo `tauri-plugin-notification`, lib.rs plugin init, capability `notification:default`. runner.rs `process-exit{id,code,by_user}` 이벤트. App.tsx: 권한요청, `fireNotify`(포커스 시 생략), process-port→준비 알림 / process-exit→크래시 알림(ref로 stale 방지), About 토글, i18n. cargo check/npm build 통과.
- 2026-06-07 — **기능 #2 코드 완료.** `Cargo.toml` sysinfo 0.33, `lib.rs`에 `metrics_sampler`(1초 주기, 루트+자식 CPU/메모리 합산, `process-metrics` emit). App.tsx: metrics 상태+sparkRef, `Spark`/`formatBytes`, stats-bar에 CPU·MEM 칩, i18n cpu/memory, `.spark` CSS. cargo check/npm build 통과.
- 2026-06-07 — **기능 #1 코드 완료.** `src-tauri/src/tunnel.rs` 신규(check/start/stop_tunnel, tunnel-url/error/stopped 이벤트, 앱종료 정리), lib.rs 등록. App.tsx Share 버튼+모달+QR(qrcode)+리스너, i18n 11키, App.css 스타일. cargo check/npm build 통과. cloudflared 미설치라 수동 E2E는 보류.
- 2026-06-07 — 계획 문서 6종 작성(MASTER_PROMPT, PROGRESS, 01/02/04/09). 구현 미착수.
