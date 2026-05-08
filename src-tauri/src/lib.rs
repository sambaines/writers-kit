use std::fs;
use std::path::Path;
use base64::{Engine as _, engine::general_purpose};
use git2::{Repository, StatusOptions, IndexAddOption, RemoteCallbacks, PushOptions};
use rusqlite::Connection;

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
    // Write a .gitignore that keeps .writerkit/ (settings, db, API key) out of version control
    let gitignore_path = Path::new(&vault_path).join(".gitignore");
    if !gitignore_path.exists() {
        fs::write(&gitignore_path, "# Writers Kit internals (settings, database, API keys)\n.writerkit/\n")
            .map_err(|e| e.to_string())?;
    }
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

// ─── FTS / Search ─────────────────────────────────────────

fn writerkit_db_path(vault_path: &str) -> std::path::PathBuf {
    Path::new(vault_path).join(".writerkit").join("search.db")
}

fn open_search_db(vault_path: &str) -> Result<Connection, String> {
    let db_path = writerkit_db_path(vault_path);
    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    conn.execute_batch(
        "CREATE VIRTUAL TABLE IF NOT EXISTS fts USING fts5(path UNINDEXED, title, content, tokenize='porter ascii');"
    ).map_err(|e| e.to_string())?;
    Ok(conn)
}

#[derive(serde::Serialize)]
struct SearchResult {
    path: String,
    title: String,
    excerpt: String,
}

fn search_vault_internal(vault_path: &str, query: &str, limit: usize) -> Result<Vec<SearchResult>, String> {
    let conn = open_search_db(vault_path)?;
    let escaped = query.replace('"', "\"\"");
    let fts_query = format!("\"{}\"", escaped);
    let sql = "SELECT path, title, snippet(fts, 2, '', '', '…', 48) FROM fts WHERE fts MATCH ?1 ORDER BY rank LIMIT ?2";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let results = stmt.query_map(
        rusqlite::params![fts_query, limit as i64],
        |row| Ok(SearchResult { path: row.get(0)?, title: row.get(1)?, excerpt: row.get(2)? }),
    ).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();
    Ok(results)
}

#[tauri::command]
fn fts_rebuild_index(vault_path: String) -> Result<usize, String> {
    let conn = open_search_db(&vault_path)?;
    conn.execute("DELETE FROM fts", []).map_err(|e| e.to_string())?;
    let base = Path::new(&vault_path);
    let mut files = Vec::new();
    collect_md_files(base, base, &mut files)?;
    let mut count = 0;
    for rel_path in &files {
        let full_path = base.join(rel_path);
        if let Ok(content) = fs::read_to_string(&full_path) {
            let title = rel_path.trim_end_matches(".md")
                .split(['/', '\\'])
                .last()
                .unwrap_or(rel_path)
                .to_string();
            conn.execute(
                "INSERT INTO fts (path, title, content) VALUES (?1, ?2, ?3)",
                rusqlite::params![rel_path, title, content],
            ).map_err(|e| e.to_string())?;
            count += 1;
        }
    }
    Ok(count)
}

#[tauri::command]
fn fts_search(vault_path: String, query: String, limit: Option<usize>) -> Result<Vec<SearchResult>, String> {
    search_vault_internal(&vault_path, &query, limit.unwrap_or(5))
}

// ─── Cover image ──────────────────────────────────────────

#[tauri::command]
fn read_image_base64(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    let ext = Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_lowercase();
    let mime = match ext.as_str() {
        "png"  => "image/png",
        "gif"  => "image/gif",
        "webp" => "image/webp",
        "avif" => "image/avif",
        _      => "image/jpeg",
    };
    let b64 = general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{mime};base64,{b64}"))
}

#[tauri::command]
fn copy_cover_file(src: String, vault_path: String, filename: String) -> Result<(), String> {
    let covers_dir = Path::new(&vault_path).join(".writerkit").join("covers");
    fs::create_dir_all(&covers_dir).map_err(|e| e.to_string())?;
    let dest = covers_dir.join(&filename);
    fs::copy(&src, &dest).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_cover_file(vault_path: String, filename: String) -> Result<(), String> {
    let path = Path::new(&vault_path).join(".writerkit").join("covers").join(&filename);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ─── API key ──────────────────────────────────────────────

#[tauri::command]
fn get_api_key(vault_path: String) -> Option<String> {
    // 1. Environment variable
    if let Ok(key) = std::env::var("ANTHROPIC_API_KEY") {
        if !key.trim().is_empty() { return Some(key.trim().to_string()); }
    }
    // 2. ~/.claude/api_key file
    if let Ok(home) = std::env::var("HOME") {
        let p = Path::new(&home).join(".claude").join("api_key");
        if let Ok(key) = fs::read_to_string(&p) {
            let key = key.trim().to_string();
            if !key.is_empty() { return Some(key); }
        }
    }
    // 3. .writerkit/settings.json in vault
    let settings_path = Path::new(&vault_path).join(".writerkit").join("settings.json");
    if let Ok(content) = fs::read_to_string(&settings_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(key) = json["anthropic_api_key"].as_str() {
                if !key.is_empty() { return Some(key.to_string()); }
            }
        }
    }
    None
}

#[tauri::command]
fn save_api_key(vault_path: String, key: String) -> Result<(), String> {
    let settings_path = Path::new(&vault_path).join(".writerkit").join("settings.json");
    if let Some(parent) = settings_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let mut settings = if let Ok(content) = fs::read_to_string(&settings_path) {
        serde_json::from_str::<serde_json::Value>(&content).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    settings["anthropic_api_key"] = serde_json::Value::String(key);
    fs::write(&settings_path, serde_json::to_string_pretty(&settings).unwrap())
        .map_err(|e| e.to_string())
}

// ─── Claude chat (agentic loop with tool use) ─────────────

#[tauri::command]
async fn claude_chat(
    vault_path: String,
    api_key: String,
    messages: Vec<serde_json::Value>,
) -> Result<String, String> {
    let tools = vec![serde_json::json!({
        "name": "search_vault",
        "description": "Search all files in the writing vault for relevant content. Use this to look up characters, locations, events, lore, or any entity by name or concept.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": { "type": "string", "description": "Search terms to find relevant vault files" }
            },
            "required": ["query"]
        }
    })];

    let system = "You are a helpful writing assistant. The user is working on a writing project. \
        You have access to a search tool that searches their vault files. \
        When asked about specific characters, locations, events, or world details, always search first before answering. \
        Be concise and specific. Quote or reference the source file when relevant.";

    let client = reqwest::Client::new();
    let mut current_messages = messages;

    for _ in 0..5 {
        let body = serde_json::json!({
            "model": "claude-sonnet-4-6",
            "max_tokens": 4096,
            "system": system,
            "tools": tools,
            "messages": current_messages,
        });

        let resp = client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            let err = resp.text().await.unwrap_or_default();
            return Err(format!("API error: {err}"));
        }

        let response: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        let stop_reason = response["stop_reason"].as_str().unwrap_or("");
        let content = response["content"].as_array().ok_or("Empty response")?.clone();

        if stop_reason == "tool_use" {
            current_messages.push(serde_json::json!({ "role": "assistant", "content": content }));
            let mut tool_results: Vec<serde_json::Value> = Vec::new();
            for block in &content {
                if block["type"].as_str() == Some("tool_use") && block["name"].as_str() == Some("search_vault") {
                    let tool_id = block["id"].as_str().unwrap_or("").to_string();
                    let query = block["input"]["query"].as_str().unwrap_or("").to_string();
                    let results = search_vault_internal(&vault_path, &query, 5)?;
                    let result_text = if results.is_empty() {
                        "No results found.".to_string()
                    } else {
                        results.iter().map(|r| format!("**{}** ({})\n{}", r.title, r.path, r.excerpt))
                            .collect::<Vec<_>>().join("\n\n")
                    };
                    tool_results.push(serde_json::json!({
                        "type": "tool_result",
                        "tool_use_id": tool_id,
                        "content": result_text,
                    }));
                }
            }
            current_messages.push(serde_json::json!({ "role": "user", "content": tool_results }));
        } else {
            let text = content.iter()
                .find(|b| b["type"].as_str() == Some("text"))
                .and_then(|b| b["text"].as_str())
                .unwrap_or("")
                .to_string();
            return Ok(text);
        }
    }
    Err("Max search iterations reached".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
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
            fts_rebuild_index,
            fts_search,
            get_api_key,
            save_api_key,
            claude_chat,
            read_image_base64,
            copy_cover_file,
            delete_cover_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
