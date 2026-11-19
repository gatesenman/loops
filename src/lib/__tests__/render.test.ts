import { describe, expect, it } from "vitest";
import { fillTemplate, renderLoop, unfilledPlaceholders } from "../render";
import type { Asset } from "../../types/asset";

describe("fillTemplate", () => {
  it("substitutes known values and leaves empty or unknown placeholders intact", () => {
    expect(fillTemplate("Hello {{name}}", { name: "Ada" })).toBe("Hello Ada");
    expect(fillTemplate("Hello {{name}}", { name: "" })).toBe("Hello {{name}}");
    expect(fillTemplate("{{missing}}", {})).toBe("{{missing}}");
  });
});

describe("unfilledPlaceholders", () => {
  it("lists leftover tokens after a partial fill", () => {
    const text = fillTemplate("A {{a}} B {{b}}", { a: "1" });
    expect(unfilledPlaceholders(text)).toEqual(["b"]);
  });
});

describe("renderLoop", () => {
  it("renders title, goal, and instructions with substituted values", () => {
    const asset = {
      id: "1",
      kind: "loop",
      title: "Review",
      slug: "review",
      tags: [],
      visibility: "private",
      version: "1.0.0",
      variables: [],
      triggers: [],
      scope: { appliesTo: ["all"] },
      payload: { goal: "Review {{file}}", instructions: "Be {{tone}}" },
      stats: { copies: 0, likes: 0 },
      origin: "local",
      createdAt: "0",
      updatedAt: "0",
    } as Asset;
    const text = renderLoop(asset, { file: "app.ts", tone: "brief" });
    expect(text).toContain("# Review");
    expect(text).toContain("Review app.ts");
    expect(text).toContain("Be brief");
  });
});
