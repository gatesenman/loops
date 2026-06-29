import type { TargetAppId } from "../types/asset";

// A concrete (non-wildcard) target app in the catalog.
export interface CatalogApp {
  id: Exclude<TargetAppId, "all">;
  displayName: string;
}

// Catalog of AI applications the command bar can target. `all` is the
// scope-wildcard and is handled specially (never shown as a foreground app).
export const TARGET_APPS: CatalogApp[] = [
  { id: "claude-code", displayName: "Claude Code" },
  { id: "cursor", displayName: "Cursor" },
  { id: "codex", displayName: "Codex" },
  { id: "gemini-cli", displayName: "Gemini CLI" },
  { id: "opencode", displayName: "OpenCode" },
  { id: "generic", displayName: "Generic" },
];

export function appName(id: TargetAppId): string {
  if (id === "all") return "All apps";
  return TARGET_APPS.find((a) => a.id === id)?.displayName ?? id;
}
