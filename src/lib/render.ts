import type { Asset, LoopPayload } from "../types/asset";

// Substitutes {{var}} placeholders with provided values. Unknown placeholders
// are left intact so a partially-filled template is still useful.
export function fillTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, name: string) => {
    const v = values[name];
    return v !== undefined && v !== "" ? v : match;
  });
}

// Returns the placeholder names still present in a rendered string, i.e. the
// {{var}} tokens that were left intact because their value was empty/unknown.
// Used by the detail view to warn before a "dry run" / injection.
export function unfilledPlaceholders(text: string): string[] {
  const found = new Set<string>();
  const re = /\{\{\s*([\w.-]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    found.add(m[1]);
  }
  return [...found];
}

// Renders a Loop asset into the text injected into the target AI app. This is
// the canonical "what the agent receives" string for a loop run.
export function renderLoop(
  asset: Asset,
  values: Record<string, string>,
): string {
  const p = asset.payload as LoopPayload;
  const lines: string[] = [];
  lines.push(`# ${asset.title}`);
  if (p.goal) lines.push(`\n## Goal\n${fillTemplate(p.goal, values)}`);
  if (p.instructions)
    lines.push(`\n## Instructions\n${fillTemplate(p.instructions, values)}`);
  if (p.context)
    lines.push(`\n## Context\n${fillTemplate(p.context, values)}`);
  if (p.constraints)
    lines.push(`\n## Constraints\n${fillTemplate(p.constraints, values)}`);
  if (p.outputFormat)
    lines.push(`\n## Output format\n${fillTemplate(p.outputFormat, values)}`);
  if (p.examples)
    lines.push(`\n## Examples\n${fillTemplate(p.examples, values)}`);
  if (p.stopCondition)
    lines.push(`\n## Stop when\n${fillTemplate(p.stopCondition, values)}`);
  if (p.maxIterations)
    lines.push(`\n_Max iterations: ${p.maxIterations}_`);
  return lines.join("\n");
}
