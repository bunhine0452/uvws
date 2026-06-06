import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { open as openDialog, ask, message } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Globe, Copy, Square, Play, Clock, Box, FileCode, Settings, Wrench,
  PackageSearch, FolderOpen, X, RefreshCw, DownloadCloud, FileText, Zap,
  GitBranch, ArrowUp, ArrowDown, Download, Upload, Languages, History,
  RotateCw, ExternalLink
} from "lucide-react";
import TerminalView from "./components/TerminalView";
import { useI18n } from "./i18n";
import "./App.css";

interface Project {
  id: string;
  name: string;
  path: string;
  git_url?: string;
  run_command: string;
  env: Record<string, string>;
  status: string;
  python_path?: string;
  icon_color?: string;
  port?: number;
}

interface GitStatus {
  is_repo: boolean;
  branch: string;
  ahead: number;
  behind: number;
  staged: number;
  modified: number;
  untracked: number;
  has_remote: boolean;
  has_upstream: boolean;
}

interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
}

const ICON_COLORS = [
  "#343a40", "#495057", "#868e96", "#ced4da",
  "#d0b8ac", "#a3b18a", "#9a8c98", "#c9ada7",
];



function getIconColor(project: Project, index: number): string {
  if (project.icon_color) return project.icon_color;
  return ICON_COLORS[index % ICON_COLORS.length];
}

function shortenPath(p: string): string {
  // macOS/Linux: /Users/xxx/... → ~/...
  let shortened = p.replace(/^\/Users\/[^/]+/, "~");
  // Windows: C:\Users\xxx\... → ~/...
  shortened = shortened.replace(/^[A-Za-z]:\\\\Users\\\\[^\\\\]+/, "~");
  return shortened;
}

type TabId = "config" | "env" | "deps" | "git";

export default function App() {
  const { t, lang, setLang } = useI18n();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("config");
  const [pythonVersion, setPythonVersion] = useState<string>("");
  const [hasVenv, setHasVenv] = useState<boolean>(false);
  const [uptime, setUptime] = useState<number>(0);
  const uptimeRef = useRef<number | null>(null);

  // New States for About & Smart Import
  const [showAbout, setShowAbout] = useState(false);
  const [appVersion, setAppVersion] = useState("0.3.0");
  const [setupModalConfig, setSetupModalConfig] = useState<{project: Project, hasReqs: boolean} | null>(null);
  const [setupPythonVer, setSetupPythonVer] = useState("3.12");
  const [setupInstallReqs, setSetupInstallReqs] = useState(true);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  // Git state
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [gitCommits, setGitCommits] = useState<GitCommit[]>([]);
  const [gitLoading, setGitLoading] = useState(false);
  const [gitBusy, setGitBusy] = useState(false);

  // Kill-port modal (manual entry when no port detected)
  const [killPortModalOpen, setKillPortModalOpen] = useState(false);
  const [killPortInput, setKillPortInput] = useState("");

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {});
  }, []);

  const checkForUpdates = async () => {
    try {
      setIsCheckingUpdate(true);
      const update = await check();

      if (update) {
        const yes = await ask(
          t("update_prompt", { v: update.version, body: update.body || "" }),
          { title: t("update_available"), kind: "info" }
        );

        if (yes) {
          await update.downloadAndInstall();
          await relaunch();
        }
      } else {
        await message(t("update_none"), { title: t("update_none_title"), kind: "info" });
      }
    } catch (error) {
      await message(t("update_error", { err: String(error) }), { title: t("error"), kind: "error" });
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  // Global port map: projectId -> port
  const [projectPorts, setProjectPorts] = useState<Record<string, number>>({});

  // Editable config fields (local state for inline editing)
  const [editCmd, setEditCmd] = useState("");
  const [editPath, setEditPath] = useState("");
  const [editPyPath, setEditPyPath] = useState("");

  // Env vars editing
  const [envEntries, setEnvEntries] = useState<{ key: string; value: string }[]>([]);

  // Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPath, setNewPath] = useState("");
  const [newGitUrl, setNewGitUrl] = useState("");
  const [newRunCommand, setNewRunCommand] = useState("");

  // Installed packages
  const [packages, setPackages] = useState<{name: string; version: string}[]>([]);
  const [loadingPkgs, setLoadingPkgs] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  // Uptime timer
  useEffect(() => {
    const isRunning = selectedProjectId && projects.find(p => p.id === selectedProjectId)?.status === "Running";
    if (isRunning) {
      setUptime(0);
      uptimeRef.current = window.setInterval(() => {
        setUptime((prev) => prev + 1);
      }, 1000);
    } else {
      if (uptimeRef.current) clearInterval(uptimeRef.current);
      setUptime(0);
    }
    return () => {
      if (uptimeRef.current) clearInterval(uptimeRef.current);
    };
  }, [selectedProjectId, projects]);

  // Sync editable fields when project changes
  useEffect(() => {
    const proj = projects.find((p) => p.id === selectedProjectId);
    if (proj) {
      setEditCmd(proj.run_command);
      setEditPath(proj.path);
      setEditPyPath(proj.python_path || ".venv/bin/python");
      setEnvEntries(
        Object.entries(proj.env || {}).map(([key, value]) => ({ key, value }))
      );
      // Detect Python version
      invoke<string>("detect_python_version", { path: proj.path })
        .then(setPythonVersion)
        .catch(() => setPythonVersion(""));
      invoke<boolean>("check_venv_exists", { path: proj.path })
        .then(setHasVenv)
        .catch(() => setHasVenv(false));
      // Fetch installed packages
      fetchPackages(proj.path);
    }
  }, [selectedProjectId, projects]);

  // Load Git status when the Git tab is active or the project changes
  useEffect(() => {
    const proj = projects.find((p) => p.id === selectedProjectId);
    if (activeTab === "git" && proj) {
      loadGit(proj.path);
    }
  }, [activeTab, selectedProjectId]);

  // Global Event Listeners
  useEffect(() => {
    const unsubStatus = listen<{ id: string; status: string }>("process-status", (e) => {
      setProjects((prev) =>
        prev.map((p) => (p.id === e.payload.id ? { ...p, status: e.payload.status } : p))
      );
      if (e.payload.status !== "Running") {
        setProjectPorts((prev) => {
          const next = { ...prev };
          delete next[e.payload.id];
          return next;
        });
      }
    });

    const unsubPort = listen<{ id: string; port: number }>("process-port", (e) => {
      setProjectPorts((prev) => ({ ...prev, [e.payload.id]: e.payload.port }));
    });

    return () => {
      unsubStatus.then((u) => u());
      unsubPort.then((u) => u());
    };
  }, []);
  const loadProjects = async () => {
    try {
      const list: Project[] = await invoke("get_projects");
      setProjects(list);

      const ports: Record<string, number> = {};
      list.forEach(p => {
        if (p.port) ports[p.id] = p.port;
      });
      setProjectPorts(ports);

      if (list.length > 0 && !selectedProjectId) {
        setSelectedProjectId(list[0].id);
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
    }
  };

  const fetchPackages = async (projectPath: string) => {
    setLoadingPkgs(true);
    try {
      const result = await invoke<{name: string; version: string}[]>("list_dependencies", { path: projectPath });
      setPackages(result.map((p: any) => ({ name: p.name || p.Name || "", version: p.version || p.Version || "" })));
    } catch {
      setPackages([]);
    }
    setLoadingPkgs(false);
  };

  const loadGit = async (projectPath: string) => {
    setGitLoading(true);
    try {
      const [status, commits] = await Promise.all([
        invoke<GitStatus>("git_status", { path: projectPath }),
        invoke<GitCommit[]>("git_log", { path: projectPath, limit: 10 }),
      ]);
      setGitStatus(status);
      setGitCommits(status.is_repo ? commits : []);
    } catch {
      setGitStatus(null);
      setGitCommits([]);
    } finally {
      setGitLoading(false);
    }
  };

  const runGitAction = async (action: "git_fetch" | "git_pull" | "git_push") => {
    const proj = projects.find((p) => p.id === selectedProjectId);
    if (!proj) return;
    setGitBusy(true);
    try {
      const result = await invoke<string>(action, { path: proj.path });
      await message(result, { title: t("tab_git") });
      await loadGit(proj.path);
    } catch (err) {
      await message(t("failed_generic", { err: String(err) }), { title: t("error"), kind: "error" });
    } finally {
      setGitBusy(false);
    }
  };

  const handleSelectFolder = async () => {
    try {
      const selected = await openDialog({ directory: true, multiple: false, title: t("project_path") });
      if (selected) {
        const pathStr = Array.isArray(selected) ? selected[0] : selected;
        setNewPath(pathStr);
        if (!newName.trim()) {
          const parts = pathStr.split(/[/\\]/);
          setNewName(parts[parts.length - 1] || parts[parts.length - 2] || "");
        }
      }
    } catch (err) {
      console.error("Folder selection failed:", err);
    }
  };

  const handleConfigBrowse = async (field: "path" | "python") => {
    try {
      const selected = await openDialog({
        directory: field === "path",
        multiple: false,
        title: field === "path" ? t("working_directory") : t("python_interpreter"),
      });
      if (selected) {
        const pathStr = Array.isArray(selected) ? selected[0] : selected;
        if (field === "path") setEditPath(pathStr);
        else setEditPyPath(pathStr);
      }
    } catch (err) {
      console.error("Browse failed:", err);
    }
  };

  const saveProjectConfig = useCallback(async () => {
    if (!selectedProjectId) return;
    const proj = projects.find((p) => p.id === selectedProjectId);
    if (!proj) return;

    const envObj: Record<string, string> = {};
    envEntries.forEach(({ key, value }) => {
      if (key.trim()) envObj[key.trim()] = value;
    });

    try {
      const updated: Project[] = await invoke("update_project", {
        project: {
          ...proj,
          run_command: editCmd,
          path: editPath,
          python_path: editPyPath,
          env: envObj,
        },
      });
      setProjects(updated);
    } catch (err) {
      console.error("Failed to save config:", err);
    }
  }, [selectedProjectId, editCmd, editPath, editPyPath, envEntries, projects]);

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPath.trim()) return;

    const newProject: Project = {
      id: "project_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9),
      name: newName,
      path: newPath,
      git_url: newGitUrl.trim() || undefined,
      run_command: newRunCommand || "",
      env: {},
      status: "Stopped",
      icon_color: ICON_COLORS[projects.length % ICON_COLORS.length],
    };

    try {
      const venvExists: boolean = await invoke("check_venv_exists", { path: newPath });
      if (!venvExists) {
        const hasReqs: boolean = await invoke("check_requirements_exists", { path: newPath });
        setSetupModalConfig({ project: newProject, hasReqs });
        setSetupInstallReqs(hasReqs);
        setShowAddModal(false);
        return;
      }
      await finishAddProject(newProject);
    } catch (err) {
      await message(t("failed_check_env", { err: String(err) }), { title: t("error"), kind: "error" });
    }
  };

  const finishAddProject = async (proj: Project) => {
    try {
      const list: Project[] = await invoke("add_project", { project: proj });
      setProjects(list);
      setSelectedProjectId(proj.id);
      setShowAddModal(false);
      setNewName("");
      setNewPath("");
      setNewGitUrl("");
      setNewRunCommand("");
    } catch (err) {
      await message(t("failed_add_project", { err: String(err) }), { title: t("error"), kind: "error" });
    }
  };

  const handleSetupProjectEnv = async () => {
    if (!setupModalConfig) return;
    setIsSettingUp(true);
    try {
      await invoke("setup_project_env", {
        path: setupModalConfig.project.path,
        pythonVersion: setupPythonVer,
        installReqs: setupInstallReqs
      });
      await finishAddProject(setupModalConfig.project);
      setSetupModalConfig(null);
    } catch (err) {
      await message(t("failed_setup_env", { err: String(err) }), { title: t("error"), kind: "error" });
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    const ok = await ask(t("confirm_remove_project"), { title: t("remove_project"), kind: "warning" });
    if (!ok) return;
    try {
      const list: Project[] = await invoke("delete_project", { id });
      setProjects(list);
      if (selectedProjectId === id) setSelectedProjectId(list.length > 0 ? list[0].id : null);
    } catch (err) {
      await message(t("failed_generic", { err: String(err) }), { title: t("error"), kind: "error" });
    }
  };

  const handleRun = async () => {
    if (!selectedProjectId) return;
    const proj = projects.find((p) => p.id === selectedProjectId);
    if (!proj) return;
    // Save config first
    await saveProjectConfig();

    try {
      setProjects((prev) => prev.map((p) => (p.id === selectedProjectId ? { ...p, status: "Running" } : p)));
      await invoke("start_project", {
        id: proj.id,
        path: editPath || proj.path,
        runCommand: editCmd || proj.run_command,
      });
    } catch (err) {
      setProjects((prev) => prev.map((p) => (p.id === selectedProjectId ? { ...p, status: "Stopped" } : p)));
      await message(t("failed_start", { err: String(err) }), { title: t("error"), kind: "error" });
    }
  };

  const handleStop = async () => {
    if (!selectedProjectId) return;
    try {
      await invoke("stop_project", { id: selectedProjectId });
    } catch (err) {
      await message(t("failed_stop", { err: String(err) }), { title: t("error"), kind: "error" });
    }
  };

  // 로컬 서버를 멈췄다가 다시 띄우는 "새로 고침". 코드를 고쳤거나 서버가 멎었을 때
  // 포트가 풀릴 시간을 두고 재기동한다.
  const handleRestart = async () => {
    if (!selectedProjectId || isRestarting) return;
    setIsRestarting(true);
    try {
      await handleStop();
      // 프로세스 그룹 종료(SIGKILL)와 포트 해제를 기다린다.
      await new Promise((r) => setTimeout(r, 700));
      await handleRun();
    } catch (err) {
      await message(t("failed_restart", { err: String(err) }), { title: t("error"), kind: "error" });
    } finally {
      setIsRestarting(false);
    }
  };

  const handleSync = async () => {
    if (!selectedProjectId) return;
    const proj = projects.find((p) => p.id === selectedProjectId);
    if (!proj) return;
    try {
      setProjects((prev) => prev.map((p) => (p.id === selectedProjectId ? { ...p, status: "Installing" } : p)));
      await invoke("sync_project_dependencies", { id: proj.id, path: proj.path });
    } catch (err) {
      setProjects((prev) => prev.map((p) => (p.id === selectedProjectId ? { ...p, status: "Stopped" } : p)));
      await message(t("failed_generic", { err: String(err) }), { title: t("error"), kind: "error" });
    }
  };

  const handleOpenBrowser = async () => {
    if (!detectedPort) return;
    try {
      await openUrl(`http://localhost:${detectedPort}`);
    } catch (err) {
      console.error("Open browser failed:", err);
    }
  };

  const confirmAndKill = async (port: number) => {
    const ok = await ask(t("confirm_kill_port", { port }), { title: t("kill_port"), kind: "warning" });
    if (!ok) return;
    try {
      const result = await invoke<string>("kill_port", { port });
      await message(result, { title: t("kill_port") });
      if (selectedProjectId) {
        setProjectPorts((prev) => {
          const next = { ...prev };
          delete next[selectedProjectId];
          return next;
        });
      }
    } catch (err) {
      await message(t("failed_generic", { err: String(err) }), { title: t("error"), kind: "error" });
    }
  };

  const handleKillPort = async () => {
    if (detectedPort) {
      await confirmAndKill(detectedPort);
    } else {
      setKillPortInput("");
      setKillPortModalOpen(true);
    }
  };

  const submitKillPortModal = async () => {
    const port = parseInt(killPortInput, 10);
    if (isNaN(port) || port <= 0 || port > 65535) {
      await message(t("invalid_port"), { title: t("error"), kind: "error" });
      return;
    }
    setKillPortModalOpen(false);
    await confirmAndKill(port);
  };

  const handleCopyLog = async () => {
    if (!selectedProjectId) return;
    try {
      const logs = await invoke<string>("get_process_logs", { id: selectedProjectId });
      await navigator.clipboard.writeText(logs.replace(/\x1b\[[0-9;]*m/g, ""));
    } catch (err) {
      console.error("Failed to copy log:", err);
    }
  };

  const formatUptime = (s: number): string => {
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  };

  const statusLabel = (s: string): string => t(`status_${s.toLowerCase()}`);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const status = selectedProject?.status || "Stopped";
  const detectedPort = selectedProject ? projectPorts[selectedProject.id] : null;
  const isRunning = status === "Running";
  const isInstalling = status === "Installing";
  const isBusy = isRunning || isInstalling;

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-drag-region" />
        <div className="sidebar-brand" onClick={() => setShowAbout(true)} style={{ cursor: "pointer" }}>
          <img src="/icons/128x128.png" alt="uvws icon" width="34" height="34" style={{ borderRadius: 'var(--radius-md)', flexShrink: 0, boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }} />
          <div className="sidebar-brand-text">
            <h2>uvws</h2>
            <span>{t("workspace_subtitle")}</span>
          </div>
        </div>

        <div className="sidebar-section">{t("projects")}</div>

        <ul className="project-list">
          {projects.map((p, idx) => (
            <li
              key={p.id}
              className={`project-item ${selectedProjectId === p.id ? "active" : ""}`}
              onClick={() => setSelectedProjectId(p.id)}
            >
              <div className="project-icon" style={{ background: getIconColor(p, idx) }}>
                {String(idx + 1).padStart(2, '0')}
              </div>
              <div className="project-item-info">
                <div className="project-item-name">{p.name}</div>
                <div className="project-item-path">{shortenPath(p.path)}</div>
              </div>
              {p.status === "Running" && projectPorts[p.id] && (
                <span className="project-port-chip">:{projectPorts[p.id]}</span>
              )}
              <span className={`project-status-dot ${p.status.toLowerCase()}`} />
              <button
                className="project-delete-btn"
                onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.id); }}
                title={t("remove_project")}
              ><X size={14} /></button>
            </li>
          ))}
        </ul>

        <div className="sidebar-bottom">
          <button className="btn-add" onClick={() => setShowAddModal(true)}>
            {t("add_project")}
          </button>
        </div>
      </aside>

      <main className="main-content">
        {selectedProject ? (
          <>
            <div className="main-drag-region" />
            <div className="project-header">
              <div
                className="project-header-icon"
                style={{ background: getIconColor(selectedProject, projects.indexOf(selectedProject)) }}
              >
                {String(projects.indexOf(selectedProject) + 1).padStart(2, '0')}
              </div>
              <div className="project-header-info">
                <div className="project-header-title">
                  <h1>{selectedProject.name}</h1>
                  <span className={`status-indicator ${status.toLowerCase()}`}>
                    <span className="status-indicator-dot" />
                    {statusLabel(status)}
                  </span>
                </div>
                <div className="project-header-path">{selectedProject.path}</div>
              </div>
              <div className="project-header-actions">
                <button
                  className={`header-action-btn port-badge ${detectedPort && isRunning ? "active" : ""}`}
                  onClick={handleOpenBrowser}
                  disabled={!detectedPort || !isRunning}
                  title={t("open_in_browser")}
                >
                  <Globe size={14} /> {detectedPort && isRunning ? `:${detectedPort}` : t("no_port")}
                </button>
                <button
                  className="header-action-btn kill-port-btn"
                  onClick={handleKillPort}
                  title={detectedPort ? t("kill_port_title", { port: detectedPort }) : t("kill_port")}
                >
                  <Zap size={13} /> {t("kill_port")}
                </button>
                <button className="header-action-btn copy-btn" onClick={handleCopyLog}>
                  <Copy size={14} /> {t("copy_log")}
                </button>
                {isRunning ? (
                  <>
                    <button
                      className="header-action-btn restart-btn"
                      onClick={handleRestart}
                      disabled={isInstalling || isRestarting}
                      title={t("restart")}
                    >
                      <RotateCw size={13} className={isRestarting ? "spin" : ""} /> {isRestarting ? t("restarting") : t("restart")}
                    </button>
                    <button className="header-action-btn stop-btn" onClick={handleStop} disabled={isInstalling || isRestarting}>
                      <Square size={12} fill="currentColor" /> {t("stop")}
                    </button>
                  </>
                ) : (
                  <button className="header-action-btn run-btn" onClick={handleRun} disabled={isInstalling}>
                    <Play size={12} fill="currentColor" /> {t("run")}
                  </button>
                )}
              </div>
            </div>

            <div className="stats-bar">
              <div className="stat-chip">
                <span className="stat-chip-icon"><Clock size={13} /></span>
                {t("uptime")} {isRunning ? formatUptime(uptime) : "—"}
              </div>
              <div className="stat-chip">
                <span className="stat-chip-icon"><Box size={13} /></span>
                {t("env")}
                {hasVenv ? <span className="badge">uv</span> : " —"}
              </div>
              <div className="stat-chip">
                <span className="stat-chip-icon"><FileCode size={13} /></span>
                {t("python")} {pythonVersion || "—"}
              </div>
            </div>

            <div className="tabs-bar">
              <button className={`tab-btn ${activeTab === "config" ? "active" : ""}`} onClick={() => setActiveTab("config")}>
                <span className="tab-icon"><Settings size={14} /></span> {t("tab_config")}
              </button>
              <button className={`tab-btn ${activeTab === "env" ? "active" : ""}`} onClick={() => setActiveTab("env")}>
                <span className="tab-icon"><Wrench size={14} /></span> {t("tab_env")}
              </button>
              <button className={`tab-btn ${activeTab === "deps" ? "active" : ""}`} onClick={() => setActiveTab("deps")}>
                <span className="tab-icon"><PackageSearch size={14} /></span> {t("tab_deps")}
              </button>
              <button className={`tab-btn ${activeTab === "git" ? "active" : ""}`} onClick={() => setActiveTab("git")}>
                <span className="tab-icon"><GitBranch size={14} /></span> {t("tab_git")}
              </button>
            </div>

            <div className="tab-content">
              {activeTab === "config" && (
                <div className="config-panel">
                  <div className="config-card">
                    <div className="config-card-header">
                      <div className="config-card-title">
                        <span className="config-card-title-icon"><FileText size={18} /></span>
                        <div>
                          <h3>{t("command_and_path")}</h3>
                          <span>{t("command_and_path_desc")}</span>
                        </div>
                      </div>
                      {hasVenv && <span className="uv-badge">{t("uv_managed")}</span>}
                    </div>

                    <div className="config-field">
                      <div className="config-field-label">{t("entry_command")}</div>
                      <input
                        className="config-input"
                        value={editCmd}
                        onChange={(e) => setEditCmd(e.target.value)}
                        onBlur={saveProjectConfig}
                        placeholder="python main.py --port 8080"
                        disabled={isBusy}
                      />
                    </div>

                    <div className="config-field-row">
                      <div className="config-field" style={{ flex: 1 }}>
                        <div className="config-field-label">{t("working_directory")}</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            className="config-input"
                            value={editPath}
                            onChange={(e) => setEditPath(e.target.value)}
                            onBlur={saveProjectConfig}
                            disabled={isBusy}
                          />
                          <button className="config-browse-btn" style={{ marginTop: 0 }} onClick={() => handleConfigBrowse("path")} disabled={isBusy}>
                            {t("browse")}
                          </button>
                        </div>
                      </div>
                      <div className="config-field" style={{ flex: 1 }}>
                        <div className="config-field-label">{t("python_interpreter")}</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            className="config-input"
                            value={editPyPath}
                            onChange={(e) => setEditPyPath(e.target.value)}
                            onBlur={saveProjectConfig}
                            disabled={isBusy}
                          />
                          <button className="config-browse-btn" style={{ marginTop: 0 }} onClick={() => handleConfigBrowse("python")} disabled={isBusy}>
                            {t("browse")}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "env" && (
                <div className="env-panel">
                  <div className="config-card">
                    <div className="config-card-header">
                      <div className="config-card-title">
                        <span className="config-card-title-icon"><Wrench size={18} /></span>
                        <div>
                          <h3>{t("env_vars")}</h3>
                          <span>{t("env_vars_desc")}</span>
                        </div>
                      </div>
                    </div>
                    {envEntries.map((entry, i) => (
                      <div className="env-row" key={i}>
                        <input
                          className="env-key-input"
                          placeholder="KEY"
                          value={entry.key}
                          onChange={(e) => {
                            const newEntries = [...envEntries];
                            newEntries[i].key = e.target.value;
                            setEnvEntries(newEntries);
                          }}
                          onBlur={saveProjectConfig}
                        />
                        <input
                          className="env-val-input"
                          placeholder="value"
                          value={entry.value}
                          onChange={(e) => {
                            const newEntries = [...envEntries];
                            newEntries[i].value = e.target.value;
                            setEnvEntries(newEntries);
                          }}
                          onBlur={saveProjectConfig}
                        />
                        <button
                          className="env-remove-btn"
                          onClick={() => {
                            const ne = [...envEntries];
                            ne.splice(i, 1);
                            setEnvEntries(ne);
                            setTimeout(saveProjectConfig, 50);
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      className="env-add-btn"
                      onClick={() => setEnvEntries([...envEntries, { key: "", value: "" }])}
                    >
                      {t("add_variable")}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "deps" && (
                <div className="deps-panel">
                  <div className="deps-card">
                    <div className="deps-header">
                      <div>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><PackageSearch size={16} /> {t("installed_packages")}</h3>
                        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                          {hasVenv ? t("packages_count", { n: packages.length }) : t("venv_not_found")}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="deps-sync-btn" onClick={() => selectedProject && fetchPackages(selectedProject.path)} disabled={loadingPkgs}>
                          {loadingPkgs ? t("loading") : <><RefreshCw size={12} /> {t("refresh")}</>}
                        </button>
                        <button className="deps-sync-btn" style={{ background: 'var(--gradient-accent)', color: 'white', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 4px 16px var(--accent-glow)' }} onClick={handleSync} disabled={isBusy}>
                          {isInstalling ? t("syncing") : <><DownloadCloud size={12} /> {t("sync_now")}</>}
                        </button>
                      </div>
                    </div>
                    {packages.length > 0 ? (
                      <div className="deps-table-wrap">
                        <table className="deps-table">
                          <thead>
                            <tr>
                              <th>{t("pkg_package")}</th>
                              <th>{t("pkg_version")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {packages.map((pkg, i) => (
                              <tr key={i}>
                                <td className="deps-pkg-name">{pkg.name}</td>
                                <td className="deps-pkg-ver">{pkg.version}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="deps-info">
                        <p style={{ color: "var(--text-tertiary)" }}>
                          {hasVenv
                            ? loadingPkgs ? t("deps_loading") : t("deps_empty")
                            : t("deps_no_venv")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "git" && (
                <div className="git-panel">
                  <div className="config-card">
                    <div className="config-card-header">
                      <div className="config-card-title">
                        <span className="config-card-title-icon"><GitBranch size={18} /></span>
                        <div>
                          <h3>{t("tab_git")}</h3>
                          <span>{selectedProject.git_url || selectedProject.path}</span>
                        </div>
                      </div>
                      {gitStatus?.is_repo && (
                        <div className="git-actions">
                          <button className="deps-sync-btn" onClick={() => runGitAction("git_fetch")} disabled={gitBusy || !gitStatus.has_remote}>
                            <RefreshCw size={12} /> {t("git_fetch")}
                          </button>
                          <button className="deps-sync-btn" onClick={() => runGitAction("git_pull")} disabled={gitBusy || !gitStatus.has_remote}>
                            <Download size={12} /> {t("git_pull")}
                          </button>
                          <button className="deps-sync-btn" style={{ background: 'var(--gradient-accent)', color: 'white', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 4px 16px var(--accent-glow)' }} onClick={() => runGitAction("git_push")} disabled={gitBusy || !gitStatus.has_remote}>
                            <Upload size={12} /> {t("git_push")}
                          </button>
                        </div>
                      )}
                    </div>

                    {gitLoading ? (
                      <div className="deps-info"><p style={{ color: "var(--text-tertiary)" }}>{t("git_loading")}</p></div>
                    ) : !gitStatus?.is_repo ? (
                      <div className="deps-info"><p style={{ color: "var(--text-tertiary)" }}>{t("git_not_repo")}</p></div>
                    ) : (
                      <>
                        <div className="git-summary">
                          <span className="git-branch-chip"><GitBranch size={13} /> {gitStatus.branch || "—"}</span>
                          {gitStatus.has_upstream && (gitStatus.ahead > 0 || gitStatus.behind > 0) ? (
                            <>
                              {gitStatus.ahead > 0 && <span className="git-chip git-ahead"><ArrowUp size={12} /> {t("git_ahead", { n: gitStatus.ahead })}</span>}
                              {gitStatus.behind > 0 && <span className="git-chip git-behind"><ArrowDown size={12} /> {t("git_behind", { n: gitStatus.behind })}</span>}
                            </>
                          ) : null}
                          {!gitStatus.has_remote && <span className="git-chip git-muted">{t("git_no_remote")}</span>}
                        </div>

                        <div className="git-stats">
                          <div className="git-stat"><span className="git-stat-num">{gitStatus.staged}</span><span className="git-stat-label">{t("git_staged")}</span></div>
                          <div className="git-stat"><span className="git-stat-num">{gitStatus.modified}</span><span className="git-stat-label">{t("git_modified")}</span></div>
                          <div className="git-stat"><span className="git-stat-num">{gitStatus.untracked}</span><span className="git-stat-label">{t("git_untracked")}</span></div>
                        </div>

                        {gitStatus.staged === 0 && gitStatus.modified === 0 && gitStatus.untracked === 0 && (
                          <p className="git-clean">{t("git_clean")}</p>
                        )}

                        <div className="git-commits-header">
                          <History size={13} /> {t("git_recent_commits")}
                        </div>
                        {gitCommits.length > 0 ? (
                          <ul className="git-commits">
                            {gitCommits.map((c) => (
                              <li key={c.hash} className="git-commit">
                                <code className="git-commit-hash">{c.hash}</code>
                                <span className="git-commit-msg">{c.message}</span>
                                <span className="git-commit-meta">{c.author} · {c.date}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>{t("git_no_commits")}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Terminal */}
              <div className="terminal-section">
                <TerminalView
                  projectId={selectedProject.id}
                  projectName={selectedProject.name}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div className="main-drag-region" />
            <div className="empty-state-icon"><FolderOpen size={48} strokeWidth={1.5} /></div>
            <p>{t("no_projects")}</p>
            <p className="muted">{t("no_projects_hint")}</p>
          </div>
        )}
      </main>

      {/* ═══ Add Project Modal ═══ */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{t("add_new_project")}</h3>
            <form onSubmit={handleAddProject}>
              <div className="form-group">
                <label>{t("project_name")}</label>
                <input
                  type="text"
                  placeholder="e.g. ComfyUI, ACE-Step"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>{t("project_path")}</label>
                <div className="form-group-row">
                  <input
                    type="text"
                    placeholder="/Users/username/projects/my-app"
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    required
                  />
                  <button type="button" className="btn-browse" onClick={handleSelectFolder}>
                    {t("browse")}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>{t("git_url_optional")}</label>
                <input
                  type="text"
                  placeholder="https://github.com/..."
                  value={newGitUrl}
                  onChange={(e) => setNewGitUrl(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>{t("run_command")}</label>
                <input
                  type="text"
                  placeholder="python main.py, uv run acestep, streamlit run app.py"
                  value={newRunCommand}
                  onChange={(e) => setNewRunCommand(e.target.value)}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>{t("cancel")}</button>
                <button type="submit" className="btn-primary">{t("save")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Smart Import Wizard Modal */}
      {setupModalConfig && (
        <div className="modal-backdrop" onClick={() => !isSettingUp && setSetupModalConfig(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{t("configure_env")}</h3>
            <p style={{ marginBottom: 16, color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5 }}>
              {t("no_venv_found", { name: setupModalConfig.project.name })}
            </p>
            <div className="form-group">
              <label>{t("python_version")}</label>
              <select value={setupPythonVer} onChange={e => setSetupPythonVer(e.target.value)} disabled={isSettingUp}>
                <option value="3.10">Python 3.10</option>
                <option value="3.11">Python 3.11</option>
                <option value="3.12">Python 3.12</option>
                <option value="3.13">Python 3.13</option>
              </select>
            </div>
            {setupModalConfig.hasReqs && (
              <div className="form-group" style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
                <input
                  type="checkbox"
                  id="install_reqs"
                  checked={setupInstallReqs}
                  onChange={e => setSetupInstallReqs(e.target.checked)}
                  disabled={isSettingUp}
                />
                <label htmlFor="install_reqs" style={{ marginBottom: 0 }}>
                  {t("install_reqs")}
                </label>
              </div>
            )}
            <div className="modal-actions" style={{ marginTop: 24 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  finishAddProject(setupModalConfig.project);
                  setSetupModalConfig(null);
                }}
                disabled={isSettingUp}
              >
                {t("skip")}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSetupProjectEnv}
                disabled={isSettingUp}
              >
                {isSettingUp ? t("setting_up") : t("initialize")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kill Port Modal (manual entry) */}
      {killPortModalOpen && (
        <div className="modal-backdrop" onClick={() => setKillPortModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{t("kill_port")}</h3>
            <form onSubmit={(e) => { e.preventDefault(); submitKillPortModal(); }}>
              <div className="form-group">
                <label>{t("enter_port")}</label>
                <input
                  type="number"
                  min={1}
                  max={65535}
                  placeholder="8080"
                  value={killPortInput}
                  onChange={(e) => setKillPortInput(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setKillPortModalOpen(false)}>{t("cancel")}</button>
                <button type="submit" className="btn-primary">{t("kill_port")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* About Modal */}
      {showAbout && (
        <div className="modal-backdrop" onClick={() => setShowAbout(false)}>
          <div className="modal-content about-modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', padding: 44 }}>
            <img src="/icons/128x128.png" alt="uvws icon" width="56" height="56" style={{ marginBottom: 24, borderRadius: 16, display: 'block', margin: '0 auto 24px', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }} />
            <h2 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)', fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>uvws</h2>
            <p style={{ margin: '0 0 6px 0', color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' as const }}>{t("version_beta", { v: appVersion })}</p>
            <p style={{ lineHeight: 1.7, color: 'var(--text-secondary)', fontSize: 13, margin: '16px 0 24px', maxWidth: 340, marginLeft: 'auto', marginRight: 'auto' }}>
              {t("about_desc")}
            </p>

            <div className="lang-toggle">
              <span className="lang-toggle-label"><Languages size={13} /> {t("language")}</span>
              <div className="lang-toggle-buttons">
                <button className={lang === "ko" ? "active" : ""} onClick={() => setLang("ko")}>한국어</button>
                <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>English</button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', marginTop: 20 }}>
              <button
                className="btn-secondary"
                onClick={checkForUpdates}
                disabled={isCheckingUpdate}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {isCheckingUpdate ? t("checking_update") : t("check_update")}
              </button>
              <button
                className="btn-secondary"
                onClick={() => openUrl("https://github.com/bunhine0452/uvws/releases/latest").catch(() => {})}
                style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <ExternalLink size={13} /> {t("view_release_notes")}
              </button>
              <button className="btn-primary" onClick={() => setShowAbout(false)} style={{ width: '100%' }}>{t("close")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
