import { useMemo, useState } from "react";
import type { AssetDraft, LoopPayload } from "../types/asset";
import { fetchFabricPattern, fetchFabricPatterns } from "../lib/api";
import { slugify } from "../lib/draft";
import { showToast } from "./Toast";

// Online import of prompt patterns from github.com/danielmiessler/fabric.
// Each pattern directory ships a system.md prompt; importing converts it into
// a local loop whose instructions are the pattern text.
function patternToDraft(name: string, systemMd: string): AssetDraft {
  return {
    kind: "loop",
    title: name.replace(/_/g, " "),
    slug: slugify(name),
    description: `从 Fabric 导入的 pattern「${name}」`,
    category: "fabric",
    tags: ["fabric"],
    visibility: "private",
    version: "1.0.0",
    variables: [],
    triggers: [],
    scope: { appliesTo: ["all"] },
    payload: {
      goal: `执行 Fabric pattern：${name.replace(/_/g, " ")}`,
      instructions: systemMd.trim(),
      stopCondition: "",
      maxIterations: 3,
    } as LoopPayload,
  };
}

export default function FabricImport({
  importedSlugs,
  onImport,
}: {
  importedSlugs: Set<string>;
  onImport: (draft: AssetDraft) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [patterns, setPatterns] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    setOpen(true);
    if (patterns.length > 0) return;
    setLoading(true);
    setError("");
    try {
      setPatterns(await fetchFabricPatterns());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(
    () =>
      patterns.filter((p) =>
        p.toLowerCase().includes(filter.trim().toLowerCase()),
      ),
    [patterns, filter],
  );

  const importOne = async (name: string) => {
    setBusy(name);
    try {
      const md = await fetchFabricPattern(name);
      await onImport(patternToDraft(name, md));
      showToast(`已导入 Fabric pattern「${name}」`);
    } catch (e) {
      showToast(String(e), "error");
    } finally {
      setBusy(null);
    }
  };

  if (!open) {
    return (
      <div className="fabric">
        <button className="btn" onClick={load}>
          🧵 从 Fabric 导入 patterns（GitHub）
        </button>
        <span className="muted fabric__hint">
          danielmiessler/fabric 社区提示词库，200+ 精选 patterns
        </span>
      </div>
    );
  }

  return (
    <div className="fabric fabric--open">
      <div className="fabric__head">
        <span className="fabric__title">🧵 Fabric patterns</span>
        <input
          className="input"
          placeholder="筛选 pattern…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button className="btn btn--mini btn--ghost" onClick={() => setOpen(false)}>
          收起
        </button>
      </div>
      {loading && <p className="muted">正在从 GitHub 拉取 patterns 列表…</p>}
      {error && <div className="dryrun-warn">⚠ {error}</div>}
      {!loading && !error && (
        <div className="fabric__list">
          {filtered.map((name) => {
            const imported = importedSlugs.has(slugify(name));
            return (
              <div key={name} className="fabric__item">
                <span className="fabric__name">{name}</span>
                <button
                  className="btn btn--mini"
                  disabled={imported || busy !== null}
                  onClick={() => importOne(name)}
                >
                  {imported ? "已导入" : busy === name ? "导入中…" : "导入"}
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="muted">没有匹配的 pattern。</p>}
        </div>
      )}
    </div>
  );
}
