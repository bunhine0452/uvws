---
schema_version: 1
type: feature
slug: uv-python-version-management
status: done
difficulty: medium
created_at: "2026-06-16T20:48:43+09:00"
session_id: "manual-20260616-190212"
agent:
  id: claude-code
  version: "4.8"
language: ko
verified_by_user: false
files_touched:
  - path: src-tauri/src/lib.rs
    op: update
    bytes_added: 3400
    bytes_removed: 0
  - path: src/App.tsx
    op: update
    bytes_added: 2600
    bytes_removed: 60
  - path: src/App.css
    op: update
    bytes_added: 1700
    bytes_removed: 0
  - path: src/i18n.tsx
    op: update
    bytes_added: 900
    bytes_removed: 0
related:
  - ../Chores/1925_chore_release-v0.6.0.md
tags: ["uv", "python-version", "config-tab", "pyenv", "dotpython-version"]
---

[x] 설정 탭에서 프로젝트별 Python 버전을 uv로 설치·고정하는 기능

## 추가 기능
프로젝트 **Config 탭**에 "Python 버전" 카드를 추가. uv가 아는 CPython 마이너
버전을 칩 목록으로 보여주고, 클릭하면 그 버전을 프로젝트에 고정한다.

- 설치된 버전엔 초록 점, 미설치엔 회색 점. 현재 핀(`.python-version`)에 해당하는
  마이너는 accent 배경으로 강조. 헤더 배지에 현재 핀 표시.
- 칩 클릭 → 미설치면 `uv python install <minor>`(스피너 표시) 후
  `uv python pin <minor>` → `.python-version` 작성. `uv run`/`uv venv`가 이 핀을
  따르므로 실행 로직은 손대지 않았다.

### Backend (`lib.rs`, 4개 커맨드)
- `uv_python_list()` → `uv python list --output-format json` 파싱. cpython +
  default variant + 안정 릴리스(정규식 `^\d+\.\d+\.\d+$`, a/b/rc 제외)만, 마이너별
  최신 패치로 dedupe, 3.8+ 노출. installed = 그 마이너 빌드 중 `path != null` 존재.
  반환 `{minor, version, installed}[]` (최신 마이너가 위).
- `uv_python_install(version)` — 형식 검증(`^\d+(\.\d+){0,2}$`) 후 설치(다운로드라
  수십 초 소요 가능, await).
- `uv_python_pin(path, version)` — 프로젝트 디렉터리에서 `uv python pin`. 실패 시
  (requires-python 비호환 등) stderr를 그대로 사용자에게 노출.
- `get_python_pin(path)` — `.python-version` 읽어 `Option<String>`.

### Frontend (`App.tsx`)
- `PythonVersionInfo` 인터페이스 + 상태(`pythonVersions`/`pythonPin`/
  `pyVerLoading`/`pyVerBusy`). `loadPythonInfo()`는 list+pin 병렬 로드.
- Config 탭 활성 또는 프로젝트 전환 시 자동 로드(기존 git 탭 로딩 패턴 동일).
- `handlePinPython()`: (미설치→설치)→핀→새로고침, 실패 시 dialog `message`.
- i18n ko/en 키 추가(`python_version`은 셋업 모달에 이미 있어 재사용 — 중복 정의
  제거). CSS `.py-ver-chip/.py-ver-dot/.py-ver-spin`(기존 `spin` 키프레임 재사용).

## 동작 흐름
프로젝트 선택 → Config 탭(기본) → "Python 버전" 카드에서 칩 클릭 →
(필요 시 설치) → `.python-version` 고정 → 배지/강조 갱신. 다음 `uv run`/venv 생성부터
해당 버전 사용.

## 검증
`pnpm build`(tsc + vite) 통과, `cargo check` 통과. `uv python list --output-format
json`의 실제 출력으로 필터 로직을 파이썬으로 재현해 결과 확인(3.14 미설치 / 3.13~3.9
설치 / 3.8 미설치 — Rust 로직과 일치). 런타임 칩 클릭/설치 흐름은 GUI라
`pnpm tauri dev` 수동 확인 권장.

## 메모
- `uv python list`는 번들된 python-build-standalone 매니페스트 기반이라 오프라인에서도
  빠르게 목록을 낸다(설치만 네트워크 필요).
- 아직 미배포(커밋만). 릴리스(v0.7.0) 여부는 사용자 확인 후.
