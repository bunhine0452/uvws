---
schema_version: 1
type: bug
slug: open-folder-not-allowed-path
status: done
difficulty: medium
created_at: "2026-06-15T04:25:41+09:00"
session_id: "manual-20260615-034954"
agent:
  id: claude-code
  version: "4.8"
language: ko
verified_by_user: false
files_touched:
  - path: src-tauri/capabilities/default.json
    op: update
    bytes_added: 120
    bytes_removed: 30
related:
  - ../Features_to_add/0349_feature_open-project-folder.md
tags: ["opener", "permissions", "scope", "tauri", "bugfix"]
---

[x] "폴더 열기"가 "Not allowed to open path"로 실패하던 문제 수정

## 발생 원인
v0.5.0에서 추가한 폴더 열기가 `Failed to open folder: Not allowed to open path
/Users/.../ComfyUI`로 실패. 원인은 opener 플러그인의 **경로 스코프가 비어 있어서**다.
`opener:allow-open-path` 권한은 `open_path` *커맨드*만 활성화할 뿐 scope entry를 추가하지
않는다("Enables the open_path command without any pre-configured scope"). 플러그인
`commands.rs::open_path`는 `scope.is_path_allowed(path, None)`를 호출하는데, 이는
`fs_scope.is_allowed(path) && allowed.any(|e| e.matches_path_program(None))`를 요구한다.
allowed가 비어 있으니 항상 false → `Error::ForbiddenPath`. (참고: `reveal_item_in_dir`는
스코프 검사를 안 해서 `opener:default`만으로 동작 — 그래서 헷갈리기 쉬움.)

## 해결 방법
capability에서 `opener:allow-open-path`를 문자열이 아니라 **scope 객체**로 바꿔
경로 allow를 부여:
```json
{ "identifier": "opener:allow-open-path", "allow": [{ "path": "**" }, { "path": "$HOME/**" }] }
```
entry의 `app`은 기본값 `Default` → `with=None`과 매칭(`matches_path_program(None)` true).
`path` glob은 `app_handle.path().parse()`를 거쳐 fs Scope로 매칭된다.

## 검증
- `cargo check` 통과(capability는 tauri-build가 검증).
- tauri fs Scope의 매치 옵션이 `require_literal_separator: true`임을 소스에서 확인한 뒤,
  동일 `glob` 0.3 크레이트로 실제 매칭을 테스트: `**` 와 `/Users/kimhyunbin/**`
  둘 다 `/Users/kimhyunbin/Desktop/image_maker/ComfyUI`에 대해 **true** 반환(무관 경로는 false).
- 컴파일된 capability라 사용자 앱 반영엔 재빌드 필요 → v0.5.1로 릴리즈(같은 라운드 chore 참조).
  실제 GUI 클릭 검증은 사용자가 v0.5.1 설치/업데이트 후 확인 권장.
