use std::fs;
use std::path::Path;

#[derive(serde::Serialize)]
struct FileStat {
    size: u64,
    modified: Option<u64>,
    created: Option<u64>,
}

/// Recursively collects all .md file paths under `current`, relative to `base`.
/// Skips the `.writerkit` directory (app internals).
fn collect_md_files(base: &Path, current: &Path, files: &mut Vec<String>) -> Result<(), String> {
    let entries = fs::read_dir(current).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");

        if file_name.starts_with('.') && file_name != ".schemas" {
            continue; // skip hidden dirs except .schemas
        }

        if path.is_dir() {
            collect_md_files(base, &path, files)?;
        } else if path.extension().and_then(|e| e.to_str()) == Some("md") {
            if let Ok(relative) = path.strip_prefix(base) {
                files.push(relative.to_string_lossy().into_owned());
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn list_vault_files(vault_path: String) -> Result<Vec<String>, String> {
    let base = Path::new(&vault_path);
    let mut files = Vec::new();
    collect_md_files(base, base, &mut files)?;
    Ok(files)
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    let file_path = Path::new(&path);
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn ensure_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn file_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    fs::remove_file(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_file_stat(path: String) -> Result<FileStat, String> {
    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    let modified = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs());
    let created = meta
        .created()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs());
    Ok(FileStat {
        size: meta.len(),
        modified,
        created,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            list_vault_files,
            read_text_file,
            write_text_file,
            ensure_dir,
            file_exists,
            delete_file,
            get_file_stat,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
