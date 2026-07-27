use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let key = get_or_create_stronghold_key(app.handle())?;
            app.handle().plugin(
                tauri_plugin_stronghold::Builder::new(move |_| key.clone()).build(),
            )?;

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn get_or_create_stronghold_key(
    app: &tauri::AppHandle,
) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    let dir = app.path().app_data_dir()?;
    let key_path = dir.join(".stronghold-key");

    if key_path.exists() {
        return Ok(std::fs::read(&key_path)?);
    }

    use rand::RngCore;
    let mut key = vec![0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut key);

    std::fs::create_dir_all(&dir)?;
    std::fs::write(&key_path, &key)?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&key_path, std::fs::Permissions::from_mode(0o600))?;
    }

    Ok(key)
}
