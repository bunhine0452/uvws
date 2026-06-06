<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="100" alt="uvws icon" />
</p>

<h1 align="center">uvws</h1>
<p align="center">
  A desktop app to manage all your Python projects in one place — powered by <code>uv</code>
</p>

<p align="center">
  <a href="https://uvws.site"><b>uvws.site</b></a>
</p>

<p align="center">
  <b>English</b> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="https://github.com/bunhine0452/uvws/releases"><img src="https://img.shields.io/github/v/release/bunhine0452/uvws?style=flat-square&color=6366f1" alt="Release" /></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-333?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/powered%20by-Tauri%202-24C8D8?style=flat-square&logo=tauri&logoColor=white" alt="Tauri 2" />
  <img src="https://img.shields.io/badge/package%20manager-uv-DE5FE9?style=flat-square" alt="uv" />
  <img src="https://img.shields.io/github/license/bunhine0452/uvws?style=flat-square&color=868e96" alt="License" />
</p>

---

When you have several Python projects, typing `cd`, then `source .venv/bin/activate`, then `python main.py` every single time starts to wear thin. uvws shrinks that whole dance down to a single click.

<p align="center">
  <img src="docs/alpha/preview.png" width="720" alt="uvws screenshot" />
</p>

---

## Download

Grab it from [**uvws.site**](https://uvws.site) or the [**Releases page**](https://github.com/bunhine0452/uvws/releases).

| Platform | File |
|---|---|
| macOS Apple Silicon (M1–M4) | `uvws_x.x.x_aarch64.dmg` |
| macOS Intel | `uvws_x.x.x_x64.dmg` |
| Windows 10+ | `uvws_x.x.x_x64-setup.exe` |

**Prerequisite:** [uv](https://docs.astral.sh/uv/getting-started/installation/) must be installed.

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

### Security warning on first launch (macOS)

Because the app isn't Apple-notarized, macOS may show a warning.

- **"App is damaged" error**: run `xattr -cr /Applications/uvws.app` in the terminal, then try again
- **Generic warning**: right-click the app → Open → confirm Open

You only need to do this once; it launches normally afterward.

---

## Features

**Register & run projects**
Register a folder once and launch it with a single click from then on. Runs are wrapped in `uv run`, so they work without activating a virtualenv — and if there's no `.venv`, one is created automatically on first run.

**Import wizard**
When importing a folder that has a `requirements.txt` or `pyproject.toml`, pick a Python version (3.10–3.13) and install dependencies in one step.

**Built-in terminal**
Each project's stdout/stderr streams live into an xterm.js terminal. When a `localhost:XXXX` address is detected in the logs, an "Open in browser" button appears automatically.

**Port management (force-kill)**
Force-kills (SIGKILL) whatever process is holding a given port, retrying and verifying until the port is actually free — so you never have to type `lsof -i` for a "port already in use" error again.

**Concurrent runs & auto-cleanup**
Spin up multiple localhost servers at once, each managed with its own terminal and port. Quitting the app shuts down every running server, and any orphans left by a crash are swept on the next launch.

**Git integration**
If a project folder is a Git repository, see its branch, ahead/behind counts, changed-file count, and latest commit at a glance — and run Fetch / Pull / Push with a single button.

**Dependency viewer**
Inspect the packages and versions installed in `.venv`, and use the Sync button to reinstall against `requirements.txt` / `pyproject.toml`.

**Korean / English**
Switch the language instantly from the About screen.

---

## Build from source

```bash
git clone https://github.com/bunhine0452/uvws.git
cd uvws
pnpm install
pnpm tauri dev       # development mode
pnpm tauri build     # release build
```

Build artifacts are produced in `src-tauri/target/release/bundle/`.

**Requirements:** Node.js 18+, pnpm, Rust stable, uv, [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

---

## Roadmap

- [x] Register / configure / delete projects
- [x] One-click run via `uv run`
- [x] Live xterm.js terminal
- [x] Port auto-detection & open-in-browser
- [x] Kill Port
- [x] Import wizard (with Python version selection)
- [x] Dependency viewer & Sync
- [x] Concurrent runs & auto server cleanup on app quit
- [x] Git integration (status, fetch, pull, push)
- [x] Localization (Korean / English)
- [ ] Plugin system
- [ ] Docker container management

---

## Contributing

PRs and issues are both welcome. For bug reports or feature ideas, open an [Issue](https://github.com/bunhine0452/uvws/issues).

---

## License

[MIT License](LICENSE)
