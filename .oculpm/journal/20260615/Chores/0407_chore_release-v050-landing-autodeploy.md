---
schema_version: 1
type: chore
slug: release-v050-landing-autodeploy
status: done
difficulty: low
created_at: "2026-06-15T04:07:53+09:00"
session_id: "manual-20260615-034954"
agent:
  id: claude-code
  version: "4.8"
language: ko
verified_by_user: false
files_touched:
  - path: package.json
    op: update
    bytes_added: 1
    bytes_removed: 1
  - path: src-tauri/Cargo.toml
    op: update
    bytes_added: 1
    bytes_removed: 1
  - path: src-tauri/tauri.conf.json
    op: update
    bytes_added: 1
    bytes_removed: 1
  - path: src-tauri/Cargo.lock
    op: update
    bytes_added: 1
    bytes_removed: 1
  - path: CHANGELOG.md
    op: update
    bytes_added: 720
    bytes_removed: 0
  - path: landing/index.html
    op: update
    bytes_added: 2200
    bytes_removed: 1100
  - path: CLAUDE.md
    op: update
    bytes_added: 820
    bytes_removed: 280
related:
  - ../Features_to_add/0349_feature_open-project-folder.md
  - ../Features_to_add/0350_feature_linux-build-support.md
tags: ["release", "v0.5.0", "vercel", "landing", "deploy", "docs"]
---

[x] v0.5.0 릴리즈 컷 + 랜딩 v0.5.0/Linux 반영 + 랜딩 자동배포 메커니즘 정정

## 검증
- 버전 범프 3파일 + `cargo check`로 `Cargo.lock` → 0.5.0 동기화 확인. `pnpm build` 통과.
- 릴리즈 커밋 `95c06aa` → `main` 푸시, annotated 태그 `v0.5.0` 푸시 → Release CI
  `27508835255` 트리거(macOS aarch64/x64 + Windows + 신규 Linux ubuntu-22.04). CI 완료 후
  `gh release view v0.5.0 --json assets`로 latest.json + Linux(AppImage/deb/rpm) 산출 검증 예정.
- 랜딩: `curl https://uvws.site`로 `softwareVersion 0.5.0`, `macOS · Windows · Linux`,
  `dl-linux` 카드 라이브 확인.

## 메모
**랜딩 배포 메커니즘 정정(중요):** 랜딩은 `main` 푸시 시 **Vercel Git 연동으로 자동 배포**된다.
레포 루트 `vercel.json`(`outputDirectory:"landing"`, build skip)이 `landing/`를 정적 서빙.
즉 `git push` 한 번으로 라이브됨. 수동 `cd landing && vercel --prod`는 **실패**한다
(`.vercel` 링크가 `landing/`에 있는데 프로젝트 Output Directory가 `landing` → landing/에서
배포 시 "No Output Directory named landing"). 실제로 이번에 수동 배포가 Error 났고, 같은 시점
git 푸시발 자동 배포가 Ready로 라이브됨. 예전 메모/CLAUDE.md의 `cd landing && vercel` 지침은
폐기하고 CLAUDE.md·[[landing-seo]] 메모를 자동배포 기준으로 갱신함.

남은 수동 작업 없음(랜딩 라이브). 앱 Linux 산출물은 CI 완료가 첫 실검증 지점.
