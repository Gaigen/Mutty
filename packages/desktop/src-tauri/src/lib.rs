//! Mobile (Android) entry point.
//!
//! Desktop keeps its own entry point in `main.rs`; Android never compiles that file,
//! it builds a cdylib from this one. Everything below is gated on `mobile`, so
//! desktop builds are unaffected by this module.

#[cfg(mobile)]
mod mobile_app {
    use tauri::AppHandle;
    use tauri_plugin_notification::NotificationExt;

    // The shared frontend calls these unconditionally — hotkeys are pushed to the
    // native side on mount (useHotkeySettings.ts:52) and tray state on room entry
    // (TrayStateSync.tsx:30). Neither exists on Android, but an unregistered command
    // makes `invoke` reject, so they are registered as no-ops instead.
    // Parameter names must keep matching the JS call sites.

    #[tauri::command]
    #[allow(unused_variables)]
    fn update_global_hotkeys(
        mic_hotkey: String,
        full_mute_hotkey: String,
        whiteboard_hotkey: String,
        notes_hotkey: String,
    ) {
    }

    #[tauri::command]
    #[allow(unused_variables)]
    fn set_tray_state(state: serde_json::Value) {}

    #[tauri::command]
    #[allow(unused_variables)]
    fn set_minimize_to_tray(enabled: bool) {}

    #[tauri::command]
    fn get_minimize_to_tray() -> bool {
        false
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

    /// Android scoped storage makes writing to an arbitrary path fail; the caller
    /// (TauriDownloadProvider) already treats a rejection as "download unavailable".
    #[tauri::command]
    fn save_file(path: String, contents: Vec<u8>) -> Result<(), String> {
        std::fs::write(&path, contents).map_err(|e| e.to_string())
    }

    pub fn run() {
        tauri::Builder::default()
            .plugin(tauri_plugin_shell::init())
            .plugin(tauri_plugin_notification::init())
            .plugin(tauri_plugin_dialog::init())
            .plugin(tauri_plugin_store::Builder::new().build())
            .invoke_handler(tauri::generate_handler![
                update_global_hotkeys,
                send_native_notification,
                set_tray_state,
                set_minimize_to_tray,
                get_minimize_to_tray,
                save_file,
            ])
            .run(tauri::generate_context!())
            .expect("error while running tauri application");
    }
}

#[cfg(mobile)]
#[tauri::mobile_entry_point]
pub fn run() {
    mobile_app::run();
}
