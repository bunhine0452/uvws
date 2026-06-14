# 데모 GIF — 콘티 + 녹화/인코딩 레시피

> 개발자 툴 홍보에서 **단일 최대 전환 자산**. 글보다 GIF 하나가 다운로드를 가릅니다.
> 목표: 8~12초 무한 루프 한 편. 랜딩 히어로 · README 상단 · Reddit/PH/X 1번에 전부 재사용.
> 한 편이면 충분하니 완성도에 시간을 쓰세요. (소리 없음 전제 — 자막/UI로만 전달)

---

## 핵심 메시지 (이 한 줄을 보여주면 끝)
"폴더 클릭 → 알아서 실행되고, 브라우저가 열린다. 그리고 폰으로도 본다."

지루한 빈 화면·설정 단계는 다 자르고, **클릭부터 결과까지**만 보여줍니다.

---

## 콘티 (장면별, ~10초)

| # | 시간 | 화면 | 포인트 |
|---|---|---|---|
| 1 | 0.0–1.5s | 프로젝트 목록이 보이는 uvws. 커서가 한 프로젝트(예: ComfyUI/Flask)로 이동 | "여러 프로젝트가 한 앱에" |
| 2 | 1.5–2.0s | **Run 클릭** (클릭 강조 — 커서 살짝 확대/링) | 행동은 클릭 하나뿐 |
| 3 | 2.0–5.0s | 내장 터미널에 로그가 실시간으로 좌르륵 스트림 | "venv·설치 자동, 그냥 돌아감" |
| 4 | 5.0–6.5s | 로그에 `localhost:8188` 감지 → **Open in browser 버튼이 등장**(살짝 펄스) | 포트 자동 감지 |
| 5 | 6.5–8.0s | 버튼 클릭 → 브라우저에 앱이 뜸 (또는 화면 분할로 동시에) | "결과까지 한 번에" |
| 6 | 8.0–10s | **Share 클릭 → QR 표시**, 폰으로 스캔하는 짧은 컷(있으면 베스트) | 바이럴 훅: 폰으로 바로 |

> 6번(공유+QR)이 사람들이 가장 많이 캡처/리트윗하는 장면입니다. 폰 스캔 실물 컷이 있으면
> 전환율이 확 올라가니, 가능하면 1번 카메라로 폰 화면까지 한 컷 찍어 붙이세요.
> 길이가 부담되면 1~5번(8초)만으로도 충분하고, 공유+QR은 별도 짧은 GIF로 분리해도 됩니다.

---

## 녹화 (macOS)

1. **앱을 데모용으로 세팅**: 프로젝트 2~3개 등록, 그중 빠르게 뜨는 것(가벼운 Flask/Gradio "hello" 앱 추천 — ComfyUI는 로딩이 길어 GIF엔 비추) 하나를 주인공으로. 첫 실행 venv 생성 장면을 넣고 싶지 않으면 **미리 한 번 돌려 .venv를 만들어 둬** 즉시 뜨게 합니다.
2. **창 크기 고정**: 가로 1280 안팎으로. 너무 크면 GIF 용량이 폭발합니다.
3. **녹화**: `Cmd+Shift+5` → "선택 영역 기록" → uvws 창만. 깔끔한 커서를 위해 옵션에서 "마우스 클릭 표시" 켜기.
   - 더 매끈한 결과를 원하면 **Kap**(무료, getkap.co)나 **CleanShot X**로 녹화하면 커서 강조/크롭이 쉽습니다.
4. 30fps, 10초 내외로 끊어서 `raw.mov`로 저장.

> 데모용 가벼운 Flask 앱(즉시 뜨고 포트 로그를 내뱉음):
> ```python
> # demo_app.py  →  uvws에 "uv run python demo_app.py"로 등록
> from flask import Flask
> app = Flask(__name__)
> @app.get("/")
> def home(): return "<h1>Hello from uvws 🚀</h1>"
> app.run(port=8188)
> ```

---

## 인코딩 (raw.mov → 고화질 GIF + 경량 웹 버전)

`ffmpeg`와 `gifski`가 가장 깔끔합니다. (`brew install ffmpeg gifski`)

**A. 고화질 GIF (README/소셜용, gifski — 색감 최고):**
```bash
# 1) mov → png 프레임 (30fps, 가로 1000으로 축소)
mkdir -p frames
ffmpeg -i raw.mov -vf "fps=24,scale=1000:-1:flags=lanczos" frames/f%04d.png
# 2) gifski로 묶기 (품질↑, 용량은 800px 권장)
gifski -o uvws-demo.gif --fps 24 --quality 90 --width 1000 frames/f*.png
rm -rf frames
```

**B. ffmpeg만으로 (gifski 없이, 팔레트 방식):**
```bash
ffmpeg -i raw.mov -vf "fps=24,scale=1000:-1:flags=lanczos,palettegen=stats_mode=diff" palette.png
ffmpeg -i raw.mov -i palette.png -lavfi "fps=24,scale=1000:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3" uvws-demo.gif
```

**C. 웹은 GIF보다 MP4/WebM이 훨씬 가볍습니다** (랜딩 히어로엔 자동재생 video 권장):
```bash
# 무음 자동재생 루프용 mp4 (보통 GIF의 1/10 용량)
ffmpeg -i raw.mov -vf "scale=1200:-2:flags=lanczos" -c:v libx264 -pix_fmt yuv420p -movflags +faststart -an uvws-demo.mp4
# webm도 같이
ffmpeg -i raw.mov -vf "scale=1200:-2:flags=lanczos" -c:v libvpx-vp9 -b:v 0 -crf 32 -an uvws-demo.webm
```

용량 목표: GIF는 < 6MB(소셜 업로드 한계 고려), MP4는 < 2MB.
용량이 크면 `scale`을 800으로, `--fps`를 20으로, 길이를 8초로 줄이세요.

---

## 배치

- **랜딩 히어로**: 현재 정적 `preview.png` 자리에 자동재생 무음 루프 video로 교체
  (`<video autoplay loop muted playsinline poster="preview.png">` — poster로 preview.png 유지해 첫 페인트 안정화).
- **README 상단**: `docs/` 에 `uvws-demo.gif`를 넣고 첫 스크린샷 위/대신에 삽입.
- **소셜**: Reddit/PH/X 모두 1번 자리에 GIF(또는 mp4). 정적 이미지보다 우선.

---

## 체크 (올리기 전)
- [ ] 8~12초, 무한 루프가 자연스럽게 이어지는가 (끝 프레임 ≈ 첫 프레임)
- [ ] 클릭 → 터미널 → 브라우저 흐름이 자막 없이도 읽히는가
- [ ] 텍스트(로그)가 흐릿하지 않은가 (가로 ≥ 1000)
- [ ] 개인정보 노출 없는가 (경로·토큰·창 제목)
- [ ] 용량 적정 (GIF < 6MB)
