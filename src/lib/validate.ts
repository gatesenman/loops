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
