import { describe, expect, it } from "vitest";
import { emptyLoopDraft, slugify } from "../draft";

describe("slugify", () => {
  it("lowercases, strips punctuation, and collapses whitespace and dashes", () => {
    expect(slugify("  Hello, World!!  ")).toBe("hello-world");
    expect(slugify("Foo---Bar")).toBe("foo-bar");
  });
});

describe("emptyLoopDraft", () => {
  it("starts as a private loop with empty required fields", () => {
    const d = emptyLoopDraft();
    expect(d.kind).toBe("loop");
    expect(d.title).toBe("");
    expect(d.visibility).toBe("private");
    expect(d.payload).toMatchObject({ goal: "", instructions: "", maxIterations: 10 });
  });
});
