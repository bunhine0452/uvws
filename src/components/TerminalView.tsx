import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Search, Copy, Eraser, Maximize2, Minimize2, ArrowDownToLine,
  Plus, Minus, X, ChevronUp, ChevronDown,
} from "lucide-react";
import { useI18n } from "../i18n";
import "@xterm/xterm/css/xterm.css";

interface TerminalViewProps {
  projectId: string;
  projectName?: string;
}

const FONT_KEY = "uvws.term.fontSize";
const MIN_FONT = 9;
const MAX_FONT = 22;

export default function TerminalView({ projectId, projectName }: TerminalViewProps) {
  const { t } = useI18n();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [termSize, setTermSize] = useState({ cols: 0, rows: 0 });
  const [expanded, setExpanded] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [atBottom, setAtBottom] = useState(true);
  const [fontSize, setFontSize] = useState<number>(() => {
    const saved = parseFloat(localStorage.getItem(FONT_KEY) || "");
    return saved >= MIN_FONT && saved <= MAX_FONT ? saved : 12.5;
  });

  const doFit = useCallback(() => {
    const term = xtermRef.current;
    const fit = fitAddonRef.current;
    if (!term || !fit) return;
    try {
      fit.fit();
      setTermSize({ cols: term.cols, rows: term.rows });
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      theme: {
        background: "#0c0e12",
        foreground: "#c8ccd4",
        cursor: "#6366f1",
        cursorAccent: "#0c0e12",
        selectionBackground: "rgba(99, 102, 241, 0.28)",
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
      fontSize,
      lineHeight: 1.4,
      scrollback: 20000,
      cursorBlink: true,
      cursorStyle: "bar",
      convertEol: true,
      allowTransparency: true,
      smoothScrollDuration: 0,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    const searchAddon = new SearchAddon();
    term.loadAddon(searchAddon);

    // 로그에 뜨는 localhost / http 링크를 클릭하면 외부 브라우저로 연다.
    term.loadAddon(
      new WebLinksAddon((_event, uri) => {
        openUrl(uri).catch(() => {});
      })
    );

    term.open(terminalRef.current);

    // GPU 렌더러(있으면) — 대량 로그 스크롤·렌더 성능을 크게 끌어올린다.
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => webgl.dispose());
      term.loadAddon(webgl);
    } catch (_) {
      // WebGL2 미지원 환경에서는 기본 DOM 렌더러로 자동 폴백
    }

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    requestAnimationFrame(doFit);
    setTimeout(doFit, 200);

    // 스크롤 위치 추적 → 맨 아래가 아니면 "최신 로그로" 버튼 노출
    const updateAtBottom = () => {
      const buf = term.buffer.active;
      setAtBottom(buf.viewportY >= buf.baseY);
    };
    const scrollSub = term.onScroll(updateAtBottom);

    invoke<string>("get_process_logs", { id: projectId }).then((logs) => {
      if (logs) {
        term.write(logs, () => term.scrollToBottom());
      } else {
        term.write(`\x1b[38;2;100;100;110m${t("no_logs")}\x1b[0m\r\n`);
      }
    });

    // 배치된 로그 청크 수신 → 한 번에 write
    const unsubLog = listen<string>(`log-stream-${projectId}`, (e) => {
      const buf = term.buffer.active;
      const wasBottom = buf.viewportY >= buf.baseY;
      term.write(e.payload, () => {
        if (wasBottom) term.scrollToBottom();
      });
    });

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
      scrollSub.dispose();
      unsubLog.then((u) => u());
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      searchAddonRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // 폰트 크기 변경 반영
  useEffect(() => {
    const term = xtermRef.current;
    if (!term) return;
    term.options.fontSize = fontSize;
    localStorage.setItem(FONT_KEY, String(fontSize));
    requestAnimationFrame(doFit);
  }, [fontSize, doFit]);

  // 확대/축소 전환 시 레이아웃이 바뀌므로 리핏
  useEffect(() => {
    requestAnimationFrame(doFit);
    const id = setTimeout(doFit, 220);
    return () => clearTimeout(id);
  }, [expanded, doFit]);

  // 검색창이 열리면 자동 포커스
  useEffect(() => {
    if (showSearch) searchInputRef.current?.focus();
  }, [showSearch]);

  // 확대 모드에서 Esc로 원래 크기로 복귀
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !showSearch) setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, showSearch]);

  const runSearch = (term: string, next: boolean) => {
    const addon = searchAddonRef.current;
    if (!addon || !term) return;
    const opts = {
      decorations: {
        matchBackground: "#3b3050",
        matchOverviewRuler: "#a78bfa",
        activeMatchBackground: "#6d28d9",
        activeMatchColorOverviewRuler: "#c4b5fd",
      },
    };
    if (next) addon.findNext(term, opts);
    else addon.findPrevious(term, opts);
  };

  const handleSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runSearch(searchTerm, !e.shiftKey);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeSearch();
    }
  };

  const closeSearch = () => {
    setShowSearch(false);
    searchAddonRef.current?.clearDecorations();
    xtermRef.current?.focus();
  };

  const handleClear = () => {
    xtermRef.current?.clear();
    setAtBottom(true);
  };

  const handleCopy = () => {
    const term = xtermRef.current;
    if (!term) return;
    const sel = term.getSelection();
    if (sel) {
      navigator.clipboard.writeText(sel).catch(() => {});
      return;
    }
    const buf = term.buffer.active;
    let text = "";
    for (let i = 0; i < buf.length; i++) {
      const line = buf.getLine(i);
      if (line) text += line.translateToString(true) + "\n";
    }
    navigator.clipboard.writeText(text.replace(/\n+$/, "\n")).catch(() => {});
  };

  const jumpToBottom = () => {
    xtermRef.current?.scrollToBottom();
    setAtBottom(true);
  };

  const changeFont = (delta: number) => {
    setFontSize((f) => Math.min(MAX_FONT, Math.max(MIN_FONT, Math.round((f + delta) * 2) / 2)));
  };

  const title = `zsh — ${projectName || "Terminal"} — ${termSize.cols}×${termSize.rows}`;

  return (
    <div className={`terminal-outer-frame${expanded ? " expanded" : ""}`}>
      <div className="terminal-header-bar">
        <span className="terminal-title">{title}</span>
        <div className="terminal-header-actions">
          <button
            className={`terminal-action-btn icon${showSearch ? " on" : ""}`}
            onClick={() => (showSearch ? closeSearch() : setShowSearch(true))}
            title={t("term_search")}
          ><Search size={13} /></button>
          <span className="terminal-font-ctrl">
            <button className="terminal-action-btn icon" onClick={() => changeFont(-1)} title={t("term_font_smaller")}><Minus size={13} /></button>
            <button className="terminal-action-btn icon" onClick={() => changeFont(1)} title={t("term_font_larger")}><Plus size={13} /></button>
          </span>
          <button className="terminal-action-btn icon" onClick={handleClear} title={t("term_clear")}><Eraser size={13} /></button>
          <button className="terminal-action-btn icon" onClick={handleCopy} title={t("term_copy")}><Copy size={13} /></button>
          <button
            className="terminal-action-btn icon"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? t("term_restore") : t("term_expand")}
          >{expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}</button>
        </div>
      </div>

      {showSearch && (
        <div className="terminal-search-bar">
          <Search size={13} className="terminal-search-icon" />
          <input
            ref={searchInputRef}
            className="terminal-search-input"
            placeholder={t("term_search_placeholder")}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              runSearch(e.target.value, true);
            }}
            onKeyDown={handleSearchKey}
          />
          <button className="terminal-search-nav" onClick={() => runSearch(searchTerm, false)} title={t("term_search_prev")}><ChevronUp size={14} /></button>
          <button className="terminal-search-nav" onClick={() => runSearch(searchTerm, true)} title={t("term_search_next")}><ChevronDown size={14} /></button>
          <button className="terminal-search-nav" onClick={closeSearch} title={t("close")}><X size={14} /></button>
        </div>
      )}

      <div className="terminal-inner-content">
        <div ref={terminalRef} className="xterm-view" />
        {!atBottom && (
          <button className="terminal-jump-btn" onClick={jumpToBottom} title={t("term_jump_bottom")}>
            <ArrowDownToLine size={14} /> {t("term_latest")}
          </button>
        )}
      </div>
    </div>
  );
}
