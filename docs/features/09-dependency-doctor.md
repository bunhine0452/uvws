# 기능 #9 — 의존성 닥터

## 목표 / UX
의존성 탭(현재 설치 패키지 목록만 보여줌, App.tsx ≈849–900행)을 확장:
- **"업데이트 확인"** → 구버전 패키지 목록(현재 → 최신)을 테이블로.
- 행별 **"업그레이드"** + **"전체 업그레이드"**, 진행 스피너, 완료 후 자동 새로고침.
- 업데이트 개수 **배지**("3개 업데이트 가능").
- (선택/2차) **"취약점 점검"** — 알려진 CVE 표시.

## 백엔드 설계 (`src-tauri/src/lib.rs`)
기존 `list_dependencies`(≈127행, `uv pip list --format json`) 패턴을 그대로 모방.

```rust
/// 구버전 패키지 목록: uv pip list --outdated --format json
/// 각 항목 예: { "name", "version"(현재), "latest_version", "latest_filetype" }
#[tauri::command]
async fn list_outdated(path: String) -> Result<Vec<serde_json::Value>, String> {
    // .venv 없으면 vec![] 반환
    // TokioCommand::new("uv").current_dir(&path).args(["pip","list","--outdated","--format","json"])
    // 성공 시 파싱, 실패 시 Ok(vec![]) 또는 Err(stderr)
}

/// 단일 패키지 업그레이드: uv pip install --upgrade <name>
#[tauri::command]
async fn upgrade_package(path: String, name: String) -> Result<String, String> { ... }

/// 여러 패키지 업그레이드: uv pip install --upgrade <names...>
#[tauri::command]
async fn upgrade_all(path: String, names: Vec<String>) -> Result<String, String> { ... }
```
- (검증됨) `uv pip list --outdated --format json` 지원함.
- `lib.rs invoke_handler!`에 `list_outdated, upgrade_package, upgrade_all` 등록.

(선택/2차) 취약점:
```rust
// uvx(=ephemeral)로 pip-audit 실행 — 영구 설치 불필요
// uvx pip-audit --format json   (프로젝트 .venv 대상; 인자/대상 범위는 실행 시 조정)
#[tauri::command]
async fn audit_dependencies(path: String) -> Result<serde_json::Value, String> { ... }
```
- pip-audit 출력 JSON 구조는 버전에 따라 다름 → 실행 후 형식 확인하고 매핑. **MVP에선 생략 가능**, 토글/버튼으로 분리.

## 프론트엔드 설계 (의존성 패널 확장)

상태:
```ts
type Outdated = { name: string; version: string; latest_version: string };
const [outdated, setOutdated] = useState<Outdated[] | null>(null);
const [checkingOutdated, setCheckingOutdated] = useState(false);
const [upgrading, setUpgrading] = useState<string | null>(null); // "ALL" | pkgName | null
```

동작:
```ts
async function checkOutdated(path: string) {
  setCheckingOutdated(true);
  try { setOutdated(await invoke<Outdated[]>("list_outdated", { path })); }
  finally { setCheckingOutdated(false); }
}
async function doUpgrade(path: string, name: string) {
  setUpgrading(name);
  try { await invoke("upgrade_package", { path, name }); await checkOutdated(path); /* + 설치목록 새로고침 */ }
  finally { setUpgrading(null); }
}
async function doUpgradeAll(path: string, names: string[]) {
  setUpgrading("ALL");
  try { await invoke("upgrade_all", { path, names }); await checkOutdated(path); }
  finally { setUpgrading(null); }
}
```

UI(의존성 패널 헤더 영역에 추가):
- "업데이트 확인" 버튼 → `checkOutdated`.
- 결과 있으면: 배지(`{n}개 업데이트`) + "전체 업그레이드" 버튼.
- 테이블: 패키지 | 현재 | → | 최신 | [업그레이드] (업그레이드 중이면 해당 행 스피너/비활성).
- 0개면 "최신 상태입니다 ✅".
- 기존 "지금 동기화"/"새로고침" 버튼과 나란히 배치(이미 deps 패널에 있음).

i18n 키(양쪽): `check_updates`, `checking_updates`, `updates_available`("{n}개 업데이트 가능"), `up_to_date`, `upgrade`, `upgrade_all`, `upgrading`, `col_current`, `col_latest`, `audit`(선택), `audit_clean`, `audit_found`.

## 수용 기준
- 구버전 패키지가 있는 프로젝트에서 "업데이트 확인" → 목록에 현재/최신 표시.
- "업그레이드" → 해당 패키지 최신화 → 목록에서 사라짐(또는 갱신).
- "전체 업그레이드" → 다건 처리 후 "최신 상태" 표시.
- .venv 없으면 안내(기존 deps_no_venv 재사용).

## 검증
- `cd src-tauri && cargo check`
- `npm run build`
- 수동: 테스트 프로젝트에 일부러 구버전 설치(`uv pip install "requests==2.20"`) → 확인/업그레이드 플로우.

## 리스크 / 캐비엇
- **pyproject/uv.lock 관리 프로젝트**: `uv pip install --upgrade`는 .venv만 바꾸고 pyproject 핀/lock은 안 바꿈 → "환경만 업그레이드됨, 잠금파일은 별도" 안내 문구 권장. (lock 기반이면 `uv lock --upgrade` + `uv sync`가 정석 — 후속 개선)
- `--outdated`는 인덱스 조회로 느릴 수 있음 → 스피너 필수, 결과 캐시 고려.
- pip-audit(취약점)는 출력 스키마 변동 → 2차 작업으로 분리, MVP는 업데이트 점검까지만.

## 서브태스크 → `PROGRESS.md` 기능 #9 체크리스트와 매핑.
