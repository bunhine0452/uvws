# 기능 #1 — 터널 + QR 공유

## 목표 / UX
실행 중이고 포트가 감지된 프로젝트에서 **"Share"** 버튼 → 백엔드가 cloudflared 퀵 터널을 띄워 `https://<랜덤>.trycloudflare.com` 공개 URL을 만들고, 프론트가 **URL + QR 코드**를 모달로 보여준다.
- "복사", "브라우저에서 열기", "공유 중지" 액션.
- 폰으로 QR을 찍으면 로컬 서버가 바로 열림.
- 프로젝트를 Stop하거나 앱을 종료하면 터널도 자동 정리.

> 왜 cloudflared 퀵 터널인가: 계정/로그인 불필요(`cloudflared tunnel --url`), 즉시 공개 HTTPS URL. ngrok은 무료 플랜에 계정/토큰이 필요해 데모 마찰이 큼.

## 사전 조건 / 설치 전략
- 현재 이 머신엔 `cloudflared`가 PATH에 **없음**.
- **MVP:** `check_tunnel_available()`로 PATH 감지 → 없으면 모달에서 설치 안내(`brew install cloudflared` / [공식 다운로드](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)) 링크 표시.
- **2차(권장 후속):** cloudflared 바이너리를 **Tauri 사이드카(externalBin)**로 번들 → 사용자 설치 불필요. (플랫폼별 바이너리 동봉 + `tauri.conf.json bundle.externalBin` + capability `shell:allow-execute`/sidecar 권한). MVP 이후 별도 작업으로 분리.

## 백엔드 설계

신규 파일 **`src-tauri/src/tunnel.rs`** (runner.rs의 프로세스/이벤트 패턴을 그대로 모방).

```rust
// 상태: 프로젝트 id → 실행 중인 cloudflared 자식 + 공개 URL
pub struct TunnelProcess { pub child: tokio::process::Child, pub url: Arc<Mutex<Option<String>>> }
#[derive(Default)]
pub struct TunnelRegistry { pub tunnels: Mutex<HashMap<String, TunnelProcess>> }

static TRYCF_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"https://[-a-z0-9]+\.trycloudflare\.com").unwrap());
```

커맨드:
- `check_tunnel_available() -> Result<bool, String>` — `which`/`where cloudflared` (uv.rs `is_uv_installed` 패턴 복사).
- `start_tunnel(id: String, port: u16, registry: State<Arc<TunnelRegistry>>, app: AppHandle) -> Result<(), String>`
  1. 이미 있으면 에러/무시.
  2. `cloudflared tunnel --url http://localhost:{port}` 스폰(stdout+stderr piped, kill_on_drop(true), unix는 process_group(0)).
  3. stderr/stdout을 읽는 tokio 태스크에서 `TRYCF_RE`로 URL 첫 매치 → `url` 저장 + `app.emit("tunnel-url", TunnelPayload{ id, url })`.
  4. 일정 시간(~20s) 내 URL 못 찾으면 `tunnel-error` emit.
  5. registry에 저장.
- `stop_tunnel(id, registry) -> Result<(), String>` — 자식 kill(프로세스 그룹), registry에서 제거, `tunnel-stopped {id}` emit.

이벤트(신규):
- `tunnel-url` → `{ id: String, url: String }`
- `tunnel-stopped` → `{ id: String }`
- `tunnel-error` → `{ id: String, message: String }`

정리(중요):
- `runner.rs stop_project`가 끝날 때 같은 id의 터널도 stop(런너에서 TunnelRegistry 접근하거나, 프론트에서 stop 시 stop_tunnel도 호출 — **MVP는 프론트에서 stop 시 stop_tunnel 동시 호출**이 가장 단순).
- 앱 종료(`kill_all_processes` 경로)에서 모든 터널 자식도 kill. `TunnelRegistry`도 `app.manage`로 보관하고, 종료 핸들러에서 함께 정리하거나 `kill_on_drop`에 의존.

`lib.rs` 변경:
- `mod tunnel;`
- setup에서 `app.manage(Arc::new(tunnel::TunnelRegistry::default()));`
- `invoke_handler!`에 `tunnel::check_tunnel_available, tunnel::start_tunnel, tunnel::stop_tunnel` 추가.

> 권한: cloudflared를 **Rust가 직접 spawn**(kill_port의 lsof/kill과 동일)하므로 shell 플러그인/capability 불필요. 사이드카 번들로 가면 그때 권한 추가.

## 프론트엔드 설계 (`src/App.tsx`)

상태:
```ts
const [shareModal, setShareModal] = useState<{ id: string; url?: string; loading: boolean; error?: string } | null>(null);
const [tunnelAvailable, setTunnelAvailable] = useState<boolean | null>(null);
```

UI:
- 헤더 액션 영역(현재 `open_in_browser`/`kill_port` 버튼들이 있는 곳)에 **Share 버튼** 추가 — `status==="Running" && port` 일 때만 노출. 아이콘은 `lucide-react`의 `Share2`/`Globe`.
- 클릭 시: `tunnelAvailable` 확인 → 없으면 설치 안내 모달, 있으면 `setShareModal({id, loading:true})` 후 `invoke("start_tunnel", { id, port })`.
- 공유 모달: 로딩 스피너 → `tunnel-url` 수신 시 URL 텍스트 + **QR 이미지** + 복사/열기/중지.
- 중지: `invoke("stop_tunnel", { id })` + 모달 닫기.

QR 렌더:
- `pnpm add qrcode` + `pnpm add -D @types/qrcode`.
- `import QRCode from "qrcode";` → `QRCode.toDataURL(url, { width: 220, margin: 1 })` → `<img src={dataUrl} />`.

이벤트 구독(useEffect):
```ts
const un1 = listen<{id:string;url:string}>("tunnel-url", e => setShareModal(m => m?.id===e.payload.id ? {...m, url:e.payload.url, loading:false} : m));
const un2 = listen<{id:string;message:string}>("tunnel-error", e => setShareModal(m => m?.id===e.payload.id ? {...m, loading:false, error:e.payload.message} : m));
```

i18n 키(양쪽): `share`, `share_title`, `share_loading`, `share_copy`, `share_open`, `share_stop`, `share_scan_hint`("폰 카메라로 QR을 찍으세요"), `tunnel_unavailable_title`, `tunnel_unavailable_desc`, `tunnel_install_link`.

## 수용 기준 (Acceptance)
- Streamlit/Flask 등을 :PORT로 실행 → Share → 수 초 내 `*.trycloudflare.com` URL + QR 표시.
- 다른 기기/폰에서 그 URL 접속 시 로컬 앱이 열림.
- "공유 중지" 또는 프로젝트 Stop/앱 종료 시 cloudflared 프로세스가 사라짐(좀비 없음).
- cloudflared 미설치 시 친절한 안내(크래시 X).

## 검증
- `cd src-tauri && cargo check`
- `npm run build`
- 수동: `pnpm tauri dev`로 위 시나리오. `ps aux | grep cloudflared`로 중지 후 잔존 없음 확인.

## 리스크 / 캐비엇
- 퀵 터널 URL은 매번 바뀜(영구 X) — 데모/임시 공유용임을 UI에 명시.
- trycloudflare는 가용성/속도 변동 가능 — 에러 핸들링 필수.
- 보안: 공개 URL은 누구나 접근 — "외부에 노출 중" 경고 문구 표시 권장.
- 사이드카 번들(2차) 전까지는 사용자 cloudflared 설치 의존.

## 서브태스크 → `PROGRESS.md` 기능 #1 체크리스트와 1:1 매핑.
