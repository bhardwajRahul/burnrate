#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;

struct ServerChild(Mutex<Option<CommandChild>>);

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .manage(ServerChild(Mutex::new(None)))
        .setup(|app| {
            let sidecar = app
                .shell()
                .sidecar("burnrate-server")
                .expect("failed to find burnrate-server sidecar");

            let (mut rx, child) = sidecar.spawn().expect("failed to spawn sidecar");

            app.state::<ServerChild>()
                .0
                .lock()
                .unwrap()
                .replace(child);

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                use tauri_plugin_shell::process::CommandEvent;
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            let s = String::from_utf8_lossy(&line);
                            println!("SIDECAR STDOUT: {}", s);
                            if s.contains("Application startup complete") {
                                let app_handle_inner = app_handle.clone();
                                tauri::async_runtime::spawn(async move {
                                    // Show splash screen for 3 seconds
                                    std::thread::sleep(std::time::Duration::from_secs(3));
                                    if let Some(splash) = app_handle_inner.get_webview_window("splashscreen") {
                                        let _ = splash.close();
                                    }
                                    if let Some(window) = app_handle_inner.get_webview_window("main") {
                                        let _ = window.show();
                                        let _ = window.eval("window.location.reload()");
                                    }
                                });
                            }
                        }
                        CommandEvent::Stderr(line) => {
                            let s = String::from_utf8_lossy(&line);
                            println!("SIDECAR STDERR: {}", s);
                            if s.contains("Application startup complete") {
                                let app_handle_inner = app_handle.clone();
                                tauri::async_runtime::spawn(async move {
                                    // Show splash screen for 3 seconds
                                    std::thread::sleep(std::time::Duration::from_secs(3));
                                    if let Some(splash) = app_handle_inner.get_webview_window("splashscreen") {
                                        let _ = splash.close();
                                    }
                                    if let Some(window) = app_handle_inner.get_webview_window("main") {
                                        let _ = window.show();
                                        let _ = window.eval("window.location.reload()");
                                    }
                                });
                            }
                        }
                        CommandEvent::Terminated(payload) => {
                            println!("SIDECAR TERMINATED: {:?}", payload);
                            break;
                        }
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed => {
                    if window.label() != "main" {
                        return;
                    }
                    if let Some(child) = window
                        .app_handle()
                        .state::<ServerChild>()
                        .0
                        .lock()
                        .unwrap()
                        .take()
                    {
                        let pid = child.pid();
                        println!("Killing sidecar and its children (PID {})...", pid);
                        
                        // Robust cleanup: kill children and any leftover server processes by name
                        #[cfg(target_os = "macos")]
                        {
                            let _ = std::process::Command::new("pkill")
                                .arg("-P")
                                .arg(pid.to_string())
                                .spawn();
                            
                            // Extra safety: pkill by name for this bundle's server
                            let _ = std::process::Command::new("pkill")
                                .arg("-f")
                                .arg("burnrate-server")
                                .spawn();
                        }

                        let _ = child.kill();
                        
                        // Ensure the app exits completely
                        window.app_handle().exit(0);
                    }
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running burnrate");
}
