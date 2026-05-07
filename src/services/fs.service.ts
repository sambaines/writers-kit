import { invoke } from '@tauri-apps/api/core';
import { open as dialogOpen } from '@tauri-apps/plugin-dialog';

/* ─── Dialog ────────────────────────────────────────────── */

/** Opens a native folder-picker dialog. Returns the selected path or null. */
export async function pickFolder(): Promise<string | null> {
  const result = await dialogOpen({ directory: true, multiple: false });
  if (!result) return null;
  return typeof result === 'string' ? result : null;
}

/* ─── File system (via custom Rust commands) ─────────────── */

export async function listVaultFiles(vaultPath: string): Promise<string[]> {
  return invoke<string[]>('list_vault_files', { vaultPath });
}

export async function readTextFile(path: string): Promise<string> {
  return invoke<string>('read_text_file', { path });
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  return invoke('write_text_file', { path, content });
}

export async function ensureDir(path: string): Promise<void> {
  return invoke('ensure_dir', { path });
}

export async function fileExists(path: string): Promise<boolean> {
  return invoke<boolean>('file_exists', { path });
}

export async function deleteFile(path: string): Promise<void> {
  return invoke('delete_file', { path });
}

export interface FileStat {
  size: number;
  modified: number | null;
  created: number | null;
}

export async function getFileStat(path: string): Promise<FileStat> {
  return invoke<FileStat>('get_file_stat', { path });
}
