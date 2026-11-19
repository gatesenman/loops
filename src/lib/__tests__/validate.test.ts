import { describe, expect, it } from "vitest";
import { emptyLoopDraft } from "../draft";
import { extractVariables, validateLoopDraft } from "../validate";
import type { Asset } from "../../types/asset";

function draft(partial: Partial<ReturnType<typeof emptyLoopDraft>> = {}) {
  const d = emptyLoopDraft();
  const payload = { ...(d.payload as { goal: string; instructions: string; maxIterations?: number }), ...(typeof partial.payload === "object" ? partial.payload : {}) };
  return { ...d, ...partial, payload };
}

describe("extractVariables", () => {
  it("returns unique placeholders in first-seen order", () => {
    const d = draft({
      payload: {
        goal: "Fix {{file}} then {{file}}",
        instructions: "Use {{style}} on {{file}}",
      },
    });
    expect(extractVariables(d)).toEqual(["file", "style"]);
  });
});

describe("validateLoopDraft", () => {
  it("requires title, goal, and instructions", () => {
    const result = validateLoopDraft(draft(), []);
    expect(result.errors).toEqual(
      expect.arrayContaining(["标题不能为空。", "目标（Goal）不能为空。", "指令（Instructions）不能为空。"]),
    );
  });

  it("rejects a non-positive maxIterations and a duplicate trigger", () => {
    const existing = {
      id: "other",
      kind: "loop",
      title: "Existing",
      slug: "existing",
      tags: [],
      visibility: "private",
      version: "1.0.0",
      variables: [],
      triggers: [{ trigger: "/", keyword: "review" }],
      scope: { appliesTo: ["all"] },
      payload: { goal: "g", instructions: "i" },
      stats: { copies: 0, likes: 0 },
      origin: "local",
      createdAt: "0",
      updatedAt: "0",
    } as Asset;
    const d = draft({
      title: "New",
      slug: "existing",
      payload: { goal: "Goal", instructions: "Do it", maxIterations: 0 },
      triggers: [{ trigger: "/", keyword: "Review" }],
    });
    const result = validateLoopDraft(d, [existing]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "最大迭代次数必须是大于等于 1 的整数。",
        '触发词 "/Review" 已被 "Existing" 占用，请换一个。',
      ]),
    );
    expect(result.warnings.some((w) => w.includes("existing"))).toBe(true);
  });
});
