//! OS interop bridge.
//!
//! This is the seam for platform-specific automation that lets the command bar
//! detect which AI app is in the foreground so it can filter assets by scope.
//!
//! On Windows we record the foreground window the instant before the command
//! bar is summoned (so our own popup doesn't shadow it), then resolve that
//! window's owning process and map its executable name to a known target app.
//! Unrecognized processes resolve to `None`, meaning "don't filter" — the safe
//! default. On other platforms detection is currently a no-op.

use crate::model::TargetApp;

/// Records the window that was in the foreground right before the command bar
/// is shown. Called from the hotkey/tray toggle just before the popup appears.
pub fn capture_foreground() {
    #[cfg(windows)]
    win::capture_foreground();
}

/// Returns the AI app that was in the foreground when the command bar was
/// summoned, if its process maps to a known target. `None` means
/// "unknown — don't apply per-app filtering".
pub fn detect_foreground_app() -> Option<TargetApp> {
    #[cfg(windows)]
    {
        win::detect()
    }
    #[cfg(not(windows))]
    {
        None
    }
}

/// Maps a process executable stem (without `.exe`, lowercased) to a known
/// target app id, or `None` if unrecognized.
#[cfg_attr(not(windows), allow(dead_code))]
fn map_exe(stem: &str) -> Option<&'static str> {
    let e = stem.strip_suffix(".exe").unwrap_or(stem);
    match e {
        "cursor" => Some("cursor"),
        "claude" => Some("claude-code"),
        "codex" => Some("codex"),
        "gemini" => Some("gemini-cli"),
        "opencode" => Some("opencode"),
        _ => None,
    }
}

/// Builds a `TargetApp` for a known id, supplying its display name.
#[cfg_attr(not(windows), allow(dead_code))]
fn target_for_id(id: &'static str) -> TargetApp {
    let display = match id {
        "cursor" => "Cursor",
        "claude-code" => "Claude Code",
        "codex" => "Codex",
        "gemini-cli" => "Gemini CLI",
        "opencode" => "OpenCode",
        _ => "Generic",
    };
    TargetApp {
        id: id.to_string(),
        display_name: display.to_string(),
    }
}

#[cfg(windows)]
mod win {
    use std::sync::atomic::{AtomicIsize, Ordering};

    use windows::core::PWSTR;
    use windows::Win32::Foundation::{CloseHandle, HWND};
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

    use crate::model::TargetApp;

    // Address of the last foreground HWND captured before showing the popup.
    static LAST_FG: AtomicIsize = AtomicIsize::new(0);

    pub fn capture_foreground() {
        unsafe {
            let hwnd = GetForegroundWindow();
            LAST_FG.store(hwnd.0 as isize, Ordering::SeqCst);
        }
    }

    pub fn detect() -> Option<TargetApp> {
        let raw = LAST_FG.load(Ordering::SeqCst);
        if raw == 0 {
            return None;
        }
        let hwnd = HWND(raw as *mut core::ffi::c_void);
        let path = process_image_path(hwnd)?;
        let lower = path.to_lowercase().replace('/', "\\");
        let stem = lower.rsplit('\\').next().unwrap_or(&lower);
        super::map_exe(stem).map(super::target_for_id)
    }

    fn process_image_path(hwnd: HWND) -> Option<String> {
        unsafe {
            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
            if pid == 0 {
                return None;
            }
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
            let mut buf = vec![0u16; 1024];
            let mut len = buf.len() as u32;
            let res = QueryFullProcessImageNameW(
                handle,
                PROCESS_NAME_WIN32,
                PWSTR(buf.as_mut_ptr()),
                &mut len,
            );
            let _ = CloseHandle(handle);
            res.ok()?;
            Some(String::from_utf16_lossy(&buf[..len as usize]))
        }
    }
}
