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

/// Simulates Ctrl+V to paste clipboard content into the previously focused app.
/// Returns `true` if the keystrokes were delivered to a restored foreground
/// window, `false` if there was no captured target or the OS refused (in which
/// case the caller should fall back to "copied, paste manually").
pub fn simulate_paste() -> bool {
    #[cfg(windows)]
    {
        win::simulate_paste()
    }
    #[cfg(not(windows))]
    {
        false
    }
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

    pub fn simulate_paste() -> bool {
        use windows::Win32::UI::Input::KeyboardAndMouse::{
            SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
            VIRTUAL_KEY,
        };
        unsafe {
            // Restore focus to the previously captured foreground window. Without
            // a captured target we can't know where the paste would land, so bail
            // and let the caller fall back to clipboard-only.
            let raw = LAST_FG.load(Ordering::SeqCst);
            if raw == 0 {
                return false;
            }
            let hwnd = HWND(raw as *mut core::ffi::c_void);
            use windows::Win32::UI::WindowsAndMessaging::{
                IsWindow, SetForegroundWindow,
            };
            // The captured window may have closed while the bar was open.
            if !IsWindow(hwnd).as_bool() {
                return false;
            }
            let focused = SetForegroundWindow(hwnd).as_bool();
            if !focused {
                // Couldn't bring the target forward; a paste now would go to the
                // wrong window. Signal failure instead of pasting blindly.
                return false;
            }
            std::thread::sleep(std::time::Duration::from_millis(120));

            let vk_ctrl = VIRTUAL_KEY(0x11); // VK_CONTROL
            let vk_v = VIRTUAL_KEY(0x56);    // VK_V

            let mut inputs: [INPUT; 4] = std::mem::zeroed();
            // Ctrl down
            inputs[0].r#type = INPUT_KEYBOARD;
            inputs[0].Anonymous = INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: vk_ctrl,
                    ..std::mem::zeroed()
                },
            };
            // V down
            inputs[1].r#type = INPUT_KEYBOARD;
            inputs[1].Anonymous = INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: vk_v,
                    ..std::mem::zeroed()
                },
            };
            // V up
            inputs[2].r#type = INPUT_KEYBOARD;
            inputs[2].Anonymous = INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: vk_v,
                    dwFlags: KEYEVENTF_KEYUP,
                    ..std::mem::zeroed()
                },
            };
            // Ctrl up
            inputs[3].r#type = INPUT_KEYBOARD;
            inputs[3].Anonymous = INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: vk_ctrl,
                    dwFlags: KEYEVENTF_KEYUP,
                    ..std::mem::zeroed()
                },
            };
            let sent = SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
            // SendInput returns the number of events inserted; anything less
            // than the full batch means input was blocked (e.g. UIPI).
            sent as usize == inputs.len()
        }
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
