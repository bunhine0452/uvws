# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**uvws** is a Tauri 2 desktop app (macOS, Windows, Linux) that registers, runs, and manages local Python projects through Astral's `uv`. One click does `cd` + venv activation + dependency install + launch, streams logs into an xterm.js terminal, auto-detects the server port, and offers Git, dependency, port-kill, and public-tunnel tooling.

Naming gotchas:
- The local directory is `PySpace`; the product and GitHub repo are **uvws** (`bunhine0452/uvws`).
- The Rust crate is still named `tauri-app` / `tauri_app_lib` (leftover from the Tauri template). The user-facing product name `uvws` lives in `tauri.conf.json` (`productName`, identifier `com.pyspace.uvws`).

## Commands

```bash
pnpm install          # install frontend deps (pnpm is canonical — CI + README use it)
pnpm tauri dev        # run the desktop app in dev (Vite on :1422 + Rust, hot reload)
pnpm tauri build      # full release build → src-tauri/target/release/bundle/
pnpm build            # frontend only: tsc typecheck + vite build (use to check TS compiles)
```

Inside `src-tauri/`: `cargo check` / `cargo build` for the Rust side. Run `cargo check` after any version bump to resync `Cargo.lock`.

There is **no test suite, linter, or formatter** configured. "Verifying" a change means it typechecks (`pnpm build`) and runs (`pnpm tauri dev`). Note `tauri.conf.json`'s `beforeDevCommand`/`beforeBuildCommand` call `npm run …`, but the scripts are identical regardless of package manager.

Requirements to build/run: Node 18+, pnpm, Rust stable, `uv` on PATH, and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

## Architecture

Two halves talking over Tauri IPC:

- **Frontend** — React 19 + TypeScript + Vite. Almost the entire UI lives in `src/App.tsx` (~1.5k lines): all state, the project list, tabs (config/env/deps/git), modals, and event wiring. Supporting files: `src/components/TerminalView.tsx` (xterm.js + fit/search/web-links/webgl addons), `src/i18n.tsx` (a `useI18n()` context with `t`/`lang`/`setLang`; Korean + English, default English). The frontend calls backend commands with `invoke()` and subscribes to backend events with `listen()`.
- **Backend** — Rust, in `src-tauri/src/`. `main.rs` prepends common install dirs (`/opt/homebrew/bin`, `~/.cargo/bin`, …) to PATH — GUI apps don't inherit the shell PATH — then calls `lib.rs::run()`, which registers every `#[tauri::command]`, the plugins, app state, the metrics sampler, and the exit-cleanup handler.

Backend modules:
| File | Responsibility |
|---|---|
| `lib.rs` | App entry, command registry, `AppState`, 1 Hz CPU/RAM `metrics_sampler`, project CRUD, dependency/venv commands, exit cleanup |
| `config.rs` | `Project`/`AppConfig` structs; persists `config.json` in the OS app-config dir |
| `runner.rs` | Spawns `uv run`, streams logs, detects ports, `ProcessRegistry`, kill-port, orphan cleanup |
| `uv.rs` | `uv venv` + dependency install (`requirements.txt` → `uv pip install -r`, `pyproject.toml`+lock → `uv sync`, else `uv pip install .`) |
| `git.rs` | `git status`/`log`/`fetch`/`pull`/`push` via the system `git` binary |
| `tunnel.rs` | `cloudflared` quick tunnels for the "Share" feature (parses the `*.trycloudflare.com` URL) |

### Invariants worth knowing before editing

**ProcessRegistry is the source of truth for live status, not the config file.** `config.json` always stores `status: "Stopped"` and no port. Live `Running`/port state is merged in by `apply_live_status()` (lib.rs) from the in-memory `ProcessRegistry`. **Every** project CRUD command (`get`/`add`/`update`/`delete`) must return the full merged list, so the frontend can `setProjects()` without clobbering a running project's status. `update_project` deliberately never writes `status`.

**Everything launches through `uv run`.** `start_project` strips a leading `uv`/`run` from the user's command and re-wraps as `uv run <cmd>`. If `.venv` is missing it's created and dependencies installed on first run only (so warm starts are instant). Spawns set `PYTHONUNBUFFERED`/`FORCE_COLOR`/etc. so a piped (non-TTY) child still streams line-by-line and in color.

**Process-group kill strategy.** Children spawn in their own process group (`process_group(0)` on Unix, `CREATE_NEW_PROCESS_GROUP` on Windows) so the whole `uv → python` tree dies together. Stop/exit kill the group (`kill -9 -<pgid>` / `taskkill /F /T`). Running PIDs are persisted to `uvws_running_pids.json`; `cleanup_orphans()` sweeps survivors on next launch, `kill_all_processes()`/`kill_all_tunnels()` run on app exit.

**Log streaming is batched, byte-oriented, and capped.** Readers consume raw byte chunks (not lines, to preserve `\r` progress bars), merge stdout+stderr into one channel, and a flusher emits a single `log-stream-<id>` event every 40 ms / 64 KB. Stored history is capped at 400 KB (front-trimmed on char boundaries). When touching log code, keep the batching — per-line emits cause the "slower than a real terminal" regression this was built to fix.

**GUI apps lack the shell PATH**, so external binaries are resolved by absolute path first: `lsof` (runner.rs), `cloudflared` (tunnel.rs), plus the PATH augmentation in `main.rs`.

### IPC event names (backend → frontend)

`process-status`, `process-port`, `process-exit` (carries exit code + `by_user` for crash-vs-stop detection), `process-metrics` (array, whole-snapshot each tick), `log-stream-<id>`, and tunnel events `tunnel-url` / `tunnel-error` / `tunnel-stopped`. Frontend listeners are all registered in one `useEffect` in `App.tsx`; they use refs (`projectsRef`, `tRef`, `notifyEnabledRef`) to avoid stale closures.

## Releasing

Tags matching `v*` trigger `.github/workflows/release.yml` (macOS aarch64 + x64 + Windows + Linux `ubuntu-22.04` (AppImage/deb/rpm) via `tauri-action`, signed with the `TAURI_PRIVATE_KEY` repo secret; release notes pulled from the matching `## vX.Y.Z` section of `CHANGELOG.md`). The Linux job installs `libwebkit2gtk-4.1-dev` & friends via apt before building; only the AppImage is auto-updatable. To cut a release:

1. Bump the version in **three** files together — `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` — then `cargo check` in `src-tauri/` to sync `Cargo.lock`. (The `useState("x.y.z")` fallback in `App.tsx` is cosmetic; `getVersion()` overrides it.)
2. Update `CHANGELOG.md`, commit on `main`, push annotated tag `vX.Y.Z`.
3. **Always verify the release published a `latest.json` asset** (`gh release view vX.Y.Z --json assets`) — the in-app auto-updater fetches `releases/latest/download/latest.json`. This requires `bundle.createUpdaterArtifacts: true` in `tauri.conf.json` (do not remove it). A local `pnpm tauri build` does **not** produce `latest.json`; only CI does.

The app is unsigned / un-notarized, so release notes always include the macOS `xattr -cr` / right-click→Open workaround.

## Landing site

The marketing site (uvws.site) is the **`landing/`** directory. It **auto-deploys via Vercel's Git integration on every push to `main`** — the repo-root `vercel.json` (`framework: null`, build skipped, `outputDirectory: "landing"`) tells Vercel to serve `landing/` as static output. So just committing + pushing landing changes ships them; no manual step. **Do not run `cd landing && vercel --prod`** — the `.vercel` link lives in `landing/` but the project's Output Directory is `landing`, so a manual deploy from `landing/` fails ("No Output Directory named landing"). If you must deploy by hand, do it from the **repo root**. The repo-root `index.html` is the Tauri webview entry, **not** the landing page. Download buttons resolve the latest GitHub release at runtime via the GitHub API, so they auto-track new releases without edits.

## Working conventions in this repo

- Code comments throughout the Rust backend and parts of `App.tsx` are written in **Korean**; match the surrounding language when editing those regions.
- This repo is tracked by **ocul-pm**: `AGENTS.md` defines a journaling protocol (write a `.oculpm/journal/...` markdown entry after each completed unit of work, and update `.oculpm/planner/*.md`). Never write to `.oculpm/index/**`. There is an auto-commit hook and work flows directly to `main`.

### @AGENTS.md 꼭 읽고 이행할것.