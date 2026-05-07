use std::fs;
use std::path::Path;
use git2::{Repository, StatusOptions, IndexAddOption, RemoteCallbacks, PushOptions};

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

// ─── Git types ───────────────────────────────────────────

#[derive(serde::Serialize)]
struct GitFileStatus {
    path: String,
    status: String, // "modified" | "added" | "deleted" | "renamed" | "untracked"
}

#[derive(serde::Serialize)]
struct GitCommit {
    hash: String,
    short_hash: String,
    message: String,
    author: String,
    timestamp: i64,
}

// ─── Git commands ─────────────────────────────────────────

#[tauri::command]
fn git_init(vault_path: String) -> Result<(), String> {
    Repository::init(&vault_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn git_status(vault_path: String) -> Result<Vec<GitFileStatus>, String> {
    let repo = Repository::open(&vault_path).map_err(|e| e.to_string())?;
    let mut opts = StatusOptions::new();
    opts.include_untracked(true).recurse_untracked_dirs(true);
    let statuses = repo.statuses(Some(&mut opts)).map_err(|e| e.to_string())?;

    let mut files = Vec::new();
    for entry in statuses.iter() {
        let Some(path) = entry.path() else { continue };
        let st = entry.status();
        let status = if st.is_index_new() || st.is_wt_new() {
            "added"
        } else if st.is_index_deleted() || st.is_wt_deleted() {
            "deleted"
        } else if st.is_index_renamed() || st.is_wt_renamed() {
            "renamed"
        } else {
            "modified"
        };
        files.push(GitFileStatus { path: path.to_string(), status: status.to_string() });
    }
    Ok(files)
}

#[tauri::command]
fn git_log_for_file(vault_path: String, file_path: String) -> Result<Vec<GitCommit>, String> {
    let repo = Repository::open(&vault_path).map_err(|e| e.to_string())?;
    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push_head().map_err(|e| e.to_string())?;

    let mut commits = Vec::new();
    for oid_result in revwalk {
        let oid = oid_result.map_err(|e| e.to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;

        let touches = if commit.parent_count() == 0 {
            commit.tree().map_err(|e| e.to_string())?
                .get_path(std::path::Path::new(&file_path)).is_ok()
        } else {
            let parent_tree = commit.parent(0).map_err(|e| e.to_string())?
                .tree().map_err(|e| e.to_string())?;
            let tree = commit.tree().map_err(|e| e.to_string())?;
            let diff = repo.diff_tree_to_tree(Some(&parent_tree), Some(&tree), None)
                .map_err(|e| e.to_string())?;
            diff.deltas().any(|d| {
                d.new_file().path().map(|p| p.to_string_lossy() == file_path.as_str()).unwrap_or(false)
                || d.old_file().path().map(|p| p.to_string_lossy() == file_path.as_str()).unwrap_or(false)
            })
        };

        if touches {
            let hash = oid.to_string();
            let short_hash = hash[..7].to_string();
            let message = commit.message().unwrap_or("").lines().next().unwrap_or("").trim().to_string();
            let author = commit.author().name().unwrap_or("Unknown").to_string();
            let timestamp = commit.time().seconds();
            commits.push(GitCommit { hash, short_hash, message, author, timestamp });
        }
        if commits.len() >= 50 { break; }
    }
    Ok(commits)
}

#[tauri::command]
fn git_commit(vault_path: String, message: String) -> Result<String, String> {
    let repo = Repository::open(&vault_path).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index.add_all(["."], IndexAddOption::DEFAULT, None).map_err(|e| e.to_string())?;
    index.update_all(["."], None).map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;

    let tree_id = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_id).map_err(|e| e.to_string())?;
    let sig = repo.signature()
        .unwrap_or_else(|_| git2::Signature::now("Writer", "writer@local").unwrap());

    let parents_vec: Vec<git2::Commit> = match repo.head() {
        Ok(head) => {
            let target = head.target().ok_or("HEAD has no target")?;
            vec![repo.find_commit(target).map_err(|e| e.to_string())?]
        }
        Err(_) => vec![],
    };
    let parent_refs: Vec<&git2::Commit> = parents_vec.iter().collect();

    let oid = repo.commit(Some("HEAD"), &sig, &sig, &message, &tree, &parent_refs)
        .map_err(|e| e.to_string())?;
    Ok(oid.to_string()[..7].to_string())
}

#[tauri::command]
fn git_push(vault_path: String) -> Result<(), String> {
    let repo = Repository::open(&vault_path).map_err(|e| e.to_string())?;
    let mut remote = repo.find_remote("origin")
        .map_err(|_| "No remote named 'origin' configured".to_string())?;

    let head = repo.head().map_err(|e| e.to_string())?;
    let branch = head.shorthand().unwrap_or("main");
    let refspec = format!("refs/heads/{branch}:refs/heads/{branch}");

    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(|_url, username, allowed| {
        if allowed.contains(git2::CredentialType::SSH_KEY) {
            git2::Cred::ssh_key_from_agent(username.unwrap_or("git"))
        } else {
            Err(git2::Error::from_str("unsupported credential type — configure SSH key or token"))
        }
    });

    let mut push_opts = PushOptions::new();
    push_opts.remote_callbacks(callbacks);
    remote.push(&[refspec.as_str()], Some(&mut push_opts)).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn git_get_remote(vault_path: String) -> Result<Option<String>, String> {
    let repo = Repository::open(&vault_path).map_err(|e| e.to_string())?;
    let url = match repo.find_remote("origin") {
        Ok(r) => r.url().map(|s| s.to_string()),
        Err(_) => None,
    };
    Ok(url)
}

#[tauri::command]
fn git_set_remote(vault_path: String, url: String) -> Result<(), String> {
    let repo = Repository::open(&vault_path).map_err(|e| e.to_string())?;
    let exists = repo.find_remote("origin").is_ok();
    if exists {
        repo.remote_set_url("origin", &url).map_err(|e| e.to_string())
    } else {
        repo.remote("origin", &url).map_err(|e| e.to_string())?;
        Ok(())
    }
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
            git_init,
            git_status,
            git_log_for_file,
            git_commit,
            git_push,
            git_get_remote,
            git_set_remote,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
