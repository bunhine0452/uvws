<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="100" alt="uvws icon" />
</p>

<h1 align="center">uvws</h1>
<p align="center">
  Python 프로젝트를 한 곳에서 관리하는 데스크탑 앱 — <code>uv</code> 기반
</p>

<p align="center">
  <a href="https://uvws.vercel.app"><b>uvws.vercel.app</b></a>
</p>

<p align="center">
  <a href="https://github.com/bunhine0452/uvws/releases"><img src="https://img.shields.io/github/v/release/bunhine0452/uvws?style=flat-square&color=6366f1" alt="Release" /></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-333?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/powered%20by-Tauri%202-24C8D8?style=flat-square&logo=tauri&logoColor=white" alt="Tauri 2" />
  <img src="https://img.shields.io/badge/package%20manager-uv-DE5FE9?style=flat-square" alt="uv" />
  <img src="https://img.shields.io/github/license/bunhine0452/uvws?style=flat-square&color=868e96" alt="License" />
</p>

---

Python 프로젝트가 여러 개라면, 매번 `cd`하고 `source .venv/bin/activate`하고 `python main.py`를 치는 게 슬슬 귀찮아지는 시점이 옵니다. uvws는 그 과정을 클릭 한 번으로 줄여줍니다.

<p align="center">
  <img src="docs/alpha/preview.png" width="720" alt="uvws screenshot" />
</p>

---

## 다운로드

[**uvws.vercel.app**](https://uvws.vercel.app) 또는 [**Releases 페이지**](https://github.com/bunhine0452/uvws/releases)에서 바로 받을 수 있습니다.

| 플랫폼 | 파일 |
|---|---|
| macOS Apple Silicon (M1~M4) | `uvws_x.x.x_aarch64.dmg` |
| macOS Intel | `uvws_x.x.x_x64.dmg` |
| Windows 10+ | `uvws_x.x.x_x64-setup.exe` |

**선행 조건:** [uv](https://docs.astral.sh/uv/getting-started/installation/)가 설치되어 있어야 합니다.

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

### macOS 첫 실행 시 보안 경고

앱이 Apple 공증을 받지 않았기 때문에 경고가 뜰 수 있습니다.

- **"손상된 앱" 오류**: 터미널에서 `xattr -cr /Applications/uvws.app` 실행 후 재시도
- **일반 경고**: 앱을 우클릭 → Open → Open 확인

한 번만 하면 그 다음부터는 정상 실행됩니다.

---

## 주요 기능

**프로젝트 등록 & 실행**
폴더를 등록하면 이후 클릭 한 번으로 실행됩니다. `uv run`으로 자동 래핑되어 가상환경 없이도 바로 동작하고, `.venv`가 없으면 첫 실행 시 자동으로 만들어줍니다.

**임포트 위저드**
`requirements.txt`나 `pyproject.toml`이 있는 폴더를 가져올 때 Python 버전(3.10–3.13)을 선택하고 의존성 설치까지 한 번에 처리합니다.

**내장 터미널**
각 프로젝트의 stdout/stderr가 xterm.js 터미널로 실시간 스트리밍됩니다. 로그에서 `localhost:XXXX` 형태의 주소가 감지되면 브라우저 열기 버튼이 자동으로 나타납니다.

**포트 관리 (강제 종료)**
특정 포트를 점유한 프로세스를 무조건 강제(SIGKILL)로 종료합니다. 포트가 실제로 비워질 때까지 재시도·검증하므로 "포트가 이미 사용 중" 에러에 더 이상 `lsof -i`를 칠 필요가 없습니다.

**동시 실행 & 자동 정리**
여러 프로젝트의 localhost 서버를 동시에 띄울 수 있고, 각 프로젝트는 독립된 터미널·포트로 관리됩니다. 앱을 종료하면 실행 중이던 서버가 모두 함께 정리되고, 비정상 종료 시에도 다음 실행에서 남은 서버를 자동으로 청소합니다.

**Git 통합**
프로젝트 폴더가 Git 저장소라면 브랜치·ahead/behind·변경 파일 수와 최근 커밋을 한눈에 보고, Fetch / Pull / Push를 버튼 한 번으로 실행할 수 있습니다.

**의존성 뷰어**
`.venv`에 설치된 패키지 목록과 버전을 확인하고, Sync 버튼으로 `requirements.txt` / `pyproject.toml` 기준으로 재설치할 수 있습니다.

**한국어 / 영어**
About 화면에서 언어를 즉시 전환할 수 있습니다.

---

## 소스 빌드

```bash
git clone https://github.com/bunhine0452/uvws.git
cd uvws
pnpm install
pnpm tauri dev       # 개발 모드
pnpm tauri build     # 릴리스 빌드
```

빌드 결과물은 `src-tauri/target/release/bundle/`에 생성됩니다.

**필요 환경:** Node.js 18+, pnpm, Rust stable, uv, [Tauri 사전 조건](https://v2.tauri.app/start/prerequisites/)

---

## 로드맵

- [x] 프로젝트 등록/설정/삭제
- [x] uv run 기반 원클릭 실행
- [x] xterm.js 실시간 터미널
- [x] 포트 자동 감지 & 브라우저 열기
- [x] Kill Port
- [x] 임포트 위저드 (Python 버전 선택 포함)
- [x] 의존성 뷰어 & Sync
- [x] 동시 다중 실행 & 앱 종료 시 자동 서버 정리
- [x] Git 통합 (status, fetch, pull, push)
- [x] 다국어 지원 (한국어 / 영어)
- [ ] 플러그인 시스템
- [ ] Docker 컨테이너 관리

---

## 기여

PR과 이슈 모두 환영합니다. 버그 리포트나 기능 제안은 [Issues](https://github.com/bunhine0452/uvws/issues)에 남겨주세요.

---

## 라이선스

[MIT License](LICENSE)
