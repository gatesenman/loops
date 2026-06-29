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
import { LOOP_TEMPLATES, templateToDraft } from "../lib/templates";
import { dryRunLoop, validateLoopDraft } from "../lib/validate";
import { TemplateIcon } from "./icons";

const STEPS = ["选择模板", "填写内容", "触发与范围", "校验与测试"];

// Beginner-friendly, step-by-step flow to create a Loop from a preset template,
// then validate and test (preview) it before saving. Loops use the "/" slash
// command exclusively, so the trigger char is fixed here.
export default function LoopWizard({
  existing,
  defaultVisibility = "private",
  onSave,
  onCancel,
}: {
  existing: Asset[];
  defaultVisibility?: Visibility;
  onSave: (draft: AssetDraft) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<AssetDraft>(() => ({
    ...templateToDraft(LOOP_TEMPLATES[0]),
    visibility: defaultVisibility,
  }));
  const [pickedId, setPickedId] = useState(LOOP_TEMPLATES[0].id);
  const [testValues, setTestValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const payload = d.payload as LoopPayload;
  const setPayload = (patch: Partial<LoopPayload>) =>
    setD({ ...d, payload: { ...payload, ...patch } });

  const keyword = d.triggers[0]?.keyword ?? "";
  const setKeyword = (kw: string) =>
    setD({
      ...d,
      triggers: kw.trim() ? [{ trigger: "/", keyword: kw.trim() }] : [],
    });

  const pickTemplate = (id: string) => {
    const t = LOOP_TEMPLATES.find((x) => x.id === id) ?? LOOP_TEMPLATES[0];
    setPickedId(id);
    const draft = { ...templateToDraft(t), visibility: defaultVisibility };
    setD(draft);
    setTestValues(
      Object.fromEntries(draft.variables.map((v) => [v.name, v.default ?? ""])),
    );
  };

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

  const result = useMemo(
    () => validateLoopDraft(d, existing),
    [d, existing],
  );
  const preview = useMemo(
    () => dryRunLoop(d, testValues),
    [d, testValues],
  );

  const canNext = () => {
    if (step === 1) return d.title.trim() && payload.goal.trim() && payload.instructions.trim();
    return true;
  };

  const finish = () => {
    if (result.errors.length) return;
    setSaving(true);
    try {
      onSave({
        ...d,
        title: d.title.trim(),
        slug: d.slug.trim() || slugify(d.title),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wizard">
      <div className="detail__bar">
        <button className="btn btn--ghost" onClick={onCancel}>
          ← 取消
        </button>
        <div className="wizard__steps">
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={
                "wizard__step" +
                (i === step ? " is-active" : "") +
                (i < step ? " is-done" : "")
              }
            >
              {i + 1}. {label}
            </span>
          ))}
        </div>
      </div>

      {step === 0 && (
        <section className="wizard__body">
          <h1>选择一个模板</h1>
          <p className="muted">
            挑一个最接近你需求的模板快速开始，下一步可随意修改。Loop 通过{" "}
            <code>/</code> 斜杠命令唤起。
          </p>
          <div className="tpl-grid">
            {LOOP_TEMPLATES.map((t) => (
              <button
                key={t.id}
                className={
                  "tpl-card" + (pickedId === t.id ? " is-picked" : "")
                }
                onClick={() => pickTemplate(t.id)}
              >
                <span className="tpl-card__icon">
                  <TemplateIcon name={t.icon} />
                </span>
                <span className="tpl-card__name">{t.name}</span>
                <span className="tpl-card__desc">{t.description}</span>
                {t.triggerKeyword && (
                  <span className="badge badge--trigger">
                    /{t.triggerKeyword}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="wizard__body">
          <h1>填写内容</h1>
          <label className="field">
            <span className="field__label">标题*</span>
            <input
              value={d.title}
              onChange={(e) => setD({ ...d, title: e.target.value })}
              placeholder="例如：修复失败测试直到通过"
            />
          </label>
          <label className="field">
            <span className="field__label">目标 Goal*</span>
            <textarea
              rows={2}
              value={payload.goal}
              onChange={(e) => setPayload({ goal: e.target.value })}
              placeholder="这个 Loop 要达成什么？可用 {{变量}} 占位。"
            />
          </label>
          <label className="field">
            <span className="field__label">指令 Instructions*</span>
            <textarea
              rows={6}
              value={payload.instructions}
              onChange={(e) => setPayload({ instructions: e.target.value })}
              placeholder="一步步告诉 AI 怎么做。用 {{变量}} 表示运行时再填的内容。"
            />
          </label>
          <div className="row">
            <label className="field">
              <span className="field__label">停止条件 Stop when</span>
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
                min={1}
                value={payload.maxIterations ?? 10}
                onChange={(e) =>
                  setPayload({ maxIterations: Number(e.target.value) })
                }
              />
            </label>
          </div>
          {d.variables.length > 0 && (
            <p className="muted">
              该模板包含变量：
              {d.variables.map((v) => (
                <code key={v.name} style={{ marginLeft: 6 }}>
                  {`{{${v.name}}}`}
                </code>
              ))}
              。运行时会提示你填写。
            </p>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="wizard__body">
          <h1>触发与适用范围</h1>
          <fieldset className="fieldset">
            <legend>斜杠命令</legend>
            <p className="muted">
              在命令栏输入 <code>/</code> 加下面的关键词即可唤起此 Loop。
            </p>
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
        </section>
      )}

      {step === 3 && (
        <section className="wizard__body">
          <h1>校验与测试</h1>

          {result.errors.length === 0 ? (
            <div className="validate validate--ok">✓ 校验通过，可以保存。</div>
          ) : (
            <div className="validate validate--error">
              <strong>请先修复以下问题：</strong>
              <ul>
                {result.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {result.warnings.length > 0 && (
            <div className="validate validate--warn">
              <strong>提示：</strong>
              <ul>
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {d.variables.length > 0 && (
            <fieldset className="fieldset">
              <legend>测试值（填入变量预览效果）</legend>
              {d.variables.map((v) => (
                <label className="field" key={v.name}>
                  <span className="field__label">
                    {v.label ?? v.name} <code>{`{{${v.name}}}`}</code>
                  </span>
                  <input
                    value={testValues[v.name] ?? ""}
                    onChange={(e) =>
                      setTestValues({ ...testValues, [v.name]: e.target.value })
                    }
                    placeholder={v.default || `填入 ${v.name}`}
                  />
                </label>
              ))}
            </fieldset>
          )}

          <div className="field">
            <span className="field__label">注入预览（即将复制到剪贴板的内容）</span>
            <pre className="preview">{preview}</pre>
          </div>
        </section>
      )}

      <div className="wizard__nav">
        {step > 0 && (
          <button className="btn" onClick={() => setStep(step - 1)}>
            ← 上一步
          </button>
        )}
        <span className="wizard__spacer" />
        {step < STEPS.length - 1 ? (
          <button
            className="btn btn--primary"
            disabled={!canNext()}
            onClick={() => setStep(step + 1)}
          >
            下一步 →
          </button>
        ) : (
          <button
            className="btn btn--primary"
            disabled={result.errors.length > 0 || saving}
            onClick={finish}
          >
            完成并保存
          </button>
        )}
      </div>
    </div>
  );
}
