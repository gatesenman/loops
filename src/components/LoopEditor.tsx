import { useMemo, useState } from "react";
import type {
  Asset,
  AssetDraft,
  LoopPayload,
  TargetAppId,
  Visibility,
} from "../types/asset";
import { TARGET_APPS } from "../lib/apps";
import { slugify } from "../lib/draft";
import { extractVariables, lintLoop } from "../lib/validate";
import LintPanel from "./LintPanel";

// Create/edit form for a Loop. Builds an AssetDraft and hands it to onSave; the
// backend assigns id/timestamps for new loops.
export default function LoopEditor({
  draft,
  existing = [],
  onSave,
  onCancel,
}: {
  draft: AssetDraft;
  existing?: Asset[];
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

  // Any {{placeholder}} typed into goal/instructions that isn't declared yet
  // gets auto-declared as a text variable on save (the editor has no separate
  // variable form), so lint over the draft as it will actually be saved.
  const withAutoVars = (draft: AssetDraft): AssetDraft => {
    const declared = new Set(draft.variables.map((v) => v.name));
    const auto = extractVariables(draft)
      .filter((n) => !declared.has(n))
      .map((n) => ({
        name: n,
        label: n,
        type: "text" as const,
        required: false,
        default: "",
        options: [],
      }));
    return auto.length
      ? { ...draft, variables: [...draft.variables, ...auto] }
      : draft;
  };

  // Live standardness/completeness check over the draft as currently typed
  // (tags live in a local text field until save, so merge them in).
  const lint = useMemo(
    () =>
      lintLoop(
        withAutoVars({
          ...d,
          tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
        }),
        existing,
      ),
    [d, tagsText, existing],
  );

  const canSave = d.title.trim().length > 0 && lint.fails === 0 && !saving;

  const submit = async () => {
    setSaving(true);
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      onSave(
        withAutoVars({
          ...d,
          title: d.title.trim(),
          slug: d.slug.trim() || slugify(d.title),
          tags,
        }),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="editor">
      <div className="detail__bar">
        <button className="btn btn--ghost" onClick={onCancel}>
          ← 取消
        </button>
        <button className="btn btn--primary" disabled={!canSave} onClick={submit}>
          保存 Loop
        </button>
      </div>

      <h1>{draft.id ? "编辑 Loop" : "新建 Loop"}</h1>

      <LintPanel report={lint} />

      <label className="field">
        <span className="field__label">标题*</span>
        <input
          value={d.title}
          onChange={(e) => setD({ ...d, title: e.target.value })}
          placeholder="例如：修复失败测试直到通过"
        />
      </label>

      <label className="field">
        <span className="field__label">描述</span>
        <input
          value={d.description ?? ""}
          onChange={(e) => setD({ ...d, description: e.target.value })}
        />
      </label>

      <div className="row">
        <label className="field">
          <span className="field__label">可见性</span>
          <select
            value={d.visibility}
            onChange={(e) =>
              setD({ ...d, visibility: e.target.value as Visibility })
            }
          >
            <option value="private">私有</option>
            <option value="unlisted">未公开</option>
            <option value="public">公开</option>
          </select>
        </label>
        <label className="field">
          <span className="field__label">标签（逗号分隔）</span>
          <input
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="testing, ci"
          />
        </label>
      </div>

      <label className="field">
        <span className="field__label">目标 Goal</span>
        <textarea
          rows={2}
          value={payload.goal}
          onChange={(e) => setPayload({ goal: e.target.value })}
          placeholder="这个 Loop 要达成什么？可用 {{variable}} 占位。"
        />
      </label>

      <label className="field">
        <span className="field__label">指令 Instructions</span>
        <textarea
          rows={6}
          value={payload.instructions}
          onChange={(e) => setPayload({ instructions: e.target.value })}
          placeholder="一步步告诉 AI 怎么做。用 {{variable}} 表示运行时再填的内容。"
        />
      </label>

      <div className="row">
        <label className="field">
          <span className="field__label">停止条件</span>
          <input
            value={payload.stopCondition ?? ""}
            onChange={(e) => setPayload({ stopCondition: e.target.value })}
            placeholder="例如：所有测试通过"
          />
        </label>
        <label className="field field--narrow">
          <span className="field__label">最大迭代</span>
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
        <legend>高级 Prompt 工程</legend>
        <label className="field">
          <span className="field__label">输出格式</span>
          <input
            value={payload.outputFormat ?? ""}
            onChange={(e) => setPayload({ outputFormat: e.target.value })}
            placeholder="例如：markdown 列表 / 纯 JSON / 只输出代码，不要解释"
          />
        </label>
        <label className="field">
          <span className="field__label">约束 / 禁止事项</span>
          <textarea
            rows={2}
            value={payload.constraints ?? ""}
            onChange={(e) => setPayload({ constraints: e.target.value })}
            placeholder="AI 不得做什么？例如：不要修改测试文件；不要引入新依赖"
          />
        </label>
        <label className="field">
          <span className="field__label">前置上下文</span>
          <textarea
            rows={2}
            value={payload.context ?? ""}
            onChange={(e) => setPayload({ context: e.target.value })}
            placeholder="运行前需要提供什么？例如：选中的代码 / 失败的测试日志 / git diff"
          />
        </label>
        <label className="field">
          <span className="field__label">示例（few-shot）</span>
          <textarea
            rows={3}
            value={payload.examples ?? ""}
            onChange={(e) => setPayload({ examples: e.target.value })}
            placeholder={"输入：…\n输出：…（给 AI 看的范例，提升稳定性）"}
          />
        </label>
        <label className="field field--narrow">
          <span className="field__label">模型覆写</span>
          <input
            value={payload.model ?? ""}
            onChange={(e) => setPayload({ model: e.target.value })}
            placeholder="留空用全局设置，如 gpt-4o / deepseek-reasoner"
          />
        </label>
      </fieldset>

      <fieldset className="fieldset">
        <legend>斜杠命令</legend>
        <p className="muted">在命令栏输入 <code>/</code> 加关键词即可唤起此 Loop。</p>
        <div className="row trigger-row">
          <span className="trigger-fixed">/</span>
          <input
            placeholder="关键词（例如 fixtests）"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend>适用应用</legend>
        <div className="chips">
          <label className="chip">
            <input
              type="checkbox"
              checked={d.scope.appliesTo.includes("all")}
              onChange={() => toggleScope("all")}
            />
            全部应用
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
