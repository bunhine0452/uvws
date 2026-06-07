# uvws 신규 기능 구현 계획 (기능 1·2·4·9)

이 폴더는 uvws 앱에 추가할 4개 기능의 **구현 계획 + 세션 인수인계** 문서다.
세션이 끊겨도 새 AI가 이 문서들만 읽고 이어서 작업할 수 있도록 설계됨.

## 읽는 순서
1. **`MASTER_PROMPT.md`** ← 새 세션이 가장 먼저 읽는 오리엔테이션(코드 구조·패턴·빌드·관례). 새 AI에게 그대로 붙여넣어도 됨.
2. **`PROGRESS.md`** ← 단일 진척도 소스. 현재 상태 + `NEXT ACTION` + 체크리스트. **작업 때마다 갱신.**
3. 기능별 상세 설계:
   - `01-tunnel-qr-share.md` — 터널 + QR 공유
   - `02-resource-monitor.md` — CPU·RAM·업타임 모니터
   - `04-native-notifications.md` — 네이티브 알림(준비됨/크래시)
   - `09-dependency-doctor.md` — 구버전 점검 + 1클릭 업그레이드

## 한눈에
| # | 기능 | 난이도 | 핵심 변경 | 새 의존성 |
|---|------|--------|-----------|-----------|
| 1 | 터널+QR 공유 | 중 | `src-tauri/src/tunnel.rs` 신규, App.tsx 공유 모달 | npm `qrcode` / (외부)`cloudflared` |
| 2 | 리소스 모니터 | 중 | `lib.rs` 샘플러 태스크, `process-metrics` 이벤트, App.tsx 통계 | cargo `sysinfo` |
| 4 | 네이티브 알림 | 하~중 | `process-exit` 이벤트, App.tsx 구독 | `tauri-plugin-notification` |
| 9 | 의존성 닥터 | 중 | `lib.rs` uv 래퍼 3종, deps 패널 확장 | (없음, uv 사용) |

## 권장 구현 순서
**1 → 2 → 4 → 9**
- 1·2는 `runner`/프로세스 레지스트리 위에 얹는 작업이라 컨텍스트가 이어짐.
- 4는 1·2에서 다루는 프로세스 생명주기/이벤트와 자연스럽게 묶임.
- 9는 의존성 탭만 건드려 독립적 → 마지막 또는 병렬 가능.

## 절대 규칙 (요약 — 자세힌 MASTER_PROMPT)
- 새 Rust 커맨드는 **`lib.rs invoke_handler!`에 등록**.
- 새 이벤트/플러그인 추가 시 **capability 권한**도 추가.
- i18n는 **ko/en 양쪽** 키 추가.
- 기존 이벤트(`process-status`/`process-port`/`log-stream-{id}`)와 프로세스 정리 의미 **회귀 금지**.
- 변경 후 **`cargo check` + `npm run build`** 로 검증, `PROGRESS.md` 갱신.
- **`landing/`(마케팅 사이트)는 이 작업과 무관 — 건드리지 말 것.**
