import { invoke } from "@tauri-apps/api/core";
import type { Visibility } from "../types/asset";

// User-facing app settings. The whole object is persisted as a single JSON blob
// in SQLite (settings table, key "app"); the Rust side reads `hotkey` at launch
// and `hideOnBlur` on command-bar blur, so those field names are a contract.
export type HotkeyCombo =
  | "Alt+Space"
  | "Ctrl+Space"
  | "Alt+Shift+Space"
  | "Ctrl+Shift+Space";

export interface AppSettings {
  accent: string;
  defaultVisibility: Visibility;
  hotkey: HotkeyCombo;
  hideOnBlur: boolean;
}

export interface AppInfo {
  version: string;
  dataDir: string;
}

// Accent presets. Each sets the two accent CSS variables the design system
// derives every highlight/active state from.
export interface AccentPreset {
  id: string;
  label: string;
  accent: string;
  accent2: string;
}

export const ACCENTS: AccentPreset[] = [
  { id: "violet", label: "紫罗兰", accent: "#8b7cff", accent2: "#6c5cf0" },
  { id: "blue", label: "蔚蓝", accent: "#5aa6f5", accent2: "#3f7fe0" },
  { id: "teal", label: "青碧", accent: "#2dd4bf", accent2: "#14a89a" },
  { id: "emerald", label: "翠绿", accent: "#34d399", accent2: "#10a472" },
  { id: "amber", label: "琥珀", accent: "#f5b441", accent2: "#e0902a" },
  { id: "rose", label: "玫红", accent: "#f2576a", accent2: "#dc3a59" },
];

export const HOTKEYS: { id: HotkeyCombo; label: string }[] = [
  { id: "Alt+Space", label: "Alt + Space" },
  { id: "Ctrl+Space", label: "Ctrl + Space" },
  { id: "Alt+Shift+Space", label: "Alt + Shift + Space" },
  { id: "Ctrl+Shift+Space", label: "Ctrl + Shift + Space" },
];

export const DEFAULT_SETTINGS: AppSettings = {
  accent: "violet",
  defaultVisibility: "private",
  hotkey: "Alt+Space",
  hideOnBlur: true,
};

export async function getSettings(): Promise<AppSettings> {
  try {
    const raw = await invoke<string | null>("get_settings");
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(s: AppSettings): Promise<void> {
  await invoke("set_settings", { value: JSON.stringify(s) });
}

export async function setHotkey(combo: HotkeyCombo): Promise<void> {
  await invoke("set_hotkey", { combo });
}

export async function clearAssets(): Promise<void> {
  await invoke("clear_assets");
}

export async function getAppInfo(): Promise<AppInfo> {
  const info = await invoke<{ version: string; data_dir: string }>("app_info");
  return { version: info.version, dataDir: info.data_dir };
}

// Apply an accent preset to the document root so the entire UI re-themes live.
export function applyAccent(accentId: string): void {
  const preset = ACCENTS.find((a) => a.id === accentId) ?? ACCENTS[0];
  const root = document.documentElement;
  root.style.setProperty("--accent", preset.accent);
  root.style.setProperty("--accent-2", preset.accent2);
  root.style.setProperty("--brand-soft", hexToSoft(preset.accent));
}

function hexToSoft(hex: string): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.14)`;
}
