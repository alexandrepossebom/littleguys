//! The two windows: the dropdown popover anchored under the menu-bar guy, and
//! the main chat window that folds back into the menu bar when closed.

use std::sync::atomic::{AtomicU64, Ordering};

use serde::Serialize;
use tauri::{ActivationPolicy, AppHandle, Emitter, Manager, WebviewWindow, WindowEvent};
use tauri_plugin_positioner::{Position, WindowExt};

use crate::gateway::identity::now_ms;

pub const MAIN: &str = "main";
pub const POPOVER: &str = "popover";

/// When the popover last hid because it lost focus. A click on the tray icon
/// blurs the popover *before* the tray click arrives; without this the click
/// would immediately re-open it.
static POPOVER_BLURRED_AT: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Navigate {
    pub gateway_id: Option<String>,
    pub agent_id: Option<String>,
    pub session_key: Option<String>,
    pub view: Option<String>,
}

pub fn setup(app: &AppHandle) {
    if let Some(popover) = app.get_webview_window(POPOVER) {
        #[cfg(target_os = "macos")]
        {
            use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};
            let _ = apply_vibrancy(&popover, NSVisualEffectMaterial::Popover, Some(NSVisualEffectState::Active), Some(12.0));
        }
        let _ = popover.set_visible_on_all_workspaces(true);
        let handle = popover.clone();
        popover.on_window_event(move |event| {
            if let WindowEvent::Focused(false) = event {
                POPOVER_BLURRED_AT.store(now_ms(), Ordering::SeqCst);
                let _ = handle.hide();
            }
        });
    }
    if let Some(main) = app.get_webview_window(MAIN) {
        #[cfg(target_os = "macos")]
        {
            use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};
            let _ = apply_vibrancy(&main, NSVisualEffectMaterial::Sidebar, Some(NSVisualEffectState::FollowsWindowActiveState), None);
        }
        let app_handle = app.clone();
        let handle = main.clone();
        main.on_window_event(move |event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = handle.hide();
                set_dock_visible(&app_handle, false);
            }
            WindowEvent::Focused(focused) => {
                let _ = handle.emit("lg:main-focus", *focused);
            }
            _ => {}
        });
    }
}

pub fn toggle_popover(app: &AppHandle) {
    let Some(popover) = app.get_webview_window(POPOVER) else { return };
    if popover.is_visible().unwrap_or(false) {
        let _ = popover.hide();
        return;
    }
    if now_ms().saturating_sub(POPOVER_BLURRED_AT.load(Ordering::SeqCst)) < 250 {
        return;
    }
    show_popover(&popover);
}

fn show_popover(popover: &WebviewWindow) {
    let _ = popover.move_window(Position::TrayBottomCenter);
    let _ = popover.show();
    let _ = popover.set_focus();
    let _ = popover.emit("lg:popover-shown", ());
}

pub fn hide_popover(app: &AppHandle) {
    if let Some(popover) = app.get_webview_window(POPOVER) {
        let _ = popover.hide();
    }
}

/// Resize the popover to fit its content, keeping it anchored to the tray.
pub fn fit_popover(app: &AppHandle, height: f64) {
    let Some(popover) = app.get_webview_window(POPOVER) else { return };
    let height = height.clamp(160.0, 640.0);
    let _ = popover.set_size(tauri::LogicalSize::new(340.0, height));
    if popover.is_visible().unwrap_or(false) {
        let _ = popover.move_window(Position::TrayBottomCenter);
    }
}

pub fn open_main(app: &AppHandle, nav: Option<Navigate>) {
    hide_popover(app);
    let Some(main) = app.get_webview_window(MAIN) else { return };
    set_dock_visible(app, true);
    let _ = main.unminimize();
    let _ = main.show();
    let _ = main.set_focus();
    if let Some(nav) = nav {
        let _ = main.emit("lg:navigate", nav);
    }
}

/// The app lives in the menu bar; it only shows in the Dock / ⌘Tab while the
/// main window is open.
pub fn set_dock_visible(app: &AppHandle, visible: bool) {
    let policy = if visible { ActivationPolicy::Regular } else { ActivationPolicy::Accessory };
    let _ = app.set_activation_policy(policy);
    #[cfg(target_os = "macos")]
    if visible {
        // Switching to Regular doesn't activate the app by itself.
        let _ = app.run_on_main_thread(activate_app);
    }
}

#[cfg(target_os = "macos")]
fn activate_app() {
    use objc2::MainThreadMarker;
    use objc2_app_kit::NSApplication;
    if let Some(mtm) = MainThreadMarker::new() {
        let app = NSApplication::sharedApplication(mtm);
        #[allow(deprecated)]
        app.activateIgnoringOtherApps(true);
    }
}
