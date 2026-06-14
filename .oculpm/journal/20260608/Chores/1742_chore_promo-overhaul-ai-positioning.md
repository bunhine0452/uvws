---
schema_version: 1
type: chore
slug: promo-overhaul-ai-positioning
status: done
difficulty: low
created_at: "2026-06-08T17:42:00+09:00"
updated_at: "2026-06-08T17:42:00+09:00"
session_id: "manual-20260608-174132"
agent:
  id: claude-code
  version: "4.8"
language: ko
verified_by_user: false
files_touched:
  - path: docs/promo/reddit-hackernews.md
    op: update
    bytes_added: 4200
    bytes_removed: 1100
  - path: docs/promo/producthunt.md
    op: update
    bytes_added: 900
    bytes_removed: 600
  - path: docs/promo/x-thread.md
    op: update
    bytes_added: 1500
    bytes_removed: 1000
  - path: docs/promo/긱뉴스.md
    op: update
    bytes_added: 900
    bytes_removed: 700
  - path: docs/promo/okky-커뮤니티.md
    op: update
    bytes_added: 700
    bytes_removed: 500
  - path: docs/promo/README.md
    op: update
    bytes_added: 900
    bytes_removed: 500
  - path: docs/promo/LAUNCH-CHECKLIST.md
    op: create
    bytes_added: 4300
    bytes_removed: 0
  - path: docs/promo/demo-gif-storyboard.md
    op: create
    bytes_added: 5200
    bytes_removed: 0
  - path: landing/index.html
    op: update
    bytes_added: 2100
    bytes_removed: 400
  - path: landing/sitemap.xml
    op: update
    bytes_added: 40
    bytes_removed: 40
related:
  - ../Features_to_add/1741_feature_uv-install-gate-onboarding.md
tags: ["promo", "marketing", "seo", "landing", "positioning", "ai-launcher"]
---

[x] 홍보 원고 AI-런처 포지셔닝 전면 개편 + 랜딩/SEO 정리 + 데모 GIF·론치 가이드 신설

## 변경 요약
포지셔닝을 "로컬 AI 앱 + 파이썬 런처"(ComfyUI·SD·FastAPI)로 통일하고, 모든 홍보 원고를 v0.4 킬러 기능(공유+QR)과 신규 uv 자동 설치로 갱신.

- 홍보 원고: reddit-hackernews에 **r/comfyui·r/StableDiffusion·r/LocalLLaMA 변형 신설**(가장 핏 좋은 미사용 채널), producthunt/긱뉴스/x-thread/okky 모두 AI 앵글·공유QR·uv 자동설치 반영. README 인덱스 갱신.
- 신규: `LAUNCH-CHECKLIST.md`(발사 전 준비→채널 순차 롤아웃→당일 운영→후속 성장 루프), `demo-gif-storyboard.md`(8~12초 콘티 + ffmpeg/gifski 녹화·인코딩 레시피 + 배치).
- 랜딩/SEO: JSON-LD `softwareVersion` 0.3.1→0.4.1, `featureList`에 v0.4 4기능 추가, 기능 그리드에 카드 3장(공유+QR·리소스모니터·의존성닥터) + ko/en i18n(f7~f9), hero_sub를 AI 앵글로(ko/en), sitemap lastmod 갱신.

## 검증
랜딩 JSON-LD `JSON.parse` OK, 신규 i18n 키 f7/f8/f9 각 ko+en 2회 존재 확인. `pnpm build` 통과(랜딩은 정적이라 앱 번들 무관). 실제 게시는 사용자 계정 필요 — 미실행(외부 발행). 랜딩 배포(`vercel --prod`)는 사용자 승인 후.

## 메모
홍보 원고는 **v0.5(uv 자동 설치) 출시 후**를 전제로 작성 — 체크리스트 STEP 0에 "발사 전 v0.5 릴리스 + 데모 GIF + 랜딩 배포 + (선택)공증" 명시. 같은 날 feature 일지의 활성화 기능이 STEP 0의 핵심.
