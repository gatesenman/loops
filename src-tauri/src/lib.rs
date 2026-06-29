//! Loops Desktop — Tauri backend entry point.
//!
//! Wires together persistence (`store`), the IPC command surface (`commands`),
//! the global hotkey, the tray, and the frameless command-bar window.

mod commands;
mod model;
mod osbridge;
mod store;

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    LogicalPosition, Manager, WindowEvent,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use store::Store;

const COMMAND_BAR_LABEL: &str = "command-bar";

/// Toggle visibility of the command-bar window and focus it when shown.
pub fn toggle_command_bar_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window(COMMAND_BAR_LABEL) {
        let visible = win.is_visible().unwrap_or(false);
        if visible {
            let _ = win.hide();
        } else {
            // Record the app currently in the foreground before our popup steals
            // focus, so per-app scope filtering can resolve the real target app.
            osbridge::capture_foreground();
            position_command_bar(&win);
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

/// Place the popup near the top-center of its monitor, like an IME candidate
/// window floating above whatever app the user is in.
fn position_command_bar(win: &tauri::WebviewWindow) {
    let Ok(Some(monitor)) = win.current_monitor() else {
        return;
    };
    let scale = monitor.scale_factor();
    let mon_pos = monitor.position().to_logical::<f64>(scale);
    let mon_size = monitor.size().to_logical::<f64>(scale);
    let win_size = win
        .outer_size()
        .map(|s| s.to_logical::<f64>(scale))
        .unwrap_or(tauri::LogicalSize {
            width: 560.0,
            height: 120.0,
        });

    let x = mon_pos.x + (mon_size.width - win_size.width) / 2.0;
    // Sit in the upper portion of the screen rather than dead-center.
    let y = mon_pos.y + (mon_size.height * 0.16);
    let _ = win.set_position(LogicalPosition::new(x, y));
}

fn open_main_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

/// Parse one of the supported summon-hotkey presets into a `Shortcut`.
/// Falls back to Alt+Space for any unrecognized value.
fn parse_combo(combo: &str) -> Shortcut {
    let mods = match combo {
        "Ctrl+Space" => Modifiers::CONTROL,
        "Alt+Shift+Space" => Modifiers::ALT | Modifiers::SHIFT,
        "Ctrl+Shift+Space" => Modifiers::CONTROL | Modifiers::SHIFT,
        _ => Modifiers::ALT,
    };
    Shortcut::new(Some(mods), Code::Space)
}

/// Unregister any existing global shortcut and register the given combo.
/// Only one summon shortcut is ever active, so the handler toggles on any press.
pub fn apply_hotkey(app: &tauri::AppHandle, combo: &str) -> Result<(), String> {
    let shortcut = parse_combo(combo);
    let gs = app.global_shortcut();
    let _ = gs.unregister_all();
    gs.register(shortcut).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    // Only the summon hotkey is ever registered, so any press toggles.
                    if event.state() == ShortcutState::Pressed {
                        toggle_command_bar_window(app);
                    }
                })
                .build(),
        )
        .setup(move |app| {
            // Persistence lives next to the app's data dir.
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let store = Store::open(&data_dir.join("loops.db"))
                .map_err(|e| Box::new(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
            let combo = store
                .get_setting("app")
                .ok()
                .flatten()
                .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
                .and_then(|j| j.get("hotkey").and_then(|v| v.as_str()).map(String::from))
                .unwrap_or_else(|| "Alt+Space".to_string());
            app.manage(store);

            // Register the summon hotkey (restored from settings, default Alt+Space).
            // Non-fatal: on some Windows installations the default Alt+Space
            // conflicts with the system window-menu shortcut and registration
            // fails.  Rather than crashing the whole app the user can pick a
            // different combo from Settings later.
            if let Err(e) = apply_hotkey(app.handle(), &combo) {
                eprintln!("[loops-desktop] failed to register hotkey '{combo}': {e}");
            }

            // Tray with show/quit.
            let open_item = MenuItem::with_id(app, "open", "Open Loops", true, None::<&str>)?;
            let bar_item =
                MenuItem::with_id(app, "command_bar", "Toggle Command Bar", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_item, &bar_item, &quit_item])?;

            let mut tray = TrayIconBuilder::new();
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray
                .menu(&menu)
                .tooltip("Loops Desktop")
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "open" => open_main_window(app),
                    "command_bar" => toggle_command_bar_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        // Hide the command bar on blur instead of leaving it floating.
        .on_window_event(|window, event| {
            if window.label() == COMMAND_BAR_LABEL {
                if let WindowEvent::Focused(false) = event {
                    // Auto-hide on blur unless the user disabled it in settings.
                    let enabled = window
                        .state::<Store>()
                        .get_setting("app")
                        .ok()
                        .flatten()
                        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
                        .and_then(|j| j.get("hideOnBlur").and_then(|v| v.as_bool()))
                        .unwrap_or(true);
                    if enabled {
                        let _ = window.hide();
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_assets,
            commands::get_asset,
            commands::save_asset,
            commands::delete_asset,
            commands::bump_copies,
            commands::get_foreground_app,
            commands::toggle_command_bar,
            commands::get_settings,
            commands::set_settings,
            commands::set_hotkey,
            commands::clear_assets,
            commands::app_info,
            commands::generate_loop,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            // With `windows_subsystem = "windows"` there is no console, so
            // write a crash log the user can inspect.
            let log = std::env::temp_dir().join("loops-desktop-crash.log");
            let msg = format!("Loops Desktop failed to start: {e}");
            let _ = std::fs::write(&log, &msg);
            eprintln!("{msg}");
        });
}
