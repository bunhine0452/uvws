# X (트위터) 스레드

스크린샷/짧은 화면녹화 GIF 첨부하면 좋음. 1번 트윗에 preview.png 붙이세요.
한국어 / 영어 버전 둘 다 준비.

---

## 한국어 버전

1/
파이썬 프로젝트 여러 개 로컬에서 돌리는 게 귀찮아서 데스크탑 앱 하나 만들었습니다.

폴더 등록해두면 그다음부턴 클릭 한 번으로 실행됨. cd 하고 venv 켜고 하던 거 끝.

uvws 👇
[스크린샷]

2/
내부적으로 uv run으로 감싸서 돌려서 venv 신경 안 써도 됩니다.
.venv 없으면 첫 실행 때 알아서 만들어주고요.

3/
제일 많이 쓰는 기능은 의외로 Kill Port.
포트 충돌 날 때마다 lsof 쳐서 pid 찾아 kill 하던 거,
버튼 하나로 강제 종료 + 진짜 비워졌는지 확인까지.

4/
로그는 앱 안에 터미널로 실시간으로 나오고,
localhost:포트 뜨면 브라우저 열기 버튼이 자동으로 생깁니다.
여러 프로젝트 동시에 띄워놓고 쓸 수 있어요.

5/
Tauri 2 + React. 맥(M1~M4/인텔), 윈도우 됩니다. uv는 미리 깔려있어야 해요.
사이드 프로젝트라 부족한 점 많은데 써보고 피드백 주시면 감사합니다 🙏

다운로드 / 깃허브:
uvws.site

---

## English version

1/
I run a bunch of Python projects locally and got tired of cd-ing into each folder and starting them by hand.

So I built a desktop app: register a folder once, then it's one click to run.

uvws 👇
[screenshot]

2/
It wraps everything in `uv run`, so you never deal with venvs. No .venv? It makes one on first run.

3/
The feature I use most turned out to be Kill Port.
Port already in use → lsof → find pid → kill → retry. Every time.
Now it's one button that SIGKILLs the process and confirms the port is actually free.

4/
Logs stream into an in-app terminal. When a localhost:PORT appears, an "open in browser" button shows up automatically. Run several projects side by side.

5/
Built with Tauri 2 + React. macOS (Apple Silicon + Intel) and Windows. You need `uv` installed.
It's a side project — feedback very welcome 🙏

uvws.site
