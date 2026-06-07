# MASTER PROMPT — uvws 기능 4종 구현 이어가기

> 이 파일은 **세션이 끊겼을 때 새 AI 세션에 그대로 붙여넣는 오리엔테이션 프롬프트**다.
> 한 번 읽으면 (1) 무엇을 만드는지, (2) 코드 구조, (3) 지금 어디까지 왔는지, (4) 다음에 뭘 할지를 알 수 있다.

## 0. 너의 임무

uvws(데스크탑 앱)에 아래 4개 기능을 **순서대로** 구현한다. 각 기능의 상세 설계는 같은 폴더의 개별 문서에 있다.

| # | 기능 | 설계 문서 | 한 줄 요약 |
|---|------|-----------|-----------|
| 1 | 터널 + QR 공유 | `01-tunnel-qr-share.md` | 실행 중인 로컬 서버를 공개 URL + QR로 1클릭 공유 |
| 2 | 리소스 모니터 | `02-resource-monitor.md` | 프로젝트별 CPU·RAM·업타임 실시간 표시(스파크라인) |
| 4 | 네이티브 알림 | `04-native-notifications.md` | 서버 준비됨/크래시 시 OS 알림 |
| 9 | 의존성 닥터 | `09-dependency-doctor.md` | 구버전 패키지 점검 + 1클릭 업그레이드 |

**작업 시작 전 항상 `PROGRESS.md`를 먼저 읽어라.** 거기에 현재 상태와 `NEXT ACTION`이 있다.

## 1. 작업 루프 (매번 이렇게)

1. `PROGRESS.md`를 열어 `NEXT ACTION`과 진행 중인 기능을 확인한다.
2. 해당 기능 설계 문서를 열어 **다음 미완료 체크박스** 1개를 고른다.
3. 구현한다 (백엔드 → lib.rs 등록 → 프론트 invoke/listen → i18n → UI).
4. **검증한다**: `cd src-tauri && cargo check` (Rust), `npm run build` (TS 타입체크/빌드). 가능하면 `pnpm tauri dev`로 실제 동작 확인.
5. `PROGRESS.md`의 해당 체크박스를 `[x]`로 바꾸고, 날짜와 한 줄 메모를 남긴다.
6. 기능 하나가 happy-path로 끝나면 커밋한다(아래 §6).

> 한 번에 한 기능만. 기능 안에서도 백엔드 한 덩어리 → 검증 → 프론트 한 덩어리 → 검증으로 쪼개라.

## 2. 프로젝트 구조 (알아야 할 핵심)

- **앱 = Tauri 2 + React 19 + TypeScript + Vite.** Rust 백엔드 + 웹 프론트.
- **랜딩 사이트(`landing/`)는 이 작업과 무관 — 건드리지 말 것.** (uvws.site 마케팅 페이지)
- 레포: 로컬 디렉터리명은 `PySpace`, 깃 원격은 `github.com/bunhine0452/uvws`.

### 백엔드 (`src-tauri/src/`)
- `lib.rs` — **커맨드 등록(`invoke_handler!`)·플러그인 init·setup·앱 상태**. 새 커맨드는 여기 핸들러 목록에 반드시 추가. (`get_projects`, `setup_project_env`, `list_dependencies` 등 단순 커맨드의 본체도 여기 있음)
- `runner.rs` — **프로세스 실행 엔진**. `ProcessRegistry`(active_processes: `HashMap<id, RunningProcess{ pid, kill_tx, logs, port }>`), `start_project`/`stop_project`/`get_process_logs`/`kill_port`, 로그 스트리밍, **포트 자동 감지(`PORT_REGEX`)**, 앱 종료 시 정리(`kill_all_processes`)·고아 정리(`cleanup_orphans`).
- `uv.rs` — `create_venv`, `install_dependencies`, `is_uv_installed`.
- `config.rs` — `Project` 구조체, `ConfigManager`(설정 파일 읽기/쓰기).
- `git.rs` — git 커맨드들(패턴 참고용).
- `main.rs` — 진입점(`run()` 호출만).

### 프론트엔드 (`src/`)
- `App.tsx` (~1180줄) — **메인 UI 전체**. invoke/listen, 사이드바 프로젝트 목록, 우측 탭 패널, About 모달.
- `components/TerminalView.tsx` — xterm.js 터미널(로그 스트림 구독).
- `i18n.tsx` — 다국어. `translations.ko` / `translations.en`.

### `Project` 구조체 (config.rs)
```rust
struct Project { id, name, path, git_url: Option, run_command, env: HashMap<String,String>,
                 status, python_path: Option, icon_color: Option, port: Option<u16> }
```

## 3. 백엔드 패턴 (커맨드/이벤트)

### 새 커맨드 추가
```rust
#[tauri::command]
pub async fn my_cmd(path: String, registry: tauri::State<'_, Arc<ProcessRegistry>>) -> Result<T, String> { ... }
```
그리고 `lib.rs`의 `invoke_handler![ ... ]` (≈210행) 목록에 `runner::my_cmd` 또는 `my_cmd`를 추가. 안 하면 프론트에서 호출 시 "command not found".

- 앱 상태 접근: `state: State<'_, AppState>` (config_manager) / `registry: State<'_, Arc<runner::ProcessRegistry>>`.
- **인자 키는 snake_case로 Rust 파라미터명과 일치해야 한다.** 프론트에서 `invoke("my_cmd", { path, ... })`.

### 이벤트 (백엔드 → 프론트)
- 백엔드: `app_handle.emit("event-name", payload)` (payload는 `#[derive(Clone, Serialize)]`).
- 프론트: `listen<T>("event-name", (e) => { e.payload ... })` (`@tauri-apps/api/event`).
- **기존 이벤트(이미 동작 중, 절대 깨지 말 것):**
  - `process-status` → `{ id, status }` ("Running"|"Stopped"|"Installing"|"Error")
  - `process-port` → `{ id, port }` (포트 자동 감지 시 1회)
  - `log-stream-{id}` → `string` (터미널 로그 청크)

### 플러그인 추가 (예: notification)
1. `src-tauri/Cargo.toml` 의존성에 `tauri-plugin-notification = "2"` 추가.
2. `package.json`에 `@tauri-apps/plugin-notification` 추가(`pnpm add`).
3. `lib.rs` 빌더에 `.plugin(tauri_plugin_notification::init())` 추가.
4. `src-tauri/capabilities/default.json`의 `permissions`에 `"notification:default"` 추가.

## 4. 프론트엔드 패턴 (App.tsx)

- import: `invoke` (`@tauri-apps/api/core`), `listen` (`@tauri-apps/api/event`), `openUrl` (`@tauri-apps/plugin-opener`).
- 호출: `const r = await invoke<T>("cmd", { argA, argB });`
- 구독: `useEffect`에서 `const un = listen(...); return () => { un.then(f=>f()); }`.
- **탭 구조:** `type TabId = "config" | "env" | "deps" | "git"` (≈71행). 탭 버튼 ≈713–722행, 패널은 `{activeTab === "deps" && (...)}` 식으로 ≈728–905행. **의존성 패널 ≈849–900행**(기능 9가 여기 확장).
- 헤더 통계 행(업타임/환경/Python)에 CPU·MEM 추가 가능(기능 2).
- About 모달 ≈1138행(설정 토글 둘 곳, 기능 4).

### i18n (필수)
- `src/i18n.tsx`의 `translations.ko`와 `translations.en` **양쪽 모두**에 키 추가. 누락 시 키 문자열이 그대로 노출됨.
- 사용: `t("key")`, 파라미터: `t("key", { port })` ← 문자열 안 `{port}` 치환.
- ⚠️ 이 i18n은 **앱 전용**이다. `landing/index.html`의 i18n과 혼동 금지.

## 5. 빌드 / 실행 / 검증

```bash
# Rust 타입/컴파일 체크 (빠름, 백엔드 수정 후 필수)
cd src-tauri && cargo check

# TS 타입체크 + 프론트 빌드 (프론트 수정 후 필수)
npm run build            # = tsc && vite build

# 앱 실제 실행 (수동 동작 확인)
pnpm tauri dev           # 또는 npm run tauri dev   (devUrl http://localhost:1422)

# 릴리스 빌드 (보통 사용자/CI가 함)
pnpm tauri build
```

- 패키지 매니저는 **pnpm** 우선(레포에 pnpm-lock + README 기준). npm도 동작은 함.
- `npm run dev`는 프론트만(vite). 백엔드까지 보려면 `tauri dev`.

## 6. 관례 & 커밋

- **주석은 한국어, 기존 스타일에 맞춰 충실히.** 주변 코드의 네이밍·밀도를 따라간다.
- 기존 이벤트/프로세스 정리 의미(kill_on_drop, 프로세스 그룹, 고아 정리)를 **회귀시키지 말 것**.
- 새 의존성/플러그인은 최신 안정 버전 확인 후 추가(문서의 버전은 참고값).
- 기능 하나가 happy-path로 끝나면 커밋:
  - 메시지 예: `feat(tunnel): one-click public URL + QR share for running projects`
  - 끝에 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
  - **푸시/배포는 사용자가 요청할 때만.** (이 레포는 main 직접 커밋 흐름)
- 작업 끝마다 `PROGRESS.md` 갱신은 **필수**(다음 세션의 유일한 진척 정보원).

## 7. 지금 시작하기

→ **`PROGRESS.md`를 열고 `NEXT ACTION`을 수행하라.**
