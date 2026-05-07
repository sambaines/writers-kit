import { create } from 'zustand';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

interface UpdateState {
  update: Update | null;
  isChecking: boolean;
  isInstalling: boolean;
  installProgress: number | null; // 0–100
  error: string | null;

  checkForUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  dismiss: () => void;
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  update: null,
  isChecking: false,
  isInstalling: false,
  installProgress: null,
  error: null,

  checkForUpdate: async () => {
    set({ isChecking: true, error: null });
    try {
      const update = await check();
      set({ update: update ?? null });
    } catch (e) {
      // Silently ignore — no pubkey configured yet, or no network
      set({ error: String(e) });
    } finally {
      set({ isChecking: false });
    }
  },

  installUpdate: async () => {
    const { update } = get();
    if (!update) return;
    set({ isInstalling: true, installProgress: 0, error: null });
    try {
      let downloaded = 0;
      let total = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0;
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          set({ installProgress: total > 0 ? Math.round((downloaded / total) * 100) : null });
        }
      });
      await relaunch();
    } catch (e) {
      set({ error: String(e), isInstalling: false, installProgress: null });
    }
  },

  dismiss: () => set({ update: null, error: null }),
}));
