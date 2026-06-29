import { useState } from "react";
import type { Asset, LoopPayload } from "../types/asset";
import { appName } from "../lib/apps";
import { renderLoop } from "../lib/render";
import { bumpCopies, injectText } from "../lib/api";
import VariableForm from "./VariableForm";
import ConfirmDialog from "./ConfirmDialog";
import { showToast } from "./Toast";

// Full loop view: shows the loop's spec, lets the user fill variables, preview
// the rendered output, and inject it (M1 = copy to clipboard).
export default function LoopDetail({
  asset,
  onBack,
  onEdit,
  onDelete,
}: {
  asset: Asset;
  onBack: () => void;
  onEdit: (asset: Asset) => void;
  onDelete: (id: string) => void;
}) {
  const payload = asset.payload as LoopPayload;
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      asset.variables.map((v) => [v.name, v.default ?? ""]),
    ),
  );
  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const rendered = renderLoop(asset, values);

  const onRun = async () => {
    await injectText(rendered);
    void bumpCopies(asset.id);
    setCopied(true);
    showToast("已复制到剪贴板");
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
        {payload.stopCondition && (
          <>
            <h3>停止条件</h3>
            <p>{payload.stopCondition}</p>
          </>
        )}
      </section>

      {asset.variables.length > 0 && (
        <section>
          <h3>变量</h3>
          <VariableForm
            variables={asset.variables}
            values={values}
            onChange={setValues}
          />
        </section>
      )}

      <section>
        <h3>预览</h3>
        <pre className="block block--preview">{rendered}</pre>
      </section>

      <div className="detail__actions">
        <button className="btn btn--primary" onClick={onRun}>
          {copied ? "已复制到剪贴板 ✓" : "运行 → 复制到剪贴板"}
        </button>
      </div>

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
