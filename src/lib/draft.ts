import type { AssetDraft, LoopPayload } from "../types/asset";

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function emptyLoopDraft(): AssetDraft {
  return {
    kind: "loop",
    title: "",
    slug: "",
    description: "",
    category: "",
    tags: [],
    visibility: "private",
    version: "1.0.0",
    variables: [],
    triggers: [],
    scope: { appliesTo: ["all"] },
    payload: {
      goal: "",
      instructions: "",
      stopCondition: "",
      maxIterations: 10,
    } as LoopPayload,
  };
}
