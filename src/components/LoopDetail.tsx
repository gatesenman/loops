import { useEffect, useState } from "react";
import type { Asset, LoopPayload } from "../types/asset";
import { appName } from "../lib/apps";
import { renderLoop, unfilledPlaceholders } from "../lib/render";
import {
  bumpCopies,
  deletePreset,
  injectText,
  listPresets,
  type Preset,
  recordUsage,
  savePreset,
} from "../lib/api";
import VariableForm from "./VariableForm";
import RunnerPanel from "./RunnerPanel";
import LintPanel from "./LintPanel";
import Markdown from "./Markdown";
import { lintLoop } from "../lib/validate";
import ConfirmDialog from "./ConfirmDialog";
import { showToast } from "./Toast";

// Full loop view: shows the loop's spec, lets the user fill variables, preview
// the rendered output, and inject it (M1 = copy to clipboard).
export default function LoopDetail({
  asset,
  onBack,
  onEdit,
  onDelete,
  autoPaste,
}: {
  asset: Asset;
  onBack: () => void;
  onEdit: (asset: Asset) => void;
  onDelete: (id: string) => void;
  autoPaste?: boolean;
}) {
  const payload = asset.payload as LoopPayload;
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      asset.variables.map((v) => [v.name, v.default ?? ""]),
    ),
  );
  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [showRunner, setShowRunner] = useState(false);

  useEffect(() => {
    if (asset.variables.length > 0) {
      void listPresets(asset.id).then(setPresets);
    }
  }, [asset.id, asset.variables.length]);

  const rendered = renderLoop(asset, values);

  // Dry-run checks: required variables left blank, and any {{placeholder}} the
  // template still contains after substitution (a signal the run will inject an
  // incomplete prompt).
  const missingRequired = asset.variables
    .filter((v) => v.required && !values[v.name]?.trim())
    .map((v) => v.label || v.name);
  const unfilled = unfilledPlaceholders(rendered);
  const lint = lintLoop(asset);

  const onRun = async () => {
    const { pasted } = await injectText(rendered, autoPaste);
    void bumpCopies(asset.id);
    void recordUsage(asset.id, values);
    setCopied(true);
    if (autoPaste && !pasted) {
      showToast("已复制到剪贴板（未能自动粘贴，请手动 Ctrl+V）", "info");
    } else {
      showToast(pasted ? "已粘贴到目标应用" : "已复制到剪贴板");
    }
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="detail">
      <div className="detail__bar">
        <button className="btn btn--ghost" onClick={onBack}>
          ← 返回
        </button>
        <div className="row">
          <button className="btn" onClick={() => onEdit(asset)}>
            编辑
          </button>
          <button
            className="btn btn--danger"
            onClick={() => setConfirmingDelete(true)}
          >
            删除
          </button>
        </div>
      </div>

      <h1>{asset.title}</h1>
      {asset.description && <p className="muted">{asset.description}</p>}

      <div className="detail__meta">
        <span className="badge">{asset.kind}</span>
        <span className={`badge badge--${asset.visibility}`}>
          {asset.visibility}
        </span>
        <span className="badge">
          scope: {asset.scope.appliesTo.map(appName).join(", ")}
        </span>
        {asset.stats.copies > 0 && (
          <span className="badge">已使用 {asset.stats.copies} 次</span>
        )}
        {asset.triggers.map((t) => (
          <span key={t.trigger + t.keyword} className="badge">
            {t.trigger}
            {t.keyword}
          </span>
        ))}
      </div>

      <section>
        <h3>目标</h3>
        <p>{payload.goal || <span className="muted">—</span>}</p>
        <h3>指令</h3>
        <pre className="block">{payload.instructions || "—"}</pre>
        {payload.context && (
          <>
            <h3>前置上下文</h3>
            <p>{payload.context}</p>
          </>
        )}
        {payload.constraints && (
          <>
            <h3>约束 / 禁止事项</h3>
            <pre className="block">{payload.constraints}</pre>
          </>
        )}
        {payload.outputFormat && (
          <>
            <h3>输出格式</h3>
            <p>{payload.outputFormat}</p>
          </>
        )}
        {payload.examples && (
          <>
            <h3>示例</h3>
            <pre className="block">{payload.examples}</pre>
          </>
        )}
        {payload.stopCondition && (
          <>
            <h3>停止条件</h3>
            <p>{payload.stopCondition}</p>
          </>
        )}
        {payload.model && (
          <p className="muted">模型覆写：{payload.model}</p>
        )}
      </section>

      {asset.variables.length > 0 && (
        <section>
          <h3>变量</h3>
          {presets.length > 0 && (
            <div className="presets">
              <span className="presets__label">预设：</span>
              {presets.map((p) => (
                <span key={p.id} className="preset-chip">
                  <button
                    className="btn btn--mini btn--ghost"
                    onClick={() => setValues(p.values)}
                    title={`应用预设「${p.name}」`}
                  >
                    {p.name}
                  </button>
                  <button
                    className="preset-chip__del"
                    onClick={async () => {
                      await deletePreset(p.id);
                      setPresets((prev) => prev.filter((x) => x.id !== p.id));
                      showToast("已删除预设");
                    }}
                    title="删除此预设"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <VariableForm
            variables={asset.variables}
            values={values}
            onChange={setValues}
          />
          <div className="presets__save">
            {savingPreset ? (
              <div className="presets__input-row">
                <input
                  className="input"
                  placeholder="预设名称"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setSavingPreset(false);
                  }}
                />
                <button
                  className="btn btn--mini"
                  disabled={!presetName.trim()}
                  onClick={async () => {
                    const p = await savePreset(asset.id, presetName.trim(), values);
                    setPresets((prev) => [...prev, p]);
                    setSavingPreset(false);
                    setPresetName("");
                    showToast("预设已保存");
                  }}
                >
                  保存
                </button>
                <button
                  className="btn btn--mini btn--ghost"
                  onClick={() => setSavingPreset(false)}
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                className="btn btn--mini btn--ghost"
                onClick={() => setSavingPreset(true)}
              >
                + 保存当前为预设
              </button>
            )}
          </div>
        </section>
      )}

      <section>
        <h3>规范检查</h3>
        <LintPanel report={lint} />
      </section>

      <section>
        <h3>预览</h3>
        {(missingRequired.length > 0 || unfilled.length > 0) && (
          <div className="dryrun-warn">
            {missingRequired.length > 0 && (
              <div>⚠ 必填变量未填写：{missingRequired.join("、")}</div>
            )}
            {unfilled.length > 0 && (
              <div>
                🔶 预览中仍有未替换的占位符：
                {unfilled.map((n) => `{{${n}}}`).join(" ")}
              </div>
            )}
          </div>
        )}
        <div className="block block--preview">
          <Markdown>{rendered}</Markdown>
        </div>
      </section>

      <div className="detail__actions">
        <button
          className="btn btn--primary"
          onClick={onRun}
          disabled={missingRequired.length > 0}
          title={
            missingRequired.length > 0
              ? "请先填写必填变量"
              : undefined
          }
        >
          {copied
            ? (autoPaste ? "已粘贴 ✓" : "已复制到剪贴板 ✓")
            : (autoPaste ? "运行 → 自动粘贴" : "运行 → 复制到剪贴板")}
        </button>
        <button
          className="btn"
          onClick={() => setShowRunner((v) => !v)}
          disabled={missingRequired.length > 0}
          title={
            missingRequired.length > 0
              ? "请先填写必填变量"
              : "在应用内用已配置的 AI 直接执行这个 Loop"
          }
        >
          {showRunner ? "收起试跑" : "▶ 试跑 (AI)"}
        </button>
      </div>

      {showRunner && <RunnerPanel asset={asset} rendered={rendered} />}

      {confirmingDelete && (
        <ConfirmDialog
          title="删除这个 Loop？"
          message={`「${asset.title}」将被永久删除，无法撤销。`}
          confirmLabel="删除"
          danger
          onConfirm={() => {
            setConfirmingDelete(false);
            onDelete(asset.id);
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
