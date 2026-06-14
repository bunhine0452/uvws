# English — Reddit + Show HN

> **Sequencing:** post to ONE subreddit at a time, a few days apart. Lead with the
> community that fits best (the local-AI subs), then r/Python, then Show HN.
> Always attach the demo GIF (see `demo-gif-storyboard.md`) — it converts far better than text.
> This copy assumes **v0.5 is shipped** (uv auto-install + onboarding), so the old
> "you must install uv first" objection is gone. If you launch on v0.4.x, drop the
> "it'll install uv for you" line.

---

## r/comfyui  ·  r/StableDiffusion  (lead channel — best fit)

**Title**
I made a one-click launcher for ComfyUI / WebUI so I stop living in the terminal (free, open source)

**Body**
I run a few local AI apps side by side — ComfyUI, a WebUI, the odd Gradio demo — and the routine got old: open a terminal, cd into the folder, activate the venv, `python main.py`, wait, find the port, paste it into the browser. Do it again for the next one. And when a port was stuck it was `lsof -i` → find pid → kill → retry.

So I built **uvws** — a small desktop app that does all of that with one click.

- Register a folder once → after that it's a single click to launch. Runs are wrapped in `uv run`, so you never touch a venv; if there's no `.venv` it creates one on first run.
- When `localhost:8188` (or whatever) shows up in the logs, an **"Open in browser"** button just appears — no copy-pasting ports.
- **Kill Port** button that actually SIGKILLs whatever is holding a port and confirms it's free. (The thing I use most.)
- Run **several apps at once**, each with its own live terminal + port. Quit the app and everything it started is cleaned up.
- **Share + QR** — expose a running app through a public link + QR in one click, so you can open your ComfyUI/WebUI on your phone or send it to a friend without deploying anything.
- Live **CPU / RAM monitor** per app, and **native notifications** when a server is ready or crashes.
- It's `uv`-based; if you don't have uv, the app offers to install it for you.

macOS (Apple Silicon + Intel) and Windows. Free and open source, built with Tauri 2.

Fair warning: it's a side project and not notarized on macOS yet, so you'll get a security warning on first launch — one-line workaround in the README.

Site / download: https://uvws.site
GitHub: https://github.com/bunhine0452/uvws

Would love to hear which local apps you'd want it to handle better.

---

## r/LocalLLaMA  (variant)

**Title**
A one-click desktop launcher for your local Python servers (oobabooga, llama-cpp-python, vLLM, etc.) — free & open source

**Body**
Same idea as above, reframed: if you run local LLM servers (text-generation-webui, llama-cpp-python, a vLLM/FastAPI wrapper, etc.) you know the loop — terminal, cd, venv, launch, find the port, repeat. uvws turns each project into a one-click launch with a live in-app terminal, auto port-detection + open-in-browser, a Kill Port button, and concurrent runs. It's `uv`-based (installs uv for you if needed). There's also a live CPU/RAM monitor per process and a one-click public-link + QR share so you can hit your local UI from your phone.

Honest note: the resource monitor is CPU/RAM, not VRAM — so it complements `nvidia-smi`, it doesn't replace it.

Site: https://uvws.site · GitHub: https://github.com/bunhine0452/uvws

---

## r/Python  (variant)

**Title**
I got tired of cd-ing into Python projects and made a desktop app to run them (uv-based)

**Body**
I run a bunch of Python projects locally — ComfyUI, a few of my own scripts, dev servers — and got tired of opening a terminal, cd-ing into each folder, activating the venv, and starting it every time. Port conflicts meant `lsof -i` then kill, over and over.

So I built **uvws**. Register a project folder once, and after that it's one click to run.

- Wraps everything in `uv run`, so you don't think about venvs. No `.venv`? It creates one on first run. (Installs uv itself if you don't have it.)
- Each project's stdout/stderr streams into an in-app terminal (xterm.js). A `localhost:PORT` in the logs → an "open in browser" button appears automatically.
- A **Kill Port** button that SIGKILLs whatever holds the port and verifies it's free.
- Run several projects at once, each with its own terminal/port. Closing the app cleans everything up.
- **Share + QR**: one click exposes a running server via a public link + QR (cloudflared) — handy for demoing to someone or testing on a phone.
- Import a folder with requirements.txt / pyproject.toml → pick a Python version (3.10–3.13) and install deps in one step.
- Live CPU/RAM per project, native ready/crash notifications, a small dependency "doctor" for outdated packages, and basic Git (branch, ahead/behind, fetch/pull/push).

Tauri 2 + React. macOS (Apple Silicon + Intel) and Windows. Not notarized yet, so macOS warns on first launch (one-liner in the README).

Site / downloads: https://uvws.site
GitHub: https://github.com/bunhine0452/uvws

Happy to hear what's missing or annoying.

---

## Show HN

**Title**
Show HN: uvws – one-click launcher for local Python/AI apps, powered by uv

**Body** (trim the r/Python body; HN likes it terse)
I run a few local Python/AI projects side by side (ComfyUI, dev servers, my own scripts) and got tired of the cd → venv → run → find-the-port loop, plus killing stuck ports. uvws registers a folder once and launches it in one click: it wraps runs in `uv run` (so no venv juggling, and it creates/installs as needed), streams logs into an in-app terminal, auto-detects the serving port, force-kills ports, runs several projects concurrently, and can expose a running server via a public link + QR. Tauri 2 + React, macOS + Windows, MIT.

https://uvws.site · https://github.com/bunhine0452/uvws

**First comment to post right after submitting (context helps on HN):**
I made this mostly for myself — running a few local AI/ML projects at once and the terminal juggling got old. The Kill Port piece started as a personal annoyance (port in use → find pid → kill → retry) and became the feature I use most. Letting `uv` do the venv resolution under the hood is what made "just click run" actually reliable, and recently I added a one-click public-link + QR so I can pull up a local UI on my phone without deploying. Curious how others manage a pile of local Python servers.
