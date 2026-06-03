import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useI18n } from "../i18n";
import "@xterm/xterm/css/xterm.css";

interface TerminalViewProps {
  projectId: string;
  projectName?: string;
}

export default function TerminalView({ projectId, projectName }: TerminalViewProps) {
  const { t } = useI18n();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [termSize, setTermSize] = useState({ cols: 0, rows: 0 });

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      theme: {
        background: "#0c0e12",
        foreground: "#c8ccd4",
        cursor: "#6366f1",
        cursorAccent: "#0c0e12",
        selectionBackground: "rgba(99, 102, 241, 0.2)",
        selectionForeground: "#e8eaed",
        black: "#0d0f13",
        red: "#f87171",
        green: "#34d399",
        yellow: "#fbbf24",
        blue: "#818cf8",
        magenta: "#c084fc",
        cyan: "#2dd4bf",
        white: "#c8ccd4",
        brightBlack: "#5a5e73",
        brightRed: "#fca5a5",
        brightGreen: "#6ee7b7",
        brightYellow: "#fde68a",
        brightBlue: "#a5b4fc",
        brightMagenta: "#d8b4fe",
        brightCyan: "#5eead4",
        brightWhite: "#e8eaed",
      },
      fontFamily: "'SF Mono', SFMono-Regular, Menlo, Monaco, 'Courier New', monospace",
      fontSize: 12.5,
      lineHeight: 1.4,
      scrollback: 10000,
      cursorBlink: true,
      cursorStyle: "bar",
      convertEol: true,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);

    const doFit = () => {
      try {
        fitAddon.fit();
        setTermSize({ cols: term.cols, rows: term.rows });
      } catch (_) {}
    };

    requestAnimationFrame(doFit);
    setTimeout(doFit, 200);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    invoke<string>("get_process_logs", { id: projectId }).then(logs => {
      if (logs) {
        term.write(logs);
      } else {
        term.write(`\x1b[38;2;100;100;110m${t("no_logs")}\x1b[0m\r\n`);
      }
    });

    // Log listener
    const unsubLog = listen<string>(`log-stream-${projectId}`, (e) => {
      term.write(e.payload);
    });

    // Resize
    let timer: number;
    const onResize = () => {
      clearTimeout(timer);
      timer = window.setTimeout(doFit, 60);
    };
    window.addEventListener("resize", onResize);

    const ro = new ResizeObserver(onResize);
    if (terminalRef.current) ro.observe(terminalRef.current);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      unsubLog.then((u) => u());
      term.dispose();
    };
  }, [projectId]);

  const handleClear = () => xtermRef.current?.clear();

  const handleCopy = () => {
    const term = xtermRef.current;
    if (!term) return;
    // Get all buffer content
    const buf = term.buffer.active;
    let text = "";
    for (let i = 0; i < buf.length; i++) {
      const line = buf.getLine(i);
      if (line) text += line.translateToString(true) + "\n";
    }
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const title = `zsh — ${projectName || "Terminal"} — ${termSize.cols}×${termSize.rows}`;

  return (
    <div className="terminal-outer-frame">
      <div className="terminal-header-bar">
        <span className="terminal-title">{title}</span>
        <div className="terminal-header-actions">
          <button className="terminal-action-btn" onClick={handleClear}>Clear</button>
          <button className="terminal-action-btn" onClick={handleCopy}>Copy</button>
        </div>
      </div>
      <div className="terminal-inner-content">
        <div ref={terminalRef} className="xterm-view" />
      </div>
    </div>
  );
}
