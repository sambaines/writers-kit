import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

export interface CoverData {
  type: 'local' | 'unsplash';
  src: string; // local: filename in .writerkit/covers/; unsplash: https URL
  attribution?: { name: string; username: string; url: string };
}

// Returns a displayable URL for the cover image.
// For local files this invokes Rust to read the bytes and returns a data URL.
export async function coverToUrl(cover: CoverData, vaultPath: string): Promise<string> {
  if (cover.type === 'local') {
    return invoke<string>('read_image_base64', {
      path: `${vaultPath}/.writerkit/covers/${cover.src}`,
    });
  }
  return cover.src;
}

export async function pickAndSaveLocalCover(vaultPath: string): Promise<CoverData | null> {
  const filePath = await open({
    filters: [{ name: 'Image', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'] }],
    multiple: false,
  });
  if (!filePath || typeof filePath !== 'string') return null;

  const basename = filePath.replace(/\\/g, '/').split('/').pop() ?? 'cover.jpg';
  const uniqueName = `${Date.now()}-${basename}`;

  await invoke('copy_cover_file', { src: filePath, vaultPath, filename: uniqueName });
  return { type: 'local', src: uniqueName };
}

export async function deleteLocalCover(vaultPath: string, filename: string): Promise<void> {
  await invoke('delete_cover_file', { vaultPath, filename });
}

// ─── Unsplash ─────────────────────────────────────────────

export interface UnsplashPhoto {
  id: string;
  urls: { regular: string; small: string; thumb: string };
  alt_description: string | null;
  user: { name: string; username: string };
  links: { download_location: string };
}

export async function unsplashSearch(query: string, apiKey: string): Promise<UnsplashPhoto[]> {
  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=20`,
    { headers: { Authorization: `Client-ID ${apiKey}` } },
  );
  if (!res.ok) throw new Error(`Unsplash error: ${res.status}`);
  const data = await res.json() as { results: UnsplashPhoto[] };
  return data.results;
}

// Required by Unsplash API guidelines — call when user selects a photo
export async function triggerUnsplashDownload(downloadLocation: string, apiKey: string): Promise<void> {
  await fetch(downloadLocation, { headers: { Authorization: `Client-ID ${apiKey}` } });
}
