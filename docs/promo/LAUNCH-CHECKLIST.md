# 론치 체크리스트 — 순서대로

> 포지셔닝: **"로컬 AI 앱 + 파이썬 런처"** (ComfyUI·Stable Diffusion·FastAPI…).
> 핵심 원칙: **한 번에 도배하지 말 것.** 채널 하나씩, 며칠 간격. 올린 직후 1~2시간 댓글 대응이 곧 다운로드.

---

## STEP 0 — 발사 전 준비 (이게 안 되면 홍보 효과 반감)

가장 큰 이탈 지점 두 개를 먼저 제거하고 발사합니다.

- [ ] **v0.5 릴리스: uv 자동 설치 + 온보딩.** (이미 코드 작업됨 — `check_uv`/`install_uv`, uv 게이트, 빈 상태 CTA)
      → "uv를 미리 깔아야 함"이라는 #1 거절 사유가 사라짐. 홍보 문구가 "없으면 앱이 설치해줌"이라 말할 수 있게 됨.
      → 릴리스 절차는 루트 `CLAUDE.md`의 "Releasing" 따르고, **`latest.json` 자산 게시 꼭 확인**(자동 업데이터).
- [ ] **데모 GIF 제작** (`demo-gif-storyboard.md`). 모든 채널 1번에 들어갈 자산. 이게 없으면 발사 미루는 게 나음.
- [ ] **랜딩 반영 확인**: AI 앵글 hero/기능카드(공유+QR·리소스모니터·의존성닥터) 이미 반영됨 → `cd landing && vercel --prod --yes`로 배포.
- [ ] (선택, 신뢰도 큰 항목) **macOS 공증**. Apple Developer $99/yr. "앱이 손상됨" 경고가 사라져 전환·신뢰 모두 상승. 여력 되면 발사 전에.
- [ ] GitHub 저장소 정리: README 상단 GIF, 토픽 태그(`comfyui`, `stable-diffusion`, `python`, `uv`, `tauri`, `developer-tools`) 추가, About에 uvws.site.

---

## STEP 1 — 채널 롤아웃 (약 2주, 하나씩)

원고는 전부 이 폴더에 있음. 반응 보고 다음 글 다듬으며 진행.

| 순서 | 날 | 채널 | 원고 | 메모 |
|---|---|---|---|---|
| 1 | D-day | **긱뉴스** (news.hada.io) | `긱뉴스.md` | 한국 노출 1순위. 가볍게 시작 + 댓글 대응 연습 |
| 2 | +2일 | **r/comfyui** 또는 **r/StableDiffusion** | `reddit-hackernews.md` (AI 변형) | **핏이 가장 좋은 채널.** 규칙 확인(자기홍보 요일·플레어), GIF 필수 |
| 3 | +4일 | **r/LocalLLaMA** | `reddit-hackernews.md` (LocalLLaMA 변형) | VRAM 아님을 솔직히. 톤 겸손하게 |
| 4 | +6일 | **r/Python** | `reddit-hackernews.md` (r/Python 변형) | "Showcase"/주말 규칙 확인 |
| 5 | +8일 | **Show HN** | `reddit-hackernews.md` (HN) | 발사 직후 메이커 첫 댓글(원고에 있음). 오전(미 동부) 추천 |
| 6 | +10일 | **Product Hunt** | `producthunt.md` | 화~목 00:01 PST. 갤러리 1번 GIF, 첫 댓글 즉시 |
| 7 | 상시 | **X 스레드** | `x-thread.md` | 각 채널 올릴 때마다 곁들여 트윗. #ComfyUI #Python #buildinpublic |
| 8 | 상시 | **OKKY/디스코드/카톡방** | `okky-커뮤니티.md` | AI 한국 커뮤니티(ComfyUI 디코)에도 |

> 서브레딧은 **자기홍보 규칙이 제각각**입니다(계정 나이·카르마·전용 요일·플레어 필수 등).
> 올리기 전 각 sub의 rules + 최근 "Show"/"I made" 글들을 보고 톤·형식을 맞추세요. 밴 한 번이면 채널 하나를 잃습니다.

---

## STEP 2 — 발사 당일 운영

- [ ] 올린 직후 **1~2시간 대기 타며 모든 댓글에 빠르게** 답하기 (트래픽 피크 = 댓글 타이밍)
- [ ] "왜 만들었나"를 메이커가 직접 (HN/PH는 특히 첫 댓글이 반응을 좌우)
- [ ] 부족한 점 **솔직하게**: 사이드 프로젝트·미공증·CPU/RAM(아닌 VRAM) 등 숨기지 않기 → 개발자 커뮤니티는 오히려 신뢰
- [ ] 들어온 버그/요청은 즉석에서 GitHub Issue로 전환 ("좋은 지적, 이슈로 받아둘게요")
- [ ] 반응 좋은 코멘트/스샷은 X로 리트윗·인용해 2차 확산

---

## STEP 3 — 발사 후 (지속 성장 루프)

- [ ] 가장 많이 나온 요청 1~2개를 빠르게 반영해 **v0.5.x 패치 → "런칭 피드백 반영" 후속 글**
      (재방문 동력. "당신들이 말한 거 고쳤어요"는 두 번째 트래픽 파도를 만듦)
- [ ] 다음 성장 레버(우선순위): **① Linux 빌드**(AI 청중 Linux 비중↑, TAM 확대) → **② macOS 공증** → ③ 첫 실행 샘플 프로젝트 번들
- [ ] 로드맵의 플러그인/Docker는 **후순위** — 아직 없는 파워유저용이라 신규 유입엔 기여 적음
- [ ] GitHub Star/다운로드 추이를 보고 어떤 채널이 실제로 전환됐는지 기록 → 다음 기능 릴리스 때 그 채널 위주로

---

## 자산 위치 한눈에
- 원고: `docs/promo/*.md` (이 폴더)
- 데모 GIF 가이드: `docs/promo/demo-gif-storyboard.md`
- 스크린샷: `docs/alpha/preview.png`, `landing/preview.png`
- 랜딩: `landing/` → `cd landing && vercel --prod --yes`
