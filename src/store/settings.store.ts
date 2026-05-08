import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppTheme = 'dark' | 'light';

interface SettingsState {
  theme: AppTheme;
  unsplashKey: string;
  setTheme: (theme: AppTheme) => void;
  setUnsplashKey: (key: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      unsplashKey: '',
      setTheme: (theme) => set({ theme }),
      setUnsplashKey: (unsplashKey) => set({ unsplashKey }),
    }),
    { name: 'writers-kit-settings' },
  ),
);
