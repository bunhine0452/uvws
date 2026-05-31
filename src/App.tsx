import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { 
  Globe, Copy, Square, Play, Clock, Box, FileCode, Settings, Wrench, 
  PackageSearch, FolderOpen, X, RefreshCw, DownloadCloud, FileText, Zap
} from "lucide-react";
import TerminalView from "./components/TerminalView";
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

type TabId = "config" | "env" | "deps";

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("config");
  const [pythonVersion, setPythonVersion] = useState<string>("");
  const [hasVenv, setHasVenv] = useState<boolean>(false);
  const [uptime, setUptime] = useState<number>(0);
  const uptimeRef = useRef<number | null>(null);
  
  // New States for About & Smart Import
  const [showAbout, setShowAbout] = useState(false);
  const [setupModalConfig, setSetupModalConfig] = useState<{project: Project, hasReqs: boolean} | null>(null);
  const [setupPythonVer, setSetupPythonVer] = useState("3.12");
  const [setupInstallReqs, setSetupInstallReqs] = useState(true);
  const [isSettingUp, setIsSettingUp] = useState(false);

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

  // Log buffer for copy
  const logBufferRef = useRef<string>("");

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

  const handleSelectFolder = async () => {
    try {
      const selected = await openDialog({ directory: true, multiple: false, title: "Select Project Directory" });
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
        title: field === "path" ? "Select Working Directory" : "Select Python Interpreter",
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
      const hasVenv: boolean = await invoke("check_venv_exists", { path: newPath });
      if (!hasVenv) {
        const hasReqs: boolean = await invoke("check_requirements_exists", { path: newPath });
        setSetupModalConfig({ project: newProject, hasReqs });
        setSetupInstallReqs(hasReqs);
        setShowAddModal(false);
        return;
      }
      await finishAddProject(newProject);
    } catch (err) {
      alert(`Failed to check environment: ${err}`);
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
      alert(`Failed to add project: ${err}`);
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
      alert("Failed to setup environment: " + err);
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm("Remove this project from uvws?")) return;
    try {
      const list: Project[] = await invoke("delete_project", { id });
      setProjects(list);
      if (selectedProjectId === id) setSelectedProjectId(list.length > 0 ? list[0].id : null);
    } catch (err) {
      alert(`Failed: ${err}`);
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
      alert(`Failed to start: ${err}`);
    }
  };

  const handleStop = async () => {
    if (!selectedProjectId) return;
    try {
      await invoke("stop_project", { id: selectedProjectId });
    } catch (err) {
      alert(`Failed to stop: ${err}`);
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
      alert(`Failed: ${err}`);
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

  const handleKillPort = async () => {
    let portToKill = detectedPort;
    if (!portToKill) {
      const input = prompt("Enter port number to kill:");
      if (!input) return;
      portToKill = parseInt(input, 10);
      if (isNaN(portToKill) || portToKill <= 0 || portToKill > 65535) {
        alert("Invalid port number");
        return;
      }
    }
    if (!confirm(`Kill all processes on port ${portToKill}?`)) return;
    try {
      const result = await invoke<string>("kill_port", { port: portToKill });
      alert(result);
      if (selectedProjectId) {
        setProjectPorts((prev) => {
          const next = { ...prev };
          delete next[selectedProjectId];
          return next;
        });
      }
    } catch (err) {
      alert(`Failed: ${err}`);
    }
  };

  const handleCopyLog = () => {
    navigator.clipboard.writeText(logBufferRef.current.replace(/\x1b\[[0-9;]*m/g, "")).catch(() => {});
  };

  const formatUptime = (s: number): string => {
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  };

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
            <span>Python Workspace</span>
          </div>
        </div>

        <div className="sidebar-section">Projects</div>

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
              <span className={`project-status-dot ${p.status.toLowerCase()}`} />
              <button
                className="project-delete-btn"
                onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.id); }}
                title="Remove project"
              ><X size={14} /></button>
            </li>
          ))}
        </ul>

        <div className="sidebar-bottom">
          <button className="btn-add" onClick={() => setShowAddModal(true)}>
            + Add Project
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
                    {status}
                  </span>
                </div>
                <div className="project-header-path">{selectedProject.path}</div>
              </div>
              <div className="project-header-actions">
                <button
                  className={`header-action-btn port-badge ${detectedPort && isRunning ? "active" : ""}`}
                  onClick={handleOpenBrowser}
                  disabled={!detectedPort || !isRunning}
                  title="Open in Browser"
                >
                  <Globe size={14} /> {detectedPort && isRunning ? `:${detectedPort}` : "No Port"}
                </button>
                <button
                  className="header-action-btn kill-port-btn"
                  onClick={handleKillPort}
                  title={detectedPort ? `Kill port ${detectedPort}` : "Kill port"}
                >
                  <Zap size={13} /> Kill Port
                </button>
                <button className="header-action-btn copy-btn" onClick={handleCopyLog}>
                  <Copy size={14} /> Copy Log
                </button>
                {isRunning ? (
                  <button className="header-action-btn stop-btn" onClick={handleStop} disabled={isInstalling}>
                    <Square size={12} fill="currentColor" /> Stop
                  </button>
                ) : (
                  <button className="header-action-btn run-btn" onClick={handleRun} disabled={isInstalling}>
                    <Play size={12} fill="currentColor" /> Run
                  </button>
                )}
              </div>
            </div>

            <div className="stats-bar">
              <div className="stat-chip">
                <span className="stat-chip-icon"><Clock size={13} /></span>
                Uptime {isRunning ? formatUptime(uptime) : "—"}
              </div>
              <div className="stat-chip">
                <span className="stat-chip-icon"><Box size={13} /></span>
                Env
                {hasVenv ? <span className="badge">uv</span> : " —"}
              </div>
              <div className="stat-chip">
                <span className="stat-chip-icon"><FileCode size={13} /></span>
                Python {pythonVersion || "—"}
              </div>
            </div>

            <div className="tabs-bar">
              <button className={`tab-btn ${activeTab === "config" ? "active" : ""}`} onClick={() => setActiveTab("config")}>
                <span className="tab-icon"><Settings size={14} /></span> Configuration
              </button>
              <button className={`tab-btn ${activeTab === "env" ? "active" : ""}`} onClick={() => setActiveTab("env")}>
                <span className="tab-icon"><Wrench size={14} /></span> Environment
              </button>
              <button className={`tab-btn ${activeTab === "deps" ? "active" : ""}`} onClick={() => setActiveTab("deps")}>
                <span className="tab-icon"><PackageSearch size={14} /></span> Dependencies
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
                          <h3>Command & Path</h3>
                          <span>실행 명령어 및 인터프리터 설정</span>
                        </div>
                      </div>
                      {hasVenv && <span className="uv-badge">uv managed</span>}
                    </div>

                    <div className="config-field">
                      <div className="config-field-label">Entry Command</div>
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
                        <div className="config-field-label">Working Directory</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            className="config-input"
                            value={editPath}
                            onChange={(e) => setEditPath(e.target.value)}
                            onBlur={saveProjectConfig}
                            disabled={isBusy}
                          />
                          <button className="config-browse-btn" style={{ marginTop: 0 }} onClick={() => handleConfigBrowse("path")} disabled={isBusy}>
                            Browse…
                          </button>
                        </div>
                      </div>
                      <div className="config-field" style={{ flex: 1 }}>
                        <div className="config-field-label">Python Interpreter</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            className="config-input"
                            value={editPyPath}
                            onChange={(e) => setEditPyPath(e.target.value)}
                            onBlur={saveProjectConfig}
                            disabled={isBusy}
                          />
                          <button className="config-browse-btn" style={{ marginTop: 0 }} onClick={() => handleConfigBrowse("python")} disabled={isBusy}>
                            Browse…
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
                          <h3>Environment Variables</h3>
                          <span>프로세스 실행 시 적용되는 환경변수</span>
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
                      + Add Variable
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "deps" && (
                <div className="deps-panel">
                  <div className="deps-card">
                    <div className="deps-header">
                      <div>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><PackageSearch size={16} /> Installed Packages</h3>
                        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                          {hasVenv ? `${packages.length} packages in .venv` : ".venv not found"}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="deps-sync-btn" onClick={() => selectedProject && fetchPackages(selectedProject.path)} disabled={loadingPkgs}>
                          {loadingPkgs ? "Loading…" : <><RefreshCw size={12} /> Refresh</>}
                        </button>
                        <button className="deps-sync-btn" style={{ background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' }} onClick={handleSync} disabled={isBusy}>
                          {isInstalling ? "Syncing…" : <><DownloadCloud size={12} /> Sync Now</>}
                        </button>
                      </div>
                    </div>
                    {packages.length > 0 ? (
                      <div className="deps-table-wrap">
                        <table className="deps-table">
                          <thead>
                            <tr>
                              <th>Package</th>
                              <th>Version</th>
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
                            ? loadingPkgs ? "패키지 목록을 불러오는 중..." : "설치된 패키지가 없습니다."
                            : "가상환경(.venv)이 아직 없습니다. Sync Now를 클릭하거나 Run으로 자동 생성하세요."}
                        </p>
                      </div>
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
            <p>No projects yet</p>
            <p className="muted">Click '+ Add Project' to register your first Python project.</p>
          </div>
        )}
      </main>

      {/* ═══ Modal ═══ */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Project</h3>
            <form onSubmit={handleAddProject}>
              <div className="form-group">
                <label>Project Name</label>
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
                <label>Project Path</label>
                <div className="form-group-row">
                  <input
                    type="text"
                    placeholder="/Users/username/projects/my-app"
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    required
                  />
                  <button type="button" className="btn-browse" onClick={handleSelectFolder}>
                    Browse…
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Git URL (optional)</label>
                <input
                  type="text"
                  placeholder="https://github.com/..."
                  value={newGitUrl}
                  onChange={(e) => setNewGitUrl(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Run Command</label>
                <input
                  type="text"
                  placeholder="python main.py, uv run acestep, streamlit run app.py"
                  value={newRunCommand}
                  onChange={(e) => setNewRunCommand(e.target.value)}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Smart Import Wizard Modal */}
      {setupModalConfig && (
        <div className="modal-backdrop" onClick={() => !isSettingUp && setSetupModalConfig(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Configure Python Environment</h3>
            <p style={{ marginBottom: 16, color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5 }}>
              No virtual environment (.venv) was found in <strong>{setupModalConfig.project.name}</strong>.<br />
              Do you want to initialize one using <code>uv</code>?
            </p>
            <div className="form-group">
              <label>Python Version</label>
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
                  Install <code>requirements.txt</code> dependencies
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
                Skip
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                onClick={handleSetupProjectEnv}
                disabled={isSettingUp}
              >
                {isSettingUp ? "Setting up..." : "Initialize"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* About Modal */}
      {showAbout && (
        <div className="modal-backdrop" onClick={() => setShowAbout(false)}>
          <div className="modal-content about-modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', padding: 44 }}>
            <img src="/icons/128x128.png" alt="uvws icon" width="56" height="56" style={{ marginBottom: 24, borderRadius: 16, display: 'block', margin: '0 auto 24px', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }} />
            <h2 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)', fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>uvws</h2>
            <p style={{ margin: '0 0 6px 0', color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' as const }}>Version 0.1.0 · Beta</p>
            <p style={{ lineHeight: 1.7, color: 'var(--text-secondary)', fontSize: 13, margin: '16px 0 32px', maxWidth: 340, marginLeft: 'auto', marginRight: 'auto' }}>
              A modern Python workspace manager powered by Tauri and uv. Manage, monitor, and run your projects with ease.
            </p>
            <button className="btn-primary" onClick={() => setShowAbout(false)} style={{ width: '100%' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
