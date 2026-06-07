# 기능 #4 — 네이티브 알림

## 목표 / UX
- **서버 준비됨:** 포트 감지(`process-port`) 시 "✅ {프로젝트} 준비됨 — localhost:{port}" OS 알림.
- **크래시:** 사용자가 Stop 안 했는데 비정상 종료(exit code ≠ 0)면 "⚠️ {프로젝트} 비정상 종료 (exit {code})" 알림.
- 창이 **비포커스**일 때만 알림(포커스 중엔 노이즈) — 권장.
- About/설정에 알림 on/off 토글.

## 백엔드 설계

플러그인 추가:
1. `src-tauri/Cargo.toml`: `tauri-plugin-notification = "2"`
2. `package.json`: `pnpm add @tauri-apps/plugin-notification`
3. `lib.rs` 빌더 체인에 `.plugin(tauri_plugin_notification::init())`
4. `src-tauri/capabilities/default.json` `permissions`에 `"notification:default"` 추가

> 알림은 **프론트엔드 JS 플러그인**으로 발사하는 게 단순(프론트가 이미 `process-port`/상태 이벤트를 구독 중). 백엔드는 **크래시 판별 신호만** 추가하면 됨.

크래시 판별용 이벤트(신규) — `runner.rs`의 종료 모니터 태스크:
- 현재 `tokio::select!`에서 `child.wait()` vs `kill_rx`로 분기하고 `exit_note`만 만든다(≈303–312행).
- 여기서 **exit code와 사용자 종료 여부**를 캡처해 이벤트로 보낸다:
```rust
// child.wait() 분기에서:
let code = exit_status.code();          // Option<i32>
let by_user = false;
// kill_rx 분기에서:
let by_user = true; let code = None;
// 정리 직전(=process-status "Stopped" emit 부근, ≈345행)에서:
app_clone.emit("process-exit", ExitPayload { id: id_clone.clone(), code, by_user }).ok();
```
```rust
#[derive(Clone, Serialize)]
pub struct ExitPayload { pub id: String, pub code: Option<i32>, pub by_user: bool }
```
- `process-status`("Stopped")는 **그대로 유지**(회귀 금지). `process-exit`는 추가 신호일 뿐.

## 프론트엔드 설계 (`src/App.tsx`)

import: `import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";`
window 포커스: `import { getCurrentWindow } from "@tauri-apps/api/window";` (또는 `document.hasFocus()`).

권한(앱 시작 시 1회):
```ts
useEffect(() => { (async () => {
  let granted = await isPermissionGranted();
  if (!granted) granted = (await requestPermission()) === "granted";
})(); }, []);
```

설정 토글:
```ts
const [notifyEnabled, setNotifyEnabled] = useState(() => localStorage.getItem("uvws.notify") !== "0");
// 토글 변경 시 localStorage.setItem("uvws.notify", notifyEnabled ? "1" : "0")
```
About 모달(≈1138행)에 체크박스 1개 추가.

알림 발사 헬퍼:
```ts
const nameOf = (id:string) => projects.find(p=>p.id===id)?.name ?? id;
async function notify(title:string, body:string) {
  if (!notifyEnabled) return;
  if (document.hasFocus()) return;           // 포커스 중엔 생략(선택)
  if (await isPermissionGranted()) sendNotification({ title, body });
}
```

구독:
- 기존 `process-port` listen(≈230행) 콜백에 추가: `notify(t("notif_ready_title"), t("notif_ready_body", { name: nameOf(id), port }))`.
- 신규 `process-exit` listen:
```ts
const un = listen<{id:string;code:number|null;by_user:boolean}>("process-exit", e => {
  const { id, code, by_user } = e.payload;
  if (!by_user && code !== 0 && code !== null)
    notify(t("notif_crash_title"), t("notif_crash_body", { name: nameOf(id), code }));
});
```

i18n 키(양쪽): `notif_ready_title`, `notif_ready_body`("{name} 준비됨 — localhost:{port}"), `notif_crash_title`, `notif_crash_body`("{name} 비정상 종료 (exit {code})"), `settings_notifications`, `notif_enable`.

## 수용 기준
- 서버 실행 후 포트 뜨면(창 비포커스 시) "준비됨" 알림 1회.
- 외부에서 해당 프로세스를 강제 종료(크래시 시뮬레이션) → "비정상 종료" 알림.
- 사용자가 Stop 버튼으로 종료 → **알림 없음**(by_user=true).
- 토글 off면 어떤 알림도 안 옴.

## 검증
- `cd src-tauri && cargo check`
- `npm run build`
- 수동: `pnpm tauri dev`. 크래시 테스트는 실행 중 프로젝트의 python PID를 외부 터미널에서 `kill -9`.

## 리스크 / 캐비엇
- macOS 알림은 시스템 설정에서 앱 알림 허용 필요(최초 권한 요청). 미허용 시 조용히 무시.
- `code === null`(시그널로 종료 등)은 크래시로 보지 않음 — 정책은 조정 가능(주석으로 명시).
- 포커스 필터를 넣으면 데모 시 "왜 안 떠?" 혼동 가능 → 설정으로 강제 표시 옵션 고려.

## 서브태스크 → `PROGRESS.md` 기능 #4 체크리스트와 매핑.
