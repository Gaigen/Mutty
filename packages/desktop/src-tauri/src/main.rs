#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

/// Shared state for tray icon management.
pub struct TrayState {
    pub in_room: bool,
    pub room_name: String,
    pub is_muted: bool,
}

#[cfg(target_os = "windows")]
mod global_hotkey {
    use std::sync::{Arc, Mutex};
    use std::time::Duration;
    use tauri::{AppHandle, Emitter};
    use windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;

    pub struct HotkeyState {
        pub mic_key: String,
        pub full_mute_key: String,
        pub whiteboard_key: String,
        pub notes_key: String,
    }

    pub struct ParsedHotkey {
        pub modifiers: Vec<String>,
        pub main_key: String,
    }

    fn parse_hotkey(raw: &str) -> Option<ParsedHotkey> {
        if raw.is_empty() {
            return None;
        }
        let parts: Vec<&str> = raw.split('+').collect();
        let main_key = parts.last().unwrap().to_string();
        let modifiers: Vec<String> = parts[..parts.len() - 1]
            .iter()
            .map(|s| s.to_string())
            .collect();
        if main_key.is_empty() {
            return None;
        }
        Some(ParsedHotkey {
            modifiers,
            main_key,
        })
    }

    fn vk_from_code(code: &str) -> i32 {
        match code {
            // Letters
            "KeyA" => 0x41,
            "KeyB" => 0x42,
            "KeyC" => 0x43,
            "KeyD" => 0x44,
            "KeyE" => 0x45,
            "KeyF" => 0x46,
            "KeyG" => 0x47,
            "KeyH" => 0x48,
            "KeyI" => 0x49,
            "KeyJ" => 0x4A,
            "KeyK" => 0x4B,
            "KeyL" => 0x4C,
            "KeyM" => 0x4D,
            "KeyN" => 0x4E,
            "KeyO" => 0x4F,
            "KeyP" => 0x50,
            "KeyQ" => 0x51,
            "KeyR" => 0x52,
            "KeyS" => 0x53,
            "KeyT" => 0x54,
            "KeyU" => 0x55,
            "KeyV" => 0x56,
            "KeyW" => 0x57,
            "KeyX" => 0x58,
            "KeyY" => 0x59,
            "KeyZ" => 0x5A,
            // Digits
            "Digit0" => 0x30,
            "Digit1" => 0x31,
            "Digit2" => 0x32,
            "Digit3" => 0x33,
            "Digit4" => 0x34,
            "Digit5" => 0x35,
            "Digit6" => 0x36,
            "Digit7" => 0x37,
            "Digit8" => 0x38,
            "Digit9" => 0x39,
            // Numpad
            "Numpad0" => 0x60,
            "Numpad1" => 0x61,
            "Numpad2" => 0x62,
            "Numpad3" => 0x63,
            "Numpad4" => 0x64,
            "Numpad5" => 0x65,
            "Numpad6" => 0x66,
            "Numpad7" => 0x67,
            "Numpad8" => 0x68,
            "Numpad9" => 0x69,
            // Function keys
            "F1" => 0x70,
            "F2" => 0x71,
            "F3" => 0x72,
            "F4" => 0x73,
            "F5" => 0x74,
            "F6" => 0x75,
            "F7" => 0x76,
            "F8" => 0x77,
            "F9" => 0x78,
            "F10" => 0x79,
            "F11" => 0x7A,
            "F12" => 0x7B,
            // Special keys
            "Space" => 0x20,
            "Tab" => 0x09,
            "Enter" => 0x0D,
            "Backspace" => 0x08,
            "Delete" => 0x2E,
            "Insert" => 0x2D,
            "Escape" => 0x1B,
            "ArrowUp" => 0x26,
            "ArrowDown" => 0x28,
            "ArrowLeft" => 0x25,
            "ArrowRight" => 0x27,
            "Home" => 0x24,
            "End" => 0x23,
            "PageUp" => 0x21,
            "PageDown" => 0x22,
            "Minus" => 0xBD,
            "Equal" => 0xBB,
            "BracketLeft" => 0xDB,
            "BracketRight" => 0xDD,
            "Backslash" => 0xDC,
            "Semicolon" => 0xBA,
            "Quote" => 0xDE,
            "Comma" => 0xBC,
            "Period" => 0xBE,
            "Slash" => 0xBF,
            "Backquote" => 0xC0,
            // Mouse buttons (VK codes)
            "MouseBack" => 0x05,    // XBUTTON1
            "MouseForward" => 0x06, // XBUTTON2
            "Mouse5" => 0x06,       // same as Forward for standard mice
            "Mouse6" => 0x07,       // non-standard, may not work on all mice
            "Mouse7" => 0x08,
            "Mouse8" => 0x09,
            _ => 0,
        }
    }

    fn check_modifier(modifier: &str) -> bool {
        let vk = match modifier {
            "Ctrl" => unsafe { GetAsyncKeyState(0xA2) < 0 || GetAsyncKeyState(0xA3) < 0 },
            "Alt" => unsafe { GetAsyncKeyState(0xA4) < 0 || GetAsyncKeyState(0xA5) < 0 },
            "Shift" => unsafe { GetAsyncKeyState(0xA0) < 0 || GetAsyncKeyState(0xA1) < 0 },
            "Meta" => unsafe { GetAsyncKeyState(0x5B) < 0 || GetAsyncKeyState(0x5C) < 0 },
            _ => false,
        };
        vk
    }

    fn hotkey_pressed(hk: &ParsedHotkey) -> bool {
        for m in &hk.modifiers {
            if !check_modifier(m) {
                return false;
            }
        }
        let vk = vk_from_code(&hk.main_key);
        if vk == 0 {
            return false;
        }
        unsafe { GetAsyncKeyState(vk) < 0 }
    }

    pub fn start_poller(state: Arc<Mutex<HotkeyState>>, app: AppHandle) {
        std::thread::spawn(move || {
            let mut mic_down = false;
            let mut fm_down = false;
            let mut wb_down = false;
            let mut notes_down = false;
            loop {
                let (mic_hk, fm_hk, wb_hk, notes_hk) = {
                    let s = state.lock().unwrap();
                    (
                        parse_hotkey(&s.mic_key),
                        parse_hotkey(&s.full_mute_key),
                        parse_hotkey(&s.whiteboard_key),
                        parse_hotkey(&s.notes_key),
                    )
                };

                if let Some(ref hk) = mic_hk {
                    let is_down = hotkey_pressed(hk);
                    if is_down && !mic_down {
                        let _ = app.emit("global-hotkey-mic", ());
                    }
                    mic_down = is_down;
                }

                if let Some(ref hk) = fm_hk {
                    let is_down = hotkey_pressed(hk);
                    if is_down && !fm_down {
                        let _ = app.emit("global-hotkey-full-mute", ());
                    }
                    fm_down = is_down;
                }

                if let Some(ref hk) = wb_hk {
                    let is_down = hotkey_pressed(hk);
                    if is_down && !wb_down {
                        let _ = app.emit("global-hotkey-whiteboard", ());
                    }
                    wb_down = is_down;
                }

                if let Some(ref hk) = notes_hk {
                    let is_down = hotkey_pressed(hk);
                    if is_down && !notes_down {
                        let _ = app.emit("global-hotkey-notes", ());
                    }
                    notes_down = is_down;
                }

                std::thread::sleep(Duration::from_millis(50));
            }
        });
    }
}

#[cfg(target_os = "windows")]
use global_hotkey::HotkeyState;

#[tauri::command]
fn update_global_hotkeys(
    app: AppHandle,
    mic_hotkey: String,
    full_mute_hotkey: String,
    whiteboard_hotkey: String,
    notes_hotkey: String,
) {
    #[cfg(target_os = "windows")]
    {
        if let Ok(mut state) = app.state::<Arc<Mutex<HotkeyState>>>().lock() {
            state.mic_key = mic_hotkey;
            state.full_mute_key = full_mute_hotkey;
            state.whiteboard_key = whiteboard_hotkey;
            state.notes_key = notes_hotkey;
        }
    }
}

#[tauri::command]
fn send_native_notification(title: String, body: String, app: AppHandle) {
    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .ok();
}

#[derive(serde::Deserialize)]
struct TrayStateUpdate {
    in_room: bool,
    room_name: Option<String>,
    is_muted: bool,
}

#[tauri::command]
fn set_minimize_to_tray(app: AppHandle, enabled: bool) {
    if let Ok(mut state) = app.state::<Arc<Mutex<bool>>>().lock() {
        *state = enabled;
    }
}

#[tauri::command]
fn get_minimize_to_tray(app: AppHandle) -> bool {
    app.state::<Arc<Mutex<bool>>>()
        .lock()
        .map(|s| *s)
        .unwrap_or(true)
}

#[tauri::command]
fn set_tray_state(app: AppHandle, state: TrayStateUpdate) {
    let tray_state = match app.try_state::<Arc<Mutex<TrayState>>>() {
        Some(s) => s,
        None => return,
    };
    let mut guard = match tray_state.lock() {
        Ok(g) => g,
        Err(_) => return,
    };

    guard.in_room = state.in_room;
    guard.room_name = state.room_name.clone().unwrap_or_default();
    guard.is_muted = state.is_muted;

    // Update tooltip
    let tooltip = if state.in_room {
        let muted_str = if state.is_muted { " [Muted]" } else { "" };
        let room = state.room_name.as_deref().unwrap_or("unknown");
        format!("Mutty · {}{}", room, muted_str)
    } else {
        "Mutty · Not connected".to_string()
    };

    if let Some(tray) = app.tray_by_id("main_tray") {
        let _ = tray.set_tooltip(Some(&tooltip));

        // Update icon based on mute state
        let icon_bytes: &[u8] = if state.is_muted {
            include_bytes!("../icons/frog-muted.png")
        } else {
            include_bytes!("../icons/frog-normal.png")
        };
        if let Ok(icon) = tauri::image::Image::from_bytes(icon_bytes) {
            let _ = tray.set_icon(Some(icon));
        }

        // Rebuild menu
        let show_item = MenuItem::with_id(&app, "show", "Show", true, None::<&str>);
        let quit_item = MenuItem::with_id(&app, "quit", "Quit", true, None::<&str>);
        let mute_text = if state.is_muted { "Unmute" } else { "Mute" };
        let mute_item = MenuItem::with_id(&app, "mute", mute_text, true, None::<&str>);
        let separator = PredefinedMenuItem::separator(&app);

        let (room_text, room_enabled) = if state.in_room {
            (
                format!("Room: {}", state.room_name.as_deref().unwrap_or("Room")),
                true,
            )
        } else {
            ("Not in a room".to_string(), false)
        };
        let room_item = MenuItem::with_id(&app, "room", &room_text, room_enabled, None::<&str>);

        if let (Ok(show), Ok(quit), Ok(mute), Ok(room), Ok(sep)) =
            (show_item, quit_item, mute_item, room_item, separator)
        {
            let menu = Menu::with_items(&app, &[&show, &sep, &room, &mute, &sep, &quit]);
            if let Ok(m) = menu {
                let _ = tray.set_menu(Some(m));
            }
        }
    }
}

fn main() {
    std::env::set_var(
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        "--enable-features=WebRTCPipeCapture --disable-features:MediaStreamCaptureIndicator",
    );

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .setup(|app| {
            #[cfg(target_os = "windows")]
            {
                use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings9;
                use windows_core::Interface;

                let window = app.get_webview_window("main").unwrap();
                let _ = window.with_webview(|webview| unsafe {
                    let controller = webview.controller();
                    if let Ok(core) = controller.CoreWebView2() {
                        if let Ok(settings) = core.Settings() {
                            let settings9: ICoreWebView2Settings9 = settings
                                .cast()
                                .expect("Failed to get ICoreWebView2Settings9");
                            let _ = settings9.SetIsNonClientRegionSupportEnabled(false);
                        }
                    }
                });
            }

            #[cfg(target_os = "windows")]
            {
                let hotkey_state = Arc::new(Mutex::new(HotkeyState {
                    mic_key: String::from("Ctrl+KeyM"),
                    full_mute_key: String::from("Ctrl+KeyF"),
                    whiteboard_key: String::from("Ctrl+KeyB"),
                    notes_key: String::from("Ctrl+KeyN"),
                }));
                app.manage(hotkey_state.clone());
                global_hotkey::start_poller(hotkey_state, app.handle().clone());
            }

            // Create initial menu
            let show_item = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let mute_item = MenuItem::with_id(app, "mute", "Mute", true, None::<&str>)?;
            let room_item = MenuItem::with_id(app, "room", "Not in a room", false, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;

            let menu = Menu::with_items(
                app,
                &[
                    &show_item, &separator, &room_item, &mute_item, &separator, &quit_item,
                ],
            )?;

            // Load tray icon from PNG bytes (image-png feature enables from_bytes)
            let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/frog-normal.png"))
                .expect("Failed to load tray icon");

            let tray = TrayIconBuilder::with_id("main_tray")
                .icon(icon)
                .tooltip("Mutty · Not connected")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app_handle: &AppHandle, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app_handle.exit(0);
                    }
                    "mute" => {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window
                                .eval("if(window.__trayMuteToggle) window.__trayMuteToggle();");
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray_handle, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray_handle.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            app.manage(Arc::new(Mutex::new(TrayState {
                in_room: false,
                room_name: String::new(),
                is_muted: false,
            })));

            // Minimize-to-tray toggle (default: true)
            app.manage(Arc::new(Mutex::new(true)));

            // Store tray reference
            app.manage(Arc::new(Mutex::new(tray)));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            update_global_hotkeys,
            send_native_notification,
            set_tray_state,
            set_minimize_to_tray,
            get_minimize_to_tray,
        ])
        .on_window_event(|window, event| {
            // Throttle window-state saves during move/resize to avoid excessive disk writes
            static LAST_SAVE_MS: AtomicU64 = AtomicU64::new(0);
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    let minimize = window
                        .app_handle()
                        .try_state::<Arc<Mutex<bool>>>()
                        .and_then(|s| s.lock().ok().map(|v| *v))
                        .unwrap_or(true);

                    if minimize {
                        api.prevent_close();
                        let _ = window.app_handle().save_window_state(StateFlags::all());
                        let _ = window.hide();
                    }
                }
                tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
                    let now = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap()
                        .as_millis() as u64;
                    let last = LAST_SAVE_MS.load(Ordering::Relaxed);
                    if now.saturating_sub(last) > 500 {
                        let _ = window.app_handle().save_window_state(StateFlags::all());
                        LAST_SAVE_MS.store(now, Ordering::Relaxed);
                    }
                }
                _ => {}
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                let _ = app_handle.save_window_state(StateFlags::all());
            }
        });
}
