import { describe, expect, it } from "vitest";
import { ACCENTS, DEFAULT_SETTINGS, HOTKEYS } from "../settings";

describe("DEFAULT_SETTINGS", () => {
  it("starts private with a documented default hotkey and accent", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      accent: "violet",
      defaultVisibility: "private",
      hotkey: "Alt+Space",
      hideOnBlur: true,
      autoPaste: true,
    });
    expect(ACCENTS.some((a) => a.id === DEFAULT_SETTINGS.accent)).toBe(true);
    expect(HOTKEYS.some((h) => h.id === DEFAULT_SETTINGS.hotkey)).toBe(true);
  });
});
