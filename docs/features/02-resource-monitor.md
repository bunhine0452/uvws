# 기능 #2 — 리소스 모니터 (CPU·RAM·업타임)

## 목표 / UX
실행 중인 각 프로젝트의 **CPU%·메모리·업타임**을 실시간(~1Hz)으로 표시. 헤더 통계 행과(선택) 사이드바에 수치 + **미니 스파크라인**.
- "여러 서버를 한 앱에서 관리"라는 가치가 눈으로 보이게 → 데모/스크린샷 임팩트.

## 백엔드 설계

의존성: `src-tauri/Cargo.toml`에 `sysinfo = "0.33"` 추가(최신 안정 버전 확인). PID별 CPU/메모리 조회용.

샘플러: **단일 백그라운드 tokio 태스크**를 `lib.rs setup`에서 시작(프로세스마다 만들지 말 것).
```rust
// lib.rs setup 안, app.manage(process_registry) 이후
let app_handle = app.handle().clone();
let registry_for_metrics = Arc::clone(&process_registry); // setup으로 move되기 전 clone 주의
tauri::async_runtime::spawn(async move {
    use sysinfo::System;
    let mut sys = System::new();
    let mut ticker = tokio::time::interval(Duration::from_secs(1));
    loop {
        ticker.tick().await;
        // 1) 활성 프로세스 id→pid 스냅샷
        let targets: Vec<(String, u32)> = { /* registry.active_processes 잠가서 (id, pid) 수집 */ };
        if targets.is_empty() { continue; }
        // 2) sysinfo 갱신 (해당 PID들 + 자식 합산 위해 전체 프로세스 갱신이 단순)
        sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
        // 3) 각 타깃: pid + (부모가 pid인) 자식들의 cpu/mem 합산
        //    uv가 python 자식을 띄우므로 자식 합산이 정확. (간단화하면 pid 단독도 가능 — caveat 주석)
        // 4) 배열로 emit
        let payload: Vec<MetricPayload> = ...;
        app_handle.emit("process-metrics", payload).ok();
    }
});
```

페이로드:
```rust
#[derive(Clone, Serialize)]
struct MetricPayload { id: String, cpu: f32 /* % */, mem_bytes: u64 }
```
이벤트: `process-metrics` → `MetricPayload[]` (틱당 1회, 실행 중인 것만).

정확도 노트(주석으로 남길 것):
- `start_project`는 `uv`를 그룹 리더(pid)로 띄우고 그 자식으로 python이 돈다. CPU/RAM은 보통 **자식(python)** 에 몰림 → pid 단독 측정은 과소평가될 수 있음. `sys.process(pid).tasks`나 parent map으로 **서브트리 합산** 권장.
- CPU%는 두 샘플 간격 필요 → 1초 루프면 충분. 첫 틱은 0%로 나올 수 있음(정상).
- 크로스플랫폼: sysinfo가 macOS/Windows 모두 지원.

## 프론트엔드 설계 (`src/App.tsx`)

상태:
```ts
type Metric = { cpu: number; mem: number };
const [metrics, setMetrics] = useState<Record<string, Metric>>({});
const sparkRef = useRef<Record<string, number[]>>({}); // id → 최근 N개 cpu 샘플(스파크라인)
```

구독:
```ts
const un = listen<{id:string;cpu:number;mem_bytes:number}[]>("process-metrics", e => {
  const next: Record<string, Metric> = {};
  for (const m of e.payload) {
    next[m.id] = { cpu: m.cpu, mem: m.mem_bytes };
    const buf = (sparkRef.current[m.id] ??= []);
    buf.push(m.cpu); if (buf.length > 40) buf.shift();
  }
  setMetrics(next);
});
return () => { un.then(f=>f()); };
```

UI:
- **헤더 통계 행**(현재 업타임/환경/Python 표시 영역, App.tsx의 stats 영역)에 `CPU 12.3%` · `RAM 240 MB` 추가. 메모리 포맷 헬퍼(`bytes → MB/GB`).
- 선택: 사이드바의 실행 중 프로젝트 점/배지 옆에 작은 CPU% 표기.
- **스파크라인**: 의존성 없이 인라인 SVG 컴포넌트.
```tsx
function Spark({ data, w=60, h=18 }: { data:number[]; w?:number; h?:number }) {
  if (data.length < 2) return null;
  const max = Math.max(1, ...data);
  const pts = data.map((v,i)=>`${(i/(data.length-1))*w},${h-(v/max)*h}`).join(" ");
  return <svg width={w} height={h}><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>;
}
```

i18n 키(양쪽): `cpu`, `memory`, `res_usage`("리소스" 헤더 등 필요 시).

## 수용 기준
- 프로젝트 실행 중 CPU%·MEM이 ~1초마다 갱신, 스파크라인이 움직임.
- 프로젝트 중지 시 해당 수치/스파크라인 사라짐(metrics에서 제거).
- 여러 개 동시 실행 시 각각 독립 표시.
- 유휴 시 CPU 사용량(샘플러) 미미.

## 검증
- `cd src-tauri && cargo check` (sysinfo 추가 후)
- `npm run build`
- 수동: `pnpm tauri dev` → 부하 주는 스크립트 실행 시 CPU 상승 관찰.

## 리스크 / 캐비엇
- 서브트리 합산 미구현 시 수치 과소 → 최소한 caveat 주석 + 추후 개선 메모.
- sysinfo 버전 API 변동 가능(`refresh_processes` 시그니처) → 컴파일 에러 시 해당 버전 문서 확인.
- 1초 전체 프로세스 갱신 비용이 크면 타깃 PID만 갱신하도록 최적화(`ProcessesToUpdate::Some(&pids)`).

## 서브태스크 → `PROGRESS.md` 기능 #2 체크리스트와 매핑.
