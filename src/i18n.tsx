import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Lang = "ko" | "en";

const STORAGE_KEY = "uvws.lang";

const translations: Record<Lang, Record<string, string>> = {
  ko: {
    // Sidebar
    workspace_subtitle: "Python Workspace",
    projects: "프로젝트",
    add_project: "+ 프로젝트 추가",
    remove_project: "프로젝트 제거",
    // Status
    status_running: "실행 중",
    status_stopped: "중지됨",
    status_installing: "설치 중",
    // Header actions
    open_in_browser: "브라우저에서 열기",
    no_port: "포트 없음",
    kill_port: "포트 종료",
    kill_port_title: "{port} 포트 종료",
    copy_log: "로그 복사",
    run: "실행",
    stop: "중지",
    // Stats
    uptime: "가동 시간",
    env: "환경",
    python: "Python",
    cpu: "CPU",
    memory: "메모리",
    // Tabs
    tab_config: "구성",
    tab_env: "환경변수",
    tab_deps: "의존성",
    tab_git: "Git",
    // Config
    command_and_path: "명령어 & 경로",
    command_and_path_desc: "실행 명령어 및 인터프리터 설정",
    uv_managed: "uv 관리",
    entry_command: "실행 명령어",
    working_directory: "작업 디렉터리",
    python_interpreter: "Python 인터프리터",
    browse: "찾아보기…",
    // Env tab
    env_vars: "환경변수",
    env_vars_desc: "프로세스 실행 시 적용되는 환경변수",
    add_variable: "+ 변수 추가",
    // Deps tab
    installed_packages: "설치된 패키지",
    packages_count: ".venv에 {n}개 패키지",
    venv_not_found: ".venv 없음",
    refresh: "새로고침",
    loading: "불러오는 중…",
    sync_now: "지금 동기화",
    syncing: "동기화 중…",
    deps_loading: "패키지 목록을 불러오는 중...",
    deps_empty: "설치된 패키지가 없습니다.",
    deps_no_venv: "가상환경(.venv)이 아직 없습니다. 지금 동기화를 클릭하거나 실행으로 자동 생성하세요.",
    pkg_package: "패키지",
    pkg_version: "버전",
    // Git tab
    git_branch: "브랜치",
    git_fetch: "가져오기",
    git_pull: "풀",
    git_push: "푸시",
    git_ahead: "{n} 앞섬",
    git_behind: "{n} 뒤처짐",
    git_staged: "스테이지됨",
    git_modified: "변경됨",
    git_untracked: "추적 안 됨",
    git_clean: "변경 사항 없음 (클린)",
    git_recent_commits: "최근 커밋",
    git_not_repo: "이 폴더는 Git 저장소가 아닙니다.",
    git_no_remote: "원격 저장소가 설정되어 있지 않습니다.",
    git_no_upstream: "업스트림 브랜치가 없어 ahead/behind를 표시할 수 없습니다.",
    git_no_commits: "커밋이 없습니다.",
    git_loading: "Git 상태를 불러오는 중...",
    // Empty state
    no_projects: "아직 프로젝트가 없습니다",
    no_projects_hint: "'+ 프로젝트 추가'를 눌러 첫 Python 프로젝트를 등록하세요.",
    // Add modal
    add_new_project: "새 프로젝트 추가",
    project_name: "프로젝트 이름",
    project_path: "프로젝트 경로",
    git_url_optional: "Git URL (선택)",
    run_command: "실행 명령어",
    cancel: "취소",
    save: "저장",
    // Setup wizard
    configure_env: "Python 환경 구성",
    no_venv_found: "{name}에서 가상환경(.venv)을 찾지 못했습니다. uv로 새로 만들까요?",
    python_version: "Python 버전",
    install_reqs: "requirements.txt 의존성 설치",
    skip: "건너뛰기",
    initialize: "초기화",
    setting_up: "설정 중...",
    // About
    about_desc: "Tauri와 uv 기반의 모던 Python 워크스페이스 관리자. 프로젝트를 손쉽게 관리·모니터링·실행하세요.",
    check_update: "업데이트 확인",
    checking_update: "업데이트 확인 중...",
    view_release_notes: "릴리스 노트 보기",
    close: "닫기",
    language: "언어",
    version_beta: "버전 {v} · Beta",
    // Update dialogs
    update_available: "업데이트 가능",
    update_none_title: "업데이트 없음",
    update_none: "현재 최신 버전을 사용 중입니다.",
    update_prompt: "새로운 버전({v})이 출시되었습니다!\n\n{body}\n\n지금 업데이트를 다운로드하고 설치하시겠습니까? (앱이 재시작됩니다)",
    update_error: "업데이트 확인 중 오류가 발생했습니다: {err}",
    // Generic dialogs
    error: "오류",
    failed: "실패",
    confirm_remove_project: "이 프로젝트를 uvws에서 제거할까요?",
    confirm_kill_port: "{port} 포트의 모든 프로세스를 강제 종료할까요?",
    enter_port: "종료할 포트 번호를 입력하세요",
    // Share (tunnel + QR)
    share: "공유",
    share_title: "공개 링크로 공유",
    share_loading: "공개 URL을 만드는 중…",
    share_scan_hint: "폰 카메라로 QR을 스캔하세요",
    share_copy: "링크 복사",
    share_open: "브라우저에서 열기",
    share_stop: "공유 중지",
    share_public_warn: "⚠️ 이 링크를 아는 누구나 접속할 수 있습니다.",
    share_failed: "터널 생성에 실패했습니다.",
    tunnel_unavailable_desc: "공유하려면 cloudflared가 필요합니다. 아래로 설치하세요.",
    tunnel_install_link: "설치 안내 열기",
    // Notifications
    settings_notifications: "알림 (준비됨 / 비정상 종료)",
    notif_ready_title: "서버 준비됨 ✅",
    notif_ready_body: "{name} — localhost:{port}",
    notif_crash_title: "비정상 종료 ⚠️",
    notif_crash_body: "{name} 종료됨 (exit {code})",
    invalid_port: "잘못된 포트 번호입니다",
    failed_check_env: "환경 확인 실패: {err}",
    failed_add_project: "프로젝트 추가 실패: {err}",
    failed_setup_env: "환경 설정 실패: {err}",
    failed_start: "실행 실패: {err}",
    failed_stop: "중지 실패: {err}",
    failed_generic: "실패: {err}",
    // Terminal
    no_logs: "— 아직 로그가 없습니다. 실행을 눌러 시작하세요.",
    term_search: "로그 검색",
    term_search_placeholder: "로그에서 검색…",
    term_search_prev: "이전 결과",
    term_search_next: "다음 결과",
    term_font_smaller: "글자 작게",
    term_font_larger: "글자 크게",
    term_clear: "터미널 지우기",
    term_copy: "로그 복사",
    term_expand: "터미널 크게 보기",
    term_restore: "원래 크기로",
    term_jump_bottom: "최신 로그로 이동",
    term_latest: "최신 로그",
    // Restart
    restart: "재시작",
    restarting: "재시작 중…",
    failed_restart: "재시작 실패: {err}",
    // Sidebar
    sidebar_collapse: "사이드바 접기",
    sidebar_pin_open: "사이드바 고정",
  },
  en: {
    workspace_subtitle: "Python Workspace",
    projects: "Projects",
    add_project: "+ Add Project",
    remove_project: "Remove project",
    status_running: "Running",
    status_stopped: "Stopped",
    status_installing: "Installing",
    open_in_browser: "Open in Browser",
    no_port: "No Port",
    kill_port: "Kill Port",
    kill_port_title: "Kill port {port}",
    copy_log: "Copy Log",
    run: "Run",
    stop: "Stop",
    uptime: "Uptime",
    env: "Env",
    python: "Python",
    cpu: "CPU",
    memory: "Memory",
    tab_config: "Configuration",
    tab_env: "Environment",
    tab_deps: "Dependencies",
    tab_git: "Git",
    command_and_path: "Command & Path",
    command_and_path_desc: "Run command and interpreter settings",
    uv_managed: "uv managed",
    entry_command: "Entry Command",
    working_directory: "Working Directory",
    python_interpreter: "Python Interpreter",
    browse: "Browse…",
    env_vars: "Environment Variables",
    env_vars_desc: "Variables applied when the process runs",
    add_variable: "+ Add Variable",
    installed_packages: "Installed Packages",
    packages_count: "{n} packages in .venv",
    venv_not_found: ".venv not found",
    refresh: "Refresh",
    loading: "Loading…",
    sync_now: "Sync Now",
    syncing: "Syncing…",
    deps_loading: "Loading packages...",
    deps_empty: "No packages installed.",
    deps_no_venv: "No virtual environment (.venv) yet. Click Sync Now or Run to create one automatically.",
    pkg_package: "Package",
    pkg_version: "Version",
    git_branch: "Branch",
    git_fetch: "Fetch",
    git_pull: "Pull",
    git_push: "Push",
    git_ahead: "{n} ahead",
    git_behind: "{n} behind",
    git_staged: "Staged",
    git_modified: "Modified",
    git_untracked: "Untracked",
    git_clean: "Clean working tree",
    git_recent_commits: "Recent Commits",
    git_not_repo: "This folder is not a Git repository.",
    git_no_remote: "No remote repository configured.",
    git_no_upstream: "No upstream branch, so ahead/behind cannot be shown.",
    git_no_commits: "No commits yet.",
    git_loading: "Loading Git status...",
    no_projects: "No projects yet",
    no_projects_hint: "Click '+ Add Project' to register your first Python project.",
    add_new_project: "Add New Project",
    project_name: "Project Name",
    project_path: "Project Path",
    git_url_optional: "Git URL (optional)",
    run_command: "Run Command",
    cancel: "Cancel",
    save: "Save",
    configure_env: "Configure Python Environment",
    no_venv_found: "No virtual environment (.venv) was found in {name}. Do you want to initialize one using uv?",
    python_version: "Python Version",
    install_reqs: "Install requirements.txt dependencies",
    skip: "Skip",
    initialize: "Initialize",
    setting_up: "Setting up...",
    about_desc: "A modern Python workspace manager powered by Tauri and uv. Manage, monitor, and run your projects with ease.",
    check_update: "Check for Updates",
    checking_update: "Checking for updates...",
    view_release_notes: "View Release Notes",
    close: "Close",
    language: "Language",
    version_beta: "Version {v} · Beta",
    update_available: "Update Available",
    update_none_title: "No Updates",
    update_none: "You are using the latest version.",
    update_prompt: "A new version ({v}) is available!\n\n{body}\n\nDownload and install it now? (The app will restart)",
    update_error: "An error occurred while checking for updates: {err}",
    error: "Error",
    failed: "Failed",
    confirm_remove_project: "Remove this project from uvws?",
    confirm_kill_port: "Kill all processes on port {port}?",
    enter_port: "Enter port number to kill",
    // Share (tunnel + QR)
    share: "Share",
    share_title: "Share via public link",
    share_loading: "Creating a public URL…",
    share_scan_hint: "Scan the QR with your phone camera",
    share_copy: "Copy link",
    share_open: "Open in browser",
    share_stop: "Stop sharing",
    share_public_warn: "⚠️ Anyone with this link can access it.",
    share_failed: "Failed to create the tunnel.",
    tunnel_unavailable_desc: "Sharing needs cloudflared. Install it below.",
    tunnel_install_link: "Open install guide",
    // Notifications
    settings_notifications: "Notifications (ready / crash)",
    notif_ready_title: "Server ready ✅",
    notif_ready_body: "{name} — localhost:{port}",
    notif_crash_title: "Crashed ⚠️",
    notif_crash_body: "{name} exited (exit {code})",
    invalid_port: "Invalid port number",
    failed_check_env: "Failed to check environment: {err}",
    failed_add_project: "Failed to add project: {err}",
    failed_setup_env: "Failed to setup environment: {err}",
    failed_start: "Failed to start: {err}",
    failed_stop: "Failed to stop: {err}",
    failed_generic: "Failed: {err}",
    no_logs: "— No logs yet. Click Run to start.",
    term_search: "Search logs",
    term_search_placeholder: "Search in logs…",
    term_search_prev: "Previous match",
    term_search_next: "Next match",
    term_font_smaller: "Smaller text",
    term_font_larger: "Larger text",
    term_clear: "Clear terminal",
    term_copy: "Copy logs",
    term_expand: "Expand terminal",
    term_restore: "Restore size",
    term_jump_bottom: "Jump to latest",
    term_latest: "Latest",
    restart: "Restart",
    restarting: "Restarting…",
    failed_restart: "Failed to restart: {err}",
    sidebar_collapse: "Collapse sidebar",
    sidebar_pin_open: "Pin sidebar open",
  },
};

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "en" || saved === "ko" ? saved : "ko";
  });

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
  };

  const t = (key: string, vars?: Record<string, string | number>): string => {
    let str = translations[lang][key] ?? translations.ko[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return str;
  };

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
