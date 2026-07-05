import type { Asset, AssetDraft, LoopPayload } from "../types/asset";
import { renderLoop } from "./render";
import { slugify } from "./draft";

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

// Collects every {{variable}} placeholder name referenced by a loop's text
// fields, de-duplicated and in first-seen order.
export function extractVariables(d: AssetDraft): string[] {
  const p = d.payload as LoopPayload;
  const text = [p.goal, p.instructions, p.stopCondition ?? ""].join("\n");
  const seen: string[] = [];
  const re = /\{\{\s*([\w.-]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (!seen.includes(m[1])) seen.push(m[1]);
  }
  return seen;
}

// Validates a Loop draft for the wizard/editor. `existing` is the current loop
// library, used to detect duplicate slugs and duplicate "/" trigger keywords.
export function validateLoopDraft(
  d: AssetDraft,
  existing: Asset[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const p = d.payload as LoopPayload;

  if (!d.title.trim()) errors.push("标题不能为空。");
  if (!p.goal.trim()) errors.push("目标（Goal）不能为空。");
  if (!p.instructions.trim()) errors.push("指令（Instructions）不能为空。");

  if (p.maxIterations !== undefined && (!Number.isFinite(p.maxIterations) || p.maxIterations < 1)) {
    errors.push("最大迭代次数必须是大于等于 1 的整数。");
  }

  const others = existing.filter((a) => a.id !== d.id);

  const slug = d.slug.trim() || slugify(d.title);
  if (slug && others.some((a) => a.slug === slug)) {
    warnings.push(`已存在相同标识（slug）"${slug}" 的 Loop，保存后可能不易区分。`);
  }

  const trigger = d.triggers[0];
  if (trigger) {
    if (!trigger.keyword.trim()) {
      errors.push("已选择触发符但未填写触发词。");
    } else {
      const dup = others.find((a) =>
        a.triggers.some(
          (t) =>
            t.trigger === trigger.trigger &&
            t.keyword.toLowerCase() === trigger.keyword.trim().toLowerCase(),
        ),
      );
      if (dup) {
        errors.push(
          `触发词 "${trigger.trigger}${trigger.keyword}" 已被 "${dup.title}" 占用，请换一个。`,
        );
      }
    }
  }

  // Variables referenced in text but not declared can't be prompted for in the
  // command bar — warn so the author either declares them or removes them.
  const declared = new Set(d.variables.map((v) => v.name));
  const used = extractVariables(d);
  const undeclared = used.filter((name) => !declared.has(name));
  if (undeclared.length) {
    warnings.push(
      `占位符 ${undeclared
        .map((n) => `{{${n}}}`)
        .join("、")} 未声明为变量，运行时不会弹出输入框（将原样保留）。`,
    );
  }
  const unused = [...declared].filter((name) => !used.includes(name));
  if (unused.length) {
    warnings.push(
      `已声明但未使用的变量：${unused.join("、")}。`,
    );
  }

  return { errors, warnings };
}

// --- Loop lint: standardness & completeness checklist -----------------------

export type LintLevel = "pass" | "warn" | "fail";

export interface LintItem {
  label: string; // dimension being checked
  level: LintLevel;
  message: string; // what's good / what's missing
}

export interface LintReport {
  items: LintItem[];
  score: number; // 0-100, pass=full, warn=half, fail=0 per item
  fails: number;
  warns: number;
}

// Checks whether a loop is filled out to a "standard and complete" level:
// every core field present, stop condition & iteration bound set, variables
// consistent with the {{placeholders}} actually used, and discoverability
// metadata (description / tags / trigger) provided.
export function lintLoop(d: AssetDraft, existing: Asset[] = []): LintReport {
  const p = d.payload as LoopPayload;
  const items: LintItem[] = [];
  const add = (label: string, level: LintLevel, message: string) =>
    items.push({ label, level, message });

  const title = d.title.trim();
  if (!title) add("标题", "fail", "标题不能为空。");
  else if (title.length > 30) add("标题", "warn", "标题偏长，建议 4~30 字，便于命令栏检索。");
  else add("标题", "pass", "已填写。");

  if (!(d.description ?? "").trim())
    add("描述", "warn", "缺少一句话描述，列表/探索页中难以分辨用途。");
  else add("描述", "pass", "已填写。");

  if (!p.goal.trim()) add("目标", "fail", "目标（Goal）不能为空——Loop 是目标导向的。");
  else add("目标", "pass", "已填写。");

  const instr = p.instructions.trim();
  if (!instr) add("指令", "fail", "指令（Instructions）不能为空。");
  else if (instr.length < 20)
    add("指令", "warn", "指令过于简略（少于 20 字），AI 可能无法稳定执行。");
  else add("指令", "pass", "已填写。");

  if (!(p.stopCondition ?? "").trim())
    add("停止条件", "warn", "未设置停止条件，迭代式 Loop 建议明确何时结束。");
  else add("停止条件", "pass", "已填写。");

  if (
    p.maxIterations === undefined ||
    !Number.isFinite(p.maxIterations) ||
    p.maxIterations < 1
  )
    add("最大迭代", "warn", "未设置有效的最大迭代次数（≥1），试跑将默认 5 轮。");
  else add("最大迭代", "pass", `已设置（${p.maxIterations} 轮）。`);

  // Variable consistency: placeholders used vs. variables declared.
  const declared = new Set(d.variables.map((v) => v.name));
  const used = extractVariables(d);
  const undeclared = used.filter((n) => !declared.has(n));
  const unused = [...declared].filter((n) => !used.includes(n));
  if (undeclared.length)
    add(
      "变量",
      "fail",
      `占位符 ${undeclared.map((n) => `{{${n}}}`).join("、")} 未声明为变量，运行时不会弹出输入框。`,
    );
  else if (unused.length)
    add("变量", "warn", `已声明但未使用的变量：${unused.join("、")}。`);
  else if (used.length === 0 && declared.size === 0)
    add("变量", "pass", "无变量（纯静态 Loop）。");
  else add("变量", "pass", "声明与占位符一致。");

  const noLabel = d.variables.filter((v) => !(v.label ?? "").trim());
  if (noLabel.length)
    add(
      "变量标签",
      "warn",
      `变量 ${noLabel.map((v) => v.name).join("、")} 缺少中文标签，填写界面可读性差。`,
    );

  const trigger = d.triggers[0];
  if (!trigger) add("触发词", "warn", "未设置斜杠触发词，命令栏中只能靠搜索找到。");
  else if (!trigger.keyword.trim()) add("触发词", "fail", "已选择触发符但未填写触发词。");
  else {
    const dup = existing
      .filter((a) => a.id !== d.id)
      .find((a) =>
        a.triggers.some(
          (t) =>
            t.trigger === trigger.trigger &&
            t.keyword.toLowerCase() === trigger.keyword.trim().toLowerCase(),
        ),
      );
    if (dup)
      add("触发词", "fail", `"${trigger.trigger}${trigger.keyword}" 已被「${dup.title}」占用。`);
    else add("触发词", "pass", `已设置（${trigger.trigger}${trigger.keyword}）。`);
  }

  if (d.tags.length === 0) add("标签", "warn", "未添加标签，不利于搜索与分类。");
  else add("标签", "pass", `已添加（${d.tags.join("、")}）。`);

  const fails = items.filter((i) => i.level === "fail").length;
  const warns = items.filter((i) => i.level === "warn").length;
  const score = Math.round(
    (items.reduce(
      (s, i) => s + (i.level === "pass" ? 1 : i.level === "warn" ? 0.5 : 0),
      0,
    ) /
      items.length) *
      100,
  );
  return { items, score, fails, warns };
}

// Renders the loop with the given values — the wizard's "test" step uses this
// to preview exactly what would be injected, so a beginner can confirm it reads
// correctly before saving.
export function dryRunLoop(
  d: AssetDraft,
  values: Record<string, string>,
): string {
  const asset = {
    ...d,
    id: d.id ?? "",
    title: d.title.trim() || "(未命名 Loop)",
    stats: { copies: 0, likes: 0 },
    origin: "local" as const,
    createdAt: "",
    updatedAt: "",
  } as Asset;
  return renderLoop(asset, values);
}
