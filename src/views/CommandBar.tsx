import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import type { Asset, TargetAppId } from "../types/asset";
import {
  bumpCopies,
  getForegroundApp,
  injectText,
  listAssets,
  listFavorites,
  listPresets,
  listRecent,
  type Preset,
  recordUsage,
  setFavorite,
} from "../lib/api";
import { appName, TARGET_APPS } from "../lib/apps";
import { renderLoop } from "../lib/render";
import { getSettings } from "../lib/settings";
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
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [autoPaste, setAutoPaste] = useState(true);
  const [presets, setPresets] = useState<Preset[]>([]);
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
      const [assets, favs, recent, settings] = await Promise.all([
        listAssets("loop"),
        listFavorites(),
        listRecent(20),
        getSettings(),
      ]);
      setLoops(assets);
      setFavorites(new Set(favs));
      setRecentIds(recent);
      setAutoPaste(settings.autoPaste);
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

  // Load saved presets for the loop being filled.
  useEffect(() => {
    if (selected && selected.variables.length > 0) {
      void listPresets(selected.id).then(setPresets);
    } else {
      setPresets([]);
    }
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

    const filtered = loops.filter(inScope).filter((a) => {
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

    // Rank: favorites first, then most-recently-used, then the rest by title.
    // When the user is actively typing a term we keep this ordering too so the
    // top hit is the loop they reach for most, not an arbitrary one.
    const recentRank = new Map(recentIds.map((id, i) => [id, i]));
    return filtered.sort((a, b) => {
      const fa = favorites.has(a.id) ? 0 : 1;
      const fb = favorites.has(b.id) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      const ra = recentRank.has(a.id) ? recentRank.get(a.id)! : Infinity;
      const rb = recentRank.has(b.id) ? recentRank.get(b.id)! : Infinity;
      if (ra !== rb) return ra - rb;
      return a.title.localeCompare(b.title);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loops, query, activeApp, favorites, recentIds]);

  useEffect(() => setHighlight(0), [query]);

  const toggleFav = async (a: Asset, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !favorites.has(a.id);
    setFavorites((prev) => {
      const s = new Set(prev);
      if (next) s.add(a.id);
      else s.delete(a.id);
      return s;
    });
    await setFavorite(a.id, next);
  };

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
    await injectText(renderLoop(a, vals), autoPaste);
    void bumpCopies(a.id);
    void recordUsage(a.id, vals);
    await hide();
  };

  // Required variables the user hasn't filled for the loop being previewed.
  const missingRequired = selected
    ? selected.variables
        .filter((v) => v.required && !values[v.name]?.trim())
        .map((v) => v.label || v.name)
    : [];

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
            {presets.length > 0 && (
              <div className="presets presets--compact">
                <span className="presets__label">预设：</span>
                {presets.map((p) => (
                  <button
                    key={p.id}
                    className="btn btn--mini btn--ghost"
                    onClick={() => setValues(p.values)}
                    title={`应用预设「${p.name}」`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            <VariableForm
              variables={selected.variables}
              values={values}
              onChange={setValues}
            />
            {missingRequired.length > 0 && (
              <div className="cmdbar__warn">
                ⚠ 必填：{missingRequired.join("、")}
              </div>
            )}
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
                disabled={missingRequired.length > 0}
              >
                {autoPaste ? "运行 → 自动粘贴" : "运行 → 复制"}
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
                results.map((a, i) => {
                  const isFav = favorites.has(a.id);
                  const isRecent = recentIds.includes(a.id);
                  return (
                    <li
                      key={a.id}
                      className={`cmdbar__item ${
                        i === highlight ? "is-active" : ""
                      }`}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => choose(a)}
                    >
                      <button
                        className={`cmdbar__fav ${isFav ? "is-fav" : ""}`}
                        onClick={(e) => toggleFav(a, e)}
                        title={isFav ? "取消收藏" : "收藏"}
                      >
                        {isFav ? "★" : "☆"}
                      </button>
                      <div className="cmdbar__item-body">
                        <div className="cmdbar__item-main">
                          <span className="cmdbar__item-title">{a.title}</span>
                          {isRecent && !isFav && (
                            <span className="cmdbar__recent">最近</span>
                          )}
                          {a.triggers[0] && (
                            <span className="badge">
                              {a.triggers[0].trigger}
                              {a.triggers[0].keyword}
                            </span>
                          )}
                        </div>
                        {a.description && (
                          <span className="cmdbar__item-desc">
                            {a.description}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
