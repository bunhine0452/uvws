# Product Hunt 등록용

---

## Name
uvws

## Tagline (60자 제한)
Run all your uv-based Python projects from one desktop app

대안 태그라인:
- One-click run for your local Python projects, powered by uv
- Stop cd-ing into Python projects. Click to run instead.

## Description (짧은 소개)
uvws is a desktop app for people who juggle multiple Python projects locally. Register a folder once and run it with a click — it wraps everything in `uv run`, so you never touch a venv. Logs stream into a built-in terminal, a Kill Port button frees stuck ports instantly, and you can run several projects at the same time. macOS and Windows.

## First comment (메이커가 직접 다는 코멘트)
Hey everyone 👋

I built uvws to scratch my own itch. I was running a few Python projects locally at the same time — ComfyUI and a couple of my own — and the routine of opening a terminal, cd-ing in, activating the venv, and starting each one got old fast. Port conflicts meant lsof-then-kill on repeat.

So now I register a folder once and click to run. uv handles the venv resolution under the hood, the logs show up in an in-app terminal, and when something starts serving on localhost a browser button just appears.

It's a side project and not notarized on macOS yet, so you'll get a security warning on first launch (there's a one-line fix in the README). Would love to hear what's missing.

GitHub: https://github.com/bunhine0452/uvws

## Topics
Developer Tools, Python, Productivity, Mac, Windows

## Links
- Website / Download: https://uvws.vercel.app
- GitHub: https://github.com/bunhine0452/uvws

## 갤러리에 올릴 이미지
- docs/alpha/preview.png (메인 스크린샷)
- 짧은 화면녹화 GIF가 있으면 전환율 ↑
