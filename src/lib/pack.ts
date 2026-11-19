import { LOOP_TEMPLATES, type LoopTemplate } from "./templates";
import { LOOPS_PACK_VERSION, type LoopPack, serializePack, parsePack } from "./packFormat";

export { LOOPS_PACK_VERSION, serializePack, parsePack };
export type { LoopPack, LoopPackLoop } from "./packFormat";

export function templatesToPack(
  templates: LoopTemplate[] = LOOP_TEMPLATES,
  exportedAt = new Date(0).toISOString(),
): LoopPack {
  return {
    version: LOOPS_PACK_VERSION,
    exported_at: exportedAt,
    kind: "loops-pack",
    loops: templates
      .filter((t) => t.id !== "blank")
      .map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        triggerKeyword: t.triggerKeyword,
        tags: t.tags,
        variables: t.variables,
        payload: t.payload,
      })),
  };
}
