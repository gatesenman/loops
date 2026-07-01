import { useCallback, useEffect, useMemo, useState } from "react";
import type { Asset, AssetDraft, Visibility } from "../types/asset";
import {
  deleteAsset,
  exportAssets,
  importAssets,
  listAssets,
  listFavorites,
  listRecent,
  saveAsset,
  setFavorite,
} from "../lib/api";
import { emptyLoopDraft, slugify } from "../lib/draft";
import { DISCOVER_LOOPS, discoverToDraft } from "../lib/discover";
import LoopCard from "../components/LoopCard";
import DiscoverCard from "../components/DiscoverCard";
import LoopEditor from "../components/LoopEditor";
import LoopWizard from "../components/LoopWizard";
import LoopDetail from "../components/LoopDetail";
import SettingsView from "../components/SettingsView";
import ToastContainer, { showToast } from "../components/Toast";
import {
  IconCompass,
  IconLayers,
  IconPlus,
  IconSearch,
  IconSettings,
  Logo,
} from "../components/icons";
import {
  applyAccent,
  DEFAULT_SETTINGS,
  getSettings,
  type AppSettings,
} from "../lib/settings";

type Mode =
  | { name: "list" }
  | { name: "wizard" }
  | { name: "edit"; draft: AssetDraft }
  | { name: "detail"; asset: Asset };

type Tab = "library" | "discover" | "settings";
type VisFilter = "all" | Visibility;

const VIS_FILTERS: { id: VisFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "private", label: "私有" },
  { id: "unlisted", label: "未公开" },
  { id: "public", label: "公开" },
];

// The main window, framed as a native-style desktop app: a fixed left sidebar
// for navigation, a top toolbar (title / search / actions), a scrolling content
// area, and a bottom status bar. The detail / wizard / editor views render
// inside the content area so the app frame stays consistent.
export default function LibraryApp() {
  const [loops, setLoops] = useState<Asset[]>([]);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>({ name: "list" });
  const [tab, setTab] = useState<Tab>("library");
  const [visFilter, setVisFilter] = useState<VisFilter>("all");
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [recentIds, setRecentIds] = useState<string[]>([]);
  type SortMode = "updated" | "recent" | "favorites";
  const [sortMode, setSortMode] = useState<SortMode>("updated");

  useEffect(() => {
    void getSettings().then((s) => {
      setSettings(s);
      applyAccent(s.accent);
    });
  }, []);

  const refreshMeta = useCallback(async () => {
    const [favs, recent] = await Promise.all([listFavorites(), listRecent(20)]);
    setFavIds(new Set(favs));
    setRecentIds(recent);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [assets] = await Promise.all([listAssets("loop"), refreshMeta()]);
      setLoops(assets);
    } finally {
      setLoading(false);
    }
  }, [refreshMeta]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onSave = async (draft: AssetDraft) => {
    await saveAsset(draft);
    await refresh();
    setMode({ name: "list" });
    showToast(draft.id ? "Loop 已更新" : "Loop 已保存");
  };

  const onDelete = async (id: string) => {
    await deleteAsset(id);
    await refresh();
    setMode({ name: "list" });
    showToast("已删除", "info");
  };

  // Flip a loop's visibility between private and public (quick publish toggle).
  const togglePublish = async (asset: Asset) => {
    const visibility: Visibility =
      asset.visibility === "public" ? "private" : "public";
    await saveAsset({ ...asset, visibility });
    await refresh();
    showToast(visibility === "public" ? "已发布" : "已设为私有");
  };

  // Clone an existing loop into a new local draft and persist it.
  const duplicate = async (asset: Asset) => {
    const draft: AssetDraft = {
      kind: asset.kind,
      title: `${asset.title} 副本`,
      slug: slugify(`${asset.title}-copy`),
      description: asset.description ?? "",
      category: asset.category ?? "",
      tags: [...asset.tags],
      visibility: "private",
      version: asset.version,
      variables: asset.variables.map((v) => ({ ...v, options: [...v.options] })),
      // Drop trigger keywords on copy to avoid clashing with the original.
      triggers: [],
      scope: { appliesTo: [...asset.scope.appliesTo] },
      payload: { ...(asset.payload as Record<string, unknown>) },
    };
    await saveAsset(draft);
    await refresh();
    showToast("已复制");
  };

  // Import a platform loop into the local library, then jump to it.
  const importDiscover = async (asset: Asset) => {
    await saveAsset(discoverToDraft(asset));
    await refresh();
    setTab("library");
    showToast("已导入到我的库");
  };

  // Start a brand-new draft honoring the configured default visibility.
  const newDraft = (): AssetDraft => ({
    ...emptyLoopDraft(),
    visibility: settings.defaultVisibility,
  });

  const importedSlugs = useMemo(
    () => new Set(loops.map((l) => l.slug)),
    [loops],
  );

  const filtered = useMemo(() => {
    let result = loops.filter((l) => {
      if (visFilter !== "all" && l.visibility !== visFilter) return false;
      const q = query.toLowerCase();
      if (!q) return true;
      return (
        l.title.toLowerCase().includes(q) ||
        (l.description ?? "").toLowerCase().includes(q) ||
        l.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
    if (sortMode === "favorites") {
      result = [...result].sort((a, b) => {
        const af = favIds.has(a.id) ? 1 : 0;
        const bf = favIds.has(b.id) ? 1 : 0;
        return bf - af;
      });
    } else if (sortMode === "recent") {
      const order = new Map(recentIds.map((id, i) => [id, i]));
      result = [...result].sort((a, b) => {
        const ai = order.get(a.id) ?? 9999;
        const bi = order.get(b.id) ?? 9999;
        return ai - bi;
      });
    }
    return result;
  }, [loops, query, visFilter, sortMode, favIds, recentIds]);

  const discoverFiltered = useMemo(() => DISCOVER_LOOPS.filter((l) => {
    const q = query.toLowerCase();
    if (!q) return true;
    return (
      l.title.toLowerCase().includes(q) ||
      (l.description ?? "").toLowerCase().includes(q) ||
      l.tags.some((t) => t.toLowerCase().includes(q))
    );
  }), [query]);

  const goList = (t?: Tab) => {
    if (t) setTab(t);
    setMode({ name: "list" });
  };

  // ----- content area (switches by mode) -----
  let body: React.ReactNode;
  if (mode.name === "wizard") {
    body = (
      <LoopWizard
        existing={loops}
        defaultVisibility={settings.defaultVisibility}
        aiSettings={settings.ai}
        onCancel={() => goList()}
        onSave={onSave}
      />
    );
  } else if (mode.name === "edit") {
    body = (
      <LoopEditor draft={mode.draft} onCancel={() => goList()} onSave={onSave} />
    );
  } else if (mode.name === "detail") {
    body = (
      <LoopDetail
        asset={mode.asset}
        onBack={() => goList()}
        onEdit={(a) => setMode({ name: "edit", draft: a as AssetDraft })}
        onDelete={onDelete}
        autoPaste={settings.autoPaste}
      />
    );
  } else if (tab === "library") {
    body = (
      <>
        <div className="library__filters">
          <div className="segmented">
            {VIS_FILTERS.map((f) => (
              <button
                key={f.id}
                className={`segmented__item ${
                  visFilter === f.id ? "is-active" : ""
                }`}
                onClick={() => setVisFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="segmented segmented--sort">
            {([
              ["updated", "最新"],
              ["recent", "最近使用"],
              ["favorites", "收藏优先"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                className={`segmented__item ${sortMode === id ? "is-active" : ""}`}
                onClick={() => setSortMode(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card skeleton-card">
                <div className="skeleton skeleton--line" style={{ width: "60%" }} />
                <div className="skeleton skeleton--line" />
                <div className="skeleton skeleton--line" style={{ width: "40%" }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <p>{loops.length === 0 ? "还没有 Loop。" : "没有匹配的 Loop。"}</p>
            <button className="btn" onClick={() => setMode({ name: "wizard" })}>
              创建第一个 Loop
            </button>
          </div>
        ) : (
          <div className="grid">
            {filtered.map((loop) => (
              <LoopCard
                key={loop.id}
                asset={loop}
                onOpen={() => setMode({ name: "detail", asset: loop })}
                onTogglePublish={() => togglePublish(loop)}
                onDuplicate={() => duplicate(loop)}
                isFavorite={favIds.has(loop.id)}
                onToggleFavorite={async () => {
                  const next = !favIds.has(loop.id);
                  await setFavorite(loop.id, next);
                  setFavIds((prev) => {
                    const s = new Set(prev);
                    next ? s.add(loop.id) : s.delete(loop.id);
                    return s;
                  });
                  showToast(next ? "已收藏" : "已取消收藏");
                }}
              />
            ))}
          </div>
        )}
      </>
    );
  } else if (tab === "settings") {
    body = (
      <SettingsView
        settings={settings}
        onChange={setSettings}
        onCleared={() => void refresh()}
      />
    );
  } else {
    body = (
      <>
        <p className="muted discover__hint">
          平台精选 Loop。点「导入」即可复制到你的本地库再自由编辑。
        </p>
        {discoverFiltered.length === 0 ? (
          <div className="empty">
            <p>没有匹配的平台 Loop。</p>
          </div>
        ) : (
          <div className="grid">
            {discoverFiltered.map((loop) => (
              <DiscoverCard
                key={loop.id}
                asset={loop}
                imported={importedSlugs.has(loop.slug)}
                onImport={() => importDiscover(loop)}
              />
            ))}
          </div>
        )}
      </>
    );
  }

  const isList = mode.name === "list";
  const sectionTitle =
    mode.name === "wizard"
      ? "新建 Loop"
      : mode.name === "edit"
        ? "编辑 Loop"
        : mode.name === "detail"
          ? "Loop 详情"
          : tab === "library"
            ? "我的库"
            : tab === "discover"
              ? "探索"
              : "设置";

  const publicCount = loops.filter((l) => l.visibility === "public").length;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__logo">
            <Logo size={26} />
          </span>
          <span className="sidebar__wordmark">Loops</span>
        </div>

        <nav className="sidebar__nav">
          <button
            className={`navitem ${isList && tab === "library" ? "is-active" : ""}`}
            onClick={() => goList("library")}
          >
            <span className="navitem__icon">
              <IconLayers />
            </span>
            <span className="navitem__label">我的库</span>
            <span className="navitem__count">{loops.length}</span>
          </button>
          <button
            className={`navitem ${isList && tab === "discover" ? "is-active" : ""}`}
            onClick={() => goList("discover")}
          >
            <span className="navitem__icon">
              <IconCompass />
            </span>
            <span className="navitem__label">探索</span>
          </button>
          <button
            className={`navitem ${isList && tab === "settings" ? "is-active" : ""}`}
            onClick={() => goList("settings")}
          >
            <span className="navitem__icon">
              <IconSettings />
            </span>
            <span className="navitem__label">设置</span>
          </button>
        </nav>

        <div className="sidebar__spacer" />

        <button
          className="btn btn--primary sidebar__new"
          onClick={() => setMode({ name: "wizard" })}
        >
          <IconPlus /> 新建 Loop
        </button>
        <div className="sidebar__hint">
          {settings.hotkey.split("+").map((k, i) => (
            <span key={k}>{i > 0 && "+"}<kbd>{k}</kbd></span>
          ))}{" "}唤起命令栏
        </div>
      </aside>

      <main className="main">
        <header className="toolbar">
          <h1 className="toolbar__title">{sectionTitle}</h1>
          {isList && tab !== "settings" && (
            <>
              <div className="toolbar__search">
                <IconSearch />
                <input
                  placeholder={
                    tab === "library" ? "搜索本地 Loop…" : "搜索平台 Loop…"
                  }
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="toolbar__actions">
                {tab === "library" && (
                  <>
                    <button
                      className="btn"
                      onClick={async () => {
                        try {
                          const msg = await importAssets();
                          await refresh();
                          showToast(msg);
                        } catch (e) {
                          if (String(e) !== "cancelled") showToast(String(e), "error");
                        }
                      }}
                    >
                      导入
                    </button>
                    <button
                      className="btn"
                      onClick={async () => {
                        try {
                          const msg = await exportAssets();
                          showToast(msg);
                        } catch (e) {
                          if (String(e) !== "cancelled") showToast(String(e), "error");
                        }
                      }}
                      disabled={loops.length === 0}
                    >
                      导出
                    </button>
                  </>
                )}
                <button
                  className="btn"
                  onClick={() => setMode({ name: "edit", draft: newDraft() })}
                >
                  高级编辑
                </button>
              </div>
            </>
          )}
        </header>

        <div className="main__body">{body}</div>

        <footer className="statusbar">
          <span>{loops.length} 个 Loop</span>
          <span className="statusbar__dot">·</span>
          <span>{publicCount} 个已公开</span>
          <span className="sidebar__spacer" />
          <span className="statusbar__muted">本地存储 · SQLite</span>
        </footer>
      </main>
      <ToastContainer />
    </div>
  );
}
