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

// Returns whether the paste actually reached the target window.
export function simulatePaste(): Promise<boolean> {
  return invoke<boolean>("simulate_paste");
}

export interface InjectResult {
  // Whether text was auto-pasted into the target app (vs. clipboard-only).
  pasted: boolean;
}

// Injection: copy rendered text to the clipboard, optionally auto-paste. When
// auto-paste is requested but the target window can't be restored, this still
// succeeds (text is on the clipboard) but reports pasted=false so the caller
// can prompt the user to paste manually.
export async function injectText(
  text: string,
  autoPaste = false,
): Promise<InjectResult> {
  await writeText(text);
  if (autoPaste) {
    try {
      const pasted = await simulatePaste();
      return { pasted };
    } catch {
      return { pasted: false };
    }
  }
  return { pasted: false };
}

export function recordUsage(assetId: string, variables: Record<string, string> = {}): Promise<void> {
  return invoke<void>("record_usage", { assetId, variables: JSON.stringify(variables) });
}

export function listRecent(limit = 10): Promise<string[]> {
  return invoke<string[]>("list_recent", { limit });
}

export function getUseCount(assetId: string): Promise<number> {
  return invoke<number>("get_use_count", { assetId });
}

export function getLastUsed(assetId: string): Promise<string | null> {
  return invoke<string | null>("get_last_used", { assetId });
}

export function setFavorite(assetId: string, fav: boolean): Promise<void> {
  return invoke<void>("set_favorite", { assetId, fav });
}

export function listFavorites(): Promise<string[]> {
  return invoke<string[]>("list_favorites");
}

export interface Preset {
  id: string;
  name: string;
  values: Record<string, string>;
}

export function listPresets(assetId: string): Promise<Preset[]> {
  return invoke<Preset[]>("list_presets", { assetId });
}

export function savePreset(
  assetId: string,
  name: string,
  values: Record<string, string>,
): Promise<Preset> {
  return invoke<Preset>("save_preset", { assetId, name, values });
}

export function deletePreset(id: string): Promise<void> {
  return invoke<void>("delete_preset", { id });
}

export function exportAssets(ids: string[] = []): Promise<string> {
  return invoke<string>("export_assets", { ids });
}

export function importAssets(): Promise<string> {
  return invoke<string>("import_assets");
}

// ---------------------------------------------------------------------------
// In-app Loop runner (generic chat completion)
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function chatComplete(
  system: string,
  messages: ChatMessage[],
  ai: { provider: string; apiKey: string; model?: string; baseUrl?: string },
): Promise<string> {
  return invoke<string>("chat_complete", {
    system,
    messages,
    provider: ai.provider,
    apiKey: ai.apiKey,
    model: ai.model || null,
    baseUrl: ai.baseUrl || null,
  });
}

// ---------------------------------------------------------------------------
// Fabric pattern import (github.com/danielmiessler/fabric)
// ---------------------------------------------------------------------------

export function fetchFabricPatterns(): Promise<string[]> {
  return invoke<string[]>("fetch_fabric_patterns");
}

export function fetchFabricPattern(name: string): Promise<string> {
  return invoke<string>("fetch_fabric_pattern", { name });
}
