# Changelog

All notable changes per release. The CI injects the section matching the
release tag (e.g. `## v0.4.0`) into the GitHub release notes and the
in-app updater notes, so keep headings as `## vX.Y.Z`.

## v0.5.0
- **Linux support** — uvws now builds and runs on Linux. Releases ship
  `.AppImage` (auto-updatable), `.deb`, and `.rpm`. (See the first-launch note
  below for the AppImage.)
- **Open project folder** — a new **Open Folder** button in the project header
  opens the project's working directory in your OS file manager
  (Finder / Explorer / your Linux file manager).
- **uv install gate & onboarding** — uvws now detects whether Astral's `uv` is
  installed and offers a one-click install, plus a friendlier empty state so the
  very first run isn't blocked by a missing dependency.

## v0.4.1
- **Fixed the app icon** — it had a white background plate behind it; the
  icon is now properly transparent everywhere (app icon and favicons).
- **Update notifications now render the release notes** instead of showing
  raw markdown, so you can clearly see what changed.

## v0.4.0
- **Share via public link + QR** — expose a running local server through a
  cloudflared quick tunnel in one click. Non-blocking panel with link, QR,
  copy/open, and a dedicated Stop button.
- **Resource monitor** — live per-project CPU and memory usage with an
  inline sparkline.
- **Native notifications** — get notified when a server is ready or crashes.
- **Dependency doctor** — check for outdated packages and upgrade them
  (per package or all at once) right from the Dependencies tab.
- **New app icon.**
- Update notifications now render the release notes nicely (no more raw
  markdown), so you can see what changed.

## v0.3.1
- Collapsible sidebar, translucent "liquid glass" UI, glass landing page
  with KO/EN toggle, and assorted layout fixes.

## v0.3.0
- Liquid-glass terminal and landing page.
