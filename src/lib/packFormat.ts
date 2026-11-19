export const LOOPS_PACK_VERSION = 1;

export interface LoopPackPayload {
  goal: string;
  instructions: string;
  stopCondition: string;
  maxIterations: number;
}

export interface LoopPackLoop {
  id: string;
  name: string;
  description?: string;
  triggerKeyword?: string;
  tags?: string[];
  variables?: unknown[];
  payload: LoopPackPayload;
}

export interface LoopPack {
  version: number;
  exported_at: string;
  kind: "loops-pack";
  loops: LoopPackLoop[];
}

export function serializePack(pack: LoopPack): string {
  return JSON.stringify(pack, null, 2) + "\n";
}

export function parsePack(text: string): LoopPack {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid .loops.json: ${(e as Error).message}`);
  }
  if (!raw || typeof raw !== "object") throw new Error("Invalid .loops.json: expected an object");
  const obj = raw as Record<string, unknown>;
  const loopsRaw = Array.isArray(obj.loops) ? obj.loops : [];
  const loops: LoopPackLoop[] = [];
  for (const item of loopsRaw) {
    if (!item || typeof item !== "object") continue;
    const loop = item as Record<string, unknown>;
    const payload = loop.payload;
    if (!payload || typeof payload !== "object") continue;
    const p = payload as Record<string, unknown>;
    const name = typeof loop.name === "string" ? loop.name : "";
    if (!name) continue;
    loops.push({
      id: typeof loop.id === "string" ? loop.id : name,
      name,
      description: typeof loop.description === "string" ? loop.description : undefined,
      triggerKeyword: typeof loop.triggerKeyword === "string" ? loop.triggerKeyword : undefined,
      tags: Array.isArray(loop.tags) ? loop.tags.filter((t): t is string => typeof t === "string") : [],
      variables: Array.isArray(loop.variables) ? loop.variables : [],
      payload: {
        goal: typeof p.goal === "string" ? p.goal : "",
        instructions: typeof p.instructions === "string" ? p.instructions : "",
        stopCondition: typeof p.stopCondition === "string" ? p.stopCondition : "",
        maxIterations: typeof p.maxIterations === "number" ? p.maxIterations : 10,
      },
    });
  }
  if (loops.length === 0) throw new Error("Invalid .loops.json: no usable loops");
  return {
    version: typeof obj.version === "number" ? obj.version : LOOPS_PACK_VERSION,
    exported_at: typeof obj.exported_at === "string" ? obj.exported_at : "",
    kind: "loops-pack",
    loops,
  };
}
