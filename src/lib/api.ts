import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { Asset, AssetDraft, AssetKind, TargetApp } from "../types/asset";

// Thin wrappers over the Tauri command surface (src-tauri/src/commands.rs).

export function listAssets(kind?: AssetKind): Promise<Asset[]> {
  return invoke<Asset[]>("list_assets", { kind: kind ?? null });
}

export function getAsset(id: string): Promise<Asset | null> {
  return invoke<Asset | null>("get_asset", { id });
}

export function saveAsset(asset: AssetDraft): Promise<Asset> {
  return invoke<Asset>("save_asset", { asset });
}

export function deleteAsset(id: string): Promise<void> {
  return invoke<void>("delete_asset", { id });
}

// Records a run/copy of an asset (increments stats.copies). Fire-and-forget.
export function bumpCopies(id: string): Promise<void> {
  return invoke<void>("bump_copies", { id });
}

export function getForegroundApp(): Promise<TargetApp | null> {
  return invoke<TargetApp | null>("get_foreground_app");
}

export function toggleCommandBar(): Promise<void> {
  return invoke<void>("toggle_command_bar");
}

// Injection (M1): copy rendered text to the clipboard. M2 adds keystroke
// injection into the foreground app via the OS bridge.
export async function injectText(text: string): Promise<void> {
  await writeText(text);
}
