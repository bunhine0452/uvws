# X (트위터) 스레드

1번 트윗에 데모 GIF(또는 preview.png) 첨부 필수. 해시태그는 마지막 트윗에만 가볍게.
추천 태그: #ComfyUI #StableDiffusion #Python #uv #buildinpublic
이 원고는 v0.5(uv 자동 설치) 출시 후를 전제로 합니다.

---

## 한국어 버전

1/
ComfyUI랑 파이썬 앱 여러 개 로컬에서 띄워 쓰는 게 귀찮아서 데스크탑 런처를 하나 만들었어요.

폴더 등록해두면 그다음부턴 클릭 한 번으로 실행. cd 하고 venv 켜고 하던 거 끝.

uvws 👇
[데모 GIF]

2/
내부적으로 uv run으로 감싸 돌려서 venv 신경 안 써도 됩니다.
.venv 없으면 첫 실행 때 알아서 만들고, uv가 안 깔려 있으면 앱이 설치까지 해줘요.

3/
제일 많이 쓰는 건 의외로 Kill Port.
포트 충돌마다 lsof 쳐서 pid 찾아 kill 하던 거,
버튼 하나로 강제 종료 + 진짜 비워졌는지 확인까지.

4/
로그는 앱 안 터미널로 실시간으로 나오고,
localhost:포트 뜨면 브라우저 열기 버튼이 자동 생성.
여러 프로젝트 동시에 띄워놓고 씁니다.

5/
요즘 제일 좋아하는 건 공유 + QR.
실행 중인 로컬 서버를 공개 링크 + QR로 한 번에 노출 →
폰으로 QR 찍어서 내 ComfyUI 결과를 바로 봅니다. 배포 0.

6/
Tauri 2 + React. 맥(M1~M4/인텔), 윈도우 됩니다.
개인 사이드 프로젝트라 부족한 점 많은데 써보고 피드백 주시면 감사해요 🙏

다운로드 / 깃허브: uvws.site
#ComfyUI #Python #uv #buildinpublic

---

## English version

1/
I run a few local AI apps (ComfyUI, dev servers, my own scripts) and got tired of cd-ing into each folder and starting them by hand.

So I built a desktop launcher: register a folder once, then it's one click.

uvws 👇
[demo GIF]

2/
It wraps everything in `uv run`, so you never deal with venvs. No .venv? It makes one on first run. No uv at all? The app installs it for you.

3/
The feature I use most turned out to be Kill Port.
Port already in use → lsof → find pid → kill → retry. Every time.
Now it's one button that SIGKILLs the process and confirms the port is actually free.

4/
Logs stream into an in-app terminal. When a localhost:PORT appears, an "open in browser" button shows up automatically. Run several apps side by side.

5/
My current favorite: Share + QR.
One click exposes a running local server via a public link + QR — so I scan it and pull up my ComfyUI/WebUI on my phone. No deploy.

6/
Built with Tauri 2 + React. macOS (Apple Silicon + Intel) and Windows.
It's a side project — feedback very welcome 🙏

uvws.site
#ComfyUI #StableDiffusion #Python #uv
