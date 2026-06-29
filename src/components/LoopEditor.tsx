import { useState } from "react";
import type {
  AssetDraft,
  LoopPayload,
  TargetAppId,
  Visibility,
} from "../types/asset";
import { TARGET_APPS } from "../lib/apps";
import { slugify } from "../lib/draft";

// Create/edit form for a Loop. Builds an AssetDraft and hands it to onSave; the
// backend assigns id/timestamps for new loops.
export default function LoopEditor({
  draft,
  onSave,
  onCancel,
}: {
  draft: AssetDraft;
  onSave: (draft: AssetDraft) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState<AssetDraft>(draft);
  const payload = d.payload as LoopPayload;
  const [tagsText, setTagsText] = useState(draft.tags.join(", "));
  const [saving, setSaving] = useState(false);

  const setPayload = (patch: Partial<LoopPayload>) =>
    setD({ ...d, payload: { ...payload, ...patch } });

  // Loops use the "/" slash command exclusively, so only the keyword is
  // editable here; the trigger char is fixed to "/".
  const keyword = d.triggers[0]?.keyword ?? "";
  const setKeyword = (kw: string) =>
    setD({
      ...d,
      triggers: kw.trim() ? [{ trigger: "/", keyword: kw.trim() }] : [],
    });

  const toggleScope = (id: TargetAppId) => {
    const current = d.scope.appliesTo;
    if (id === "all") {
      setD({ ...d, scope: { appliesTo: ["all"] } });
      return;
    }
    const withoutAll = current.filter((x) => x !== "all");
    const next = withoutAll.includes(id)
      ? withoutAll.filter((x) => x !== id)
      : [...withoutAll, id];
    setD({ ...d, scope: { appliesTo: next.length ? next : ["all"] } });
  };

  const canSave = d.title.trim().length > 0 && !saving;

  const submit = async () => {
    setSaving(true);
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      onSave({
        ...d,
        title: d.title.trim(),
        slug: d.slug.trim() || slugify(d.title),
        tags,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="editor">
      <div className="detail__bar">
        <button className="btn btn--ghost" onClick={onCancel}>
          ← Cancel
        </button>
        <button className="btn btn--primary" disabled={!canSave} onClick={submit}>
          Save loop
        </button>
      </div>

      <h1>{draft.id ? "Edit loop" : "New loop"}</h1>

      <label className="field">
        <span className="field__label">Title*</span>
        <input
          value={d.title}
          onChange={(e) => setD({ ...d, title: e.target.value })}
          placeholder="e.g. Fix failing tests until green"
        />
      </label>

      <label className="field">
        <span className="field__label">Description</span>
        <input
          value={d.description ?? ""}
          onChange={(e) => setD({ ...d, description: e.target.value })}
        />
      </label>

      <div className="row">
        <label className="field">
          <span className="field__label">Visibility</span>
          <select
            value={d.visibility}
            onChange={(e) =>
              setD({ ...d, visibility: e.target.value as Visibility })
            }
          >
            <option value="private">private</option>
            <option value="unlisted">unlisted</option>
            <option value="public">public</option>
          </select>
        </label>
        <label className="field">
          <span className="field__label">Tags (comma separated)</span>
          <input
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="testing, ci"
          />
        </label>
      </div>

      <label className="field">
        <span className="field__label">Goal</span>
        <textarea
          rows={2}
          value={payload.goal}
          onChange={(e) => setPayload({ goal: e.target.value })}
          placeholder="What should the loop accomplish?"
        />
      </label>

      <label className="field">
        <span className="field__label">Instructions</span>
        <textarea
          rows={6}
          value={payload.instructions}
          onChange={(e) => setPayload({ instructions: e.target.value })}
          placeholder="Step-by-step instruction the agent repeats. Use {{variable}} for quick input."
        />
      </label>

      <div className="row">
        <label className="field">
          <span className="field__label">Stop condition</span>
          <input
            value={payload.stopCondition ?? ""}
            onChange={(e) => setPayload({ stopCondition: e.target.value })}
            placeholder="e.g. all tests pass"
          />
        </label>
        <label className="field field--narrow">
          <span className="field__label">Max iterations</span>
          <input
            type="number"
            value={payload.maxIterations ?? 10}
            onChange={(e) =>
              setPayload({ maxIterations: Number(e.target.value) })
            }
          />
        </label>
      </div>

      <fieldset className="fieldset">
        <legend>Slash command</legend>
        <p className="muted">Loops are invoked with the "/" slash command.</p>
        <div className="row trigger-row">
          <span className="trigger-fixed">/</span>
          <input
            placeholder="keyword (e.g. fixtests)"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend>Applies to (scope)</legend>
        <div className="chips">
          <label className="chip">
            <input
              type="checkbox"
              checked={d.scope.appliesTo.includes("all")}
              onChange={() => toggleScope("all")}
            />
            All apps
          </label>
          {TARGET_APPS.map((app) => (
            <label key={app.id} className="chip">
              <input
                type="checkbox"
                checked={d.scope.appliesTo.includes(app.id)}
                onChange={() => toggleScope(app.id)}
              />
              {app.displayName}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
