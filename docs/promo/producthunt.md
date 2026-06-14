# Product Hunt 등록용

> 화요일~목요일 00:01 PST 런칭 권장. 갤러리 1번은 데모 GIF, 2번은 preview.png.
> 메이커 코멘트는 발행 직후 바로 첫 댓글로.

---

## Name
uvws

## Tagline (60자 제한)
One-click launcher for ComfyUI, Python apps & local servers

대안 태그라인:
- Run your local Python & AI apps in one click, powered by uv
- Stop cd-ing into Python projects. Click to run instead.
- The desktop launcher for local AI apps and Python servers

## Description (짧은 소개)
uvws is a desktop app for people who juggle local Python and AI apps. Register a folder once and launch it with a click — ComfyUI, Stable Diffusion WebUI, FastAPI, Streamlit, your own scripts. It wraps everything in Astral's `uv` (and installs uv for you if you don't have it), so you never touch a venv. Logs stream into a built-in terminal, a Kill Port button frees stuck ports instantly, you can run several apps at once, and a one-click public link + QR lets you open a running app on your phone. macOS and Windows. Free and open source.

## First comment (메이커가 직접 다는 코멘트)
Hey everyone 👋

I built uvws to scratch my own itch. I was running a few local AI apps at the same time — ComfyUI and a couple of my own things — and the routine of opening a terminal, cd-ing in, activating the venv, and starting each one got old fast. Port conflicts meant lsof-then-kill on repeat.

So now I register a folder once and click to run. `uv` handles the venv resolution under the hood (and the app will set uv up for you if it's missing), logs show up in an in-app terminal, and when something starts serving on localhost a browser button just appears. The two things I didn't expect to love: the Kill Port button, and a one-click public link + QR that lets me pull up a local UI on my phone without deploying anything.

It's a side project and not notarized on macOS yet, so you'll get a security warning on first launch (one-line fix in the README). Would genuinely love to hear what's missing.

GitHub: https://github.com/bunhine0452/uvws

## Topics
Developer Tools, Artificial Intelligence, Python, Productivity, Mac

## Links
- Website / Download: https://uvws.site
- GitHub: https://github.com/bunhine0452/uvws

## 갤러리 이미지
1. 데모 GIF (클릭 → 터미널 스트림 → 브라우저 열림 → 공유 QR) ← 1번에 꼭
2. docs/alpha/preview.png (메인 스크린샷)
3. 공유 + QR 화면 (폰으로 스캔하는 장면이면 더 좋음)
