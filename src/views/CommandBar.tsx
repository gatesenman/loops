import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import type { Asset, TargetAppId } from "../types/asset";
import { bumpCopies, getForegroundApp, injectText, listAssets } from "../lib/api";
import { appName, TARGET_APPS } from "../lib/apps";
import { renderLoop } from "../lib/render";
import VariableForm from "../components/VariableForm";

// The hotkey-summoned command bar. Type to filter loops; a leading trigger
// char (/ @ # !) matches trigger bindings. Selecting a loop fills its
// variables (if any) and injects the rendered text into the target app.
export default function CommandBar() {
  const [loops, setLoops] = useState<Asset[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Asset | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [activeApp, setActiveApp] = useState<TargetAppId>("all");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Make the popup behave like an input-method candidate window: the webview
  // background is transparent and the OS window auto-shrinks to fit the rounded
  // box, so there's never a tall empty glass panel.
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    const el = rootRef.current;
    if (!el) return;
    const win = getCurrentWindow();
    const fit = () => {
      const r = el.getBoundingClientRect();
      void win.setSize(
        new LogicalSize(Math.ceil(r.width), Math.ceil(r.height)),
      );
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoops(await listAssets("loop"));
      const fg = await getForegroundApp();
      if (fg) setActiveApp(fg.id as TargetAppId);
    };
    void load();
    // The command-bar window is created once and re-shown via the hotkey, so
    // reload the library each time it regains focus to pick up new/edited loops.
    const unlisten = getCurrentWindow().onFocusChanged(({ payload }) => {
      if (payload) {
        void load();
      } else {
        // IME-like dismissal: clicking away / switching apps hides the popup.
        void hide();
      }
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refocus the input whenever the bar returns to the list view.
  useEffect(() => {
    if (!selected) inputRef.current?.focus();
  }, [selected]);

  const hide = async () => {
    setQuery("");
    setSelected(null);
    await getCurrentWindow().hide();
  };

  const inScope = (a: Asset) =>
    a.scope.appliesTo.includes("all") ||
    activeApp === "all" ||
    a.scope.appliesTo.includes(activeApp);

  const results = useMemo(() => {
    const trimmed = query.trim();
    const triggerChar = ["/", "@", "#", "!"].includes(trimmed[0])
      ? trimmed[0]
      : null;
    const term = (triggerChar ? trimmed.slice(1) : trimmed).toLowerCase();

    return loops.filter(inScope).filter((a) => {
      if (triggerChar) {
        return a.triggers.some(
          (t) =>
            t.trigger === triggerChar &&
            t.keyword.toLowerCase().includes(term),
        );
      }
      if (!term) return true;
      return (
        a.title.toLowerCase().includes(term) ||
        a.tags.some((t) => t.toLowerCase().includes(term))
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loops, query, activeApp]);

  useEffect(() => setHighlight(0), [query]);

  const choose = (a: Asset) => {
    if (a.variables.length > 0) {
      setSelected(a);
      setValues(
        Object.fromEntries(a.variables.map((v) => [v.name, v.default ?? ""])),
      );
    } else {
      void run(a, {});
    }
  };

  const run = async (a: Asset, vals: Record<string, string>) => {
    await injectText(renderLoop(a, vals));
    void bumpCopies(a.id);
    await hide();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      void hide();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && results[highlight]) {
      e.preventDefault();
      choose(results[highlight]);
    }
  };

  return (
    <div className="cmdbar-root" ref={rootRef}>
      <div className="cmdbar">
        {selected ? (
          <div className="cmdbar__fill" data-tauri-drag-region>
            <h3>{selected.title}</h3>
            <VariableForm
              variables={selected.variables}
              values={values}
              onChange={setValues}
            />
            <div className="row">
              <button
                className="btn btn--ghost"
                onClick={() => setSelected(null)}
              >
                返回
              </button>
              <button
                className="btn btn--primary"
                onClick={() => run(selected, values)}
              >
                运行 → 注入
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="cmdbar__input-row" data-tauri-drag-region>
              <input
                ref={inputRef}
                className="cmdbar__input"
                autoFocus
                placeholder="搜索 Loop，或输入 / 唤起斜杠命令…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
              />
              <select
                className="cmdbar__app"
                value={activeApp}
                onChange={(e) => setActiveApp(e.target.value as TargetAppId)}
                title="Target app (scope filter)"
              >
                <option value="all">{appName("all")}</option>
                {TARGET_APPS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.displayName}
                  </option>
                ))}
              </select>
            </div>

            <ul className="cmdbar__list">
              {results.length === 0 ? (
                <li className="cmdbar__empty">没有匹配的 Loop</li>
              ) : (
                results.map((a, i) => (
                  <li
                    key={a.id}
                    className={`cmdbar__item ${
                      i === highlight ? "is-active" : ""
                    }`}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => choose(a)}
                  >
                    <div className="cmdbar__item-main">
                      <span className="cmdbar__item-title">{a.title}</span>
                      {a.triggers[0] && (
                        <span className="badge">
                          {a.triggers[0].trigger}
                          {a.triggers[0].keyword}
                        </span>
                      )}
                    </div>
                    {a.description && (
                      <span className="cmdbar__item-desc">{a.description}</span>
                    )}
                  </li>
                ))
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
