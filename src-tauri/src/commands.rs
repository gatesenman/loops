//! Tauri command handlers — the IPC surface the frontend calls via `invoke`.

use tauri::{AppHandle, Manager, State};

use crate::model::{Asset, TargetApp};
use crate::osbridge;
use crate::store::Store;

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

#[tauri::command]
pub fn list_assets(store: State<Store>, kind: Option<String>) -> Result<Vec<Asset>, String> {
    store.list(kind.as_deref())
}

#[tauri::command]
pub fn get_asset(store: State<Store>, id: String) -> Result<Option<Asset>, String> {
    store.get(&id)
}

/// Inserts or updates an asset. Fills in id/timestamps for new assets so the
/// frontend can send a partial draft.
#[tauri::command]
pub fn save_asset(store: State<Store>, mut asset: Asset) -> Result<Asset, String> {
    if asset.id.trim().is_empty() {
        asset.id = uuid::Uuid::new_v4().to_string();
    }
    let now = now_iso();
    if asset.created_at.trim().is_empty() {
        asset.created_at = now.clone();
    }
    asset.updated_at = now;
    store.upsert(&asset)?;
    Ok(asset)
}

#[tauri::command]
pub fn delete_asset(store: State<Store>, id: String) -> Result<(), String> {
    store.delete(&id)
}

/// Increments an asset's run/copy counter (called when a loop is injected).
#[tauri::command]
pub fn bump_copies(store: State<Store>, id: String) -> Result<(), String> {
    store.bump_copies(&id)
}

/// Foreground app detection used by the command bar to filter by scope
/// (resolves the app captured just before the popup was summoned; see `osbridge`).
#[tauri::command]
pub fn get_foreground_app() -> Option<TargetApp> {
    osbridge::detect_foreground_app()
}

/// Shows/hides the frameless command-bar window. Bound to the global hotkey and
/// callable from the tray.
#[tauri::command]
pub fn toggle_command_bar(app: AppHandle) -> Result<(), String> {
    crate::toggle_command_bar_window(&app);
    Ok(())
}

/// App-level settings are persisted as a single JSON blob under the "app" key;
/// the frontend owns the shape so new options don't require schema changes.
#[tauri::command]
pub fn get_settings(store: State<Store>) -> Result<Option<String>, String> {
    store.get_setting("app")
}

#[tauri::command]
pub fn set_settings(store: State<Store>, value: String) -> Result<(), String> {
    store.set_setting("app", &value)
}

/// Re-registers the global summon hotkey live. The choice itself is persisted in
/// the settings JSON by the frontend; this just applies it immediately.
#[tauri::command]
pub fn set_hotkey(app: AppHandle, combo: String) -> Result<(), String> {
    crate::apply_hotkey(&app, &combo)
}

/// Wipes every locally stored Loop (used by the "clear local data" setting).
#[tauri::command]
pub fn clear_assets(store: State<Store>) -> Result<(), String> {
    store.clear_assets()
}

/// Version + on-disk data location, shown in the About section.
#[derive(serde::Serialize)]
pub struct AppInfo {
    pub version: String,
    pub data_dir: String,
}

#[tauri::command]
pub fn app_info(app: AppHandle) -> Result<AppInfo, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("loops.db");
    Ok(AppInfo {
        version: app.package_info().version.to_string(),
        data_dir: dir.to_string_lossy().to_string(),
    })
}
