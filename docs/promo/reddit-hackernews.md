# English — Reddit (r/Python) + Show HN

---

## Show HN title

Show HN: uvws – a desktop app to run your uv-based Python projects in one click

## r/Python title

I got tired of cd-ing into Python projects and made a desktop app to run them (uv-based)

---

## Body (works for both, trim for HN)

I run a bunch of Python projects locally — ComfyUI, a few of my own scripts, the usual — and I got tired of opening a terminal, cd-ing into each folder, activating the venv, and starting it every single time. Port conflicts meant `lsof -i` then kill, over and over.

So I built uvws. You register a project folder once, and after that it's one click to run.

A few things that ended up being genuinely useful day to day:

- It wraps everything in `uv run`, so you don't have to think about venvs. If there's no `.venv`, it creates one on first run.
- Each project's stdout/stderr streams into an in-app terminal (xterm.js). When a `localhost:PORT` shows up in the logs, an "open in browser" button appears automatically.
- A Kill Port button that actually SIGKILLs whatever is holding the port and verifies it's free — no more lsof.
- You can run several projects at once, each with its own terminal/port. Closing the app cleans up everything that was running.
- Importing a folder with requirements.txt / pyproject.toml lets you pick a Python version (3.10–3.13) and installs deps in one step.
- Basic Git integration — branch, ahead/behind, changed files, and fetch/pull/push buttons.

It's built with Tauri 2 + React. macOS (Apple Silicon + Intel) and Windows builds are up. You do need `uv` installed already.

Fair warning: it's a side project and not notarized yet, so macOS will warn you on first launch — there's a one-liner workaround in the README.

Site / downloads: https://uvws.vercel.app
GitHub: https://github.com/bunhine0452/uvws

Happy to hear what's missing or annoying.

---

### HN comment to post right after submitting (context helps on HN)

I made this mostly for myself — I was running a few local AI/ML projects side by side and the terminal juggling got old. The Kill Port thing started as a personal annoyance (port already in use, find the pid, kill it, try again) and turned into the feature I use most. uv doing the venv resolution under the hood is what made the "just click run" part actually reliable. Curious whether people manage local Python projects differently.
