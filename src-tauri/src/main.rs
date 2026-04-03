#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};
use tauri_plugin_notification::NotificationExt;

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
    }

    fn vk_from_str(s: &str) -> i32 {
        match s {
            "A" => 0x41,
            "B" => 0x42,
            "C" => 0x43,
            "D" => 0x44,
            "E" => 0x45,
            "F" => 0x46,
            "G" => 0x47,
            "H" => 0x48,
            "I" => 0x49,
            "J" => 0x4A,
            "K" => 0x4B,
            "L" => 0x4C,
            "M" => 0x4D,
            "N" => 0x4E,
            "O" => 0x4F,
            "P" => 0x50,
            "Q" => 0x51,
            "R" => 0x52,
            "S" => 0x53,
            "T" => 0x54,
            "U" => 0x55,
            "V" => 0x56,
            "W" => 0x57,
            "X" => 0x58,
            "Y" => 0x59,
            "Z" => 0x5A,
            "0" => 0x30,
            "1" => 0x31,
            "2" => 0x32,
            "3" => 0x33,
            "4" => 0x34,
            "5" => 0x35,
            "6" => 0x36,
            "7" => 0x37,
            "8" => 0x38,
            "9" => 0x39,
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
            _ => 0,
        }
    }

    pub fn start_poller(state: Arc<Mutex<HotkeyState>>, app: AppHandle) {
        std::thread::spawn(move || {
            let mut mic_down = false;
            let mut fm_down = false;
            loop {
                let (mic_vk, fm_vk) = {
                    let s = state.lock().unwrap();
                    (vk_from_str(&s.mic_key), vk_from_str(&s.full_mute_key))
                };

                if mic_vk != 0 {
                    let is_down = unsafe { GetAsyncKeyState(mic_vk) } < 0;
                    if is_down && !mic_down {
                        let _ = app.emit("global-hotkey-mic", ());
                    }
                    mic_down = is_down;
                }

                if fm_vk != 0 {
                    let is_down = unsafe { GetAsyncKeyState(fm_vk) } < 0;
                    if is_down && !fm_down {
                        let _ = app.emit("global-hotkey-full-mute", ());
                    }
                    fm_down = is_down;
                }

                std::thread::sleep(Duration::from_millis(50));
            }
        });
    }
}

#[cfg(target_os = "windows")]
use global_hotkey::HotkeyState;

#[tauri::command]
fn update_global_hotkeys(app: AppHandle, mic_hotkey: String, full_mute_hotkey: String) {
    #[cfg(target_os = "windows")]
    {
        if let Ok(mut state) = app.state::<Arc<Mutex<HotkeyState>>>().lock() {
            state.mic_key = mic_hotkey;
            state.full_mute_key = full_mute_hotkey;
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
                    mic_key: String::from("M"),
                    full_mute_key: String::from("F"),
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
                        std::process::exit(0);
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

            // Store tray reference
            app.manage(Arc::new(Mutex::new(tray)));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            update_global_hotkeys,
            send_native_notification,
            set_tray_state,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
