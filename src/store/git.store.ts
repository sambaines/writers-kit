import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { GitFileStatus, GitCommit, GitRepoStatus } from '../types';
import { useVaultStore } from './vault.store';

interface GitState {
  repoStatus: GitRepoStatus;
  changedFiles: GitFileStatus[];
  commitDrawerOpen: boolean;
  isCommitting: boolean;
  isPushing: boolean;

  refresh: () => Promise<void>;
  commit: (message: string) => Promise<string>;
  push: () => Promise<void>;
  getFileHistory: (filePath: string) => Promise<GitCommit[]>;
  setCommitDrawerOpen: (open: boolean) => void;
}

export const useGitStore = create<GitState>((set, get) => ({
  repoStatus: 'no-repo',
  changedFiles: [],
  commitDrawerOpen: false,
  isCommitting: false,
  isPushing: false,

  refresh: async () => {
    const vaultPath = useVaultStore.getState().vaultPath;
    if (!vaultPath) return;
    try {
      const files = await invoke<GitFileStatus[]>('git_status', { vaultPath });
      set({ repoStatus: files.length > 0 ? 'dirty' : 'clean', changedFiles: files });
    } catch {
      set({ repoStatus: 'no-repo', changedFiles: [] });
    }
  },

  commit: async (message: string) => {
    const vaultPath = useVaultStore.getState().vaultPath;
    if (!vaultPath) throw new Error('No vault open');
    set({ isCommitting: true });
    try {
      const hash = await invoke<string>('git_commit', { vaultPath, message });
      await get().refresh();
      return hash;
    } finally {
      set({ isCommitting: false });
    }
  },

  push: async () => {
    const vaultPath = useVaultStore.getState().vaultPath;
    if (!vaultPath) throw new Error('No vault open');
    set({ isPushing: true });
    try {
      await invoke('git_push', { vaultPath });
    } finally {
      set({ isPushing: false });
    }
  },

  getFileHistory: async (filePath: string) => {
    const vaultPath = useVaultStore.getState().vaultPath;
    if (!vaultPath) return [];
    try {
      return await invoke<GitCommit[]>('git_log_for_file', { vaultPath, filePath });
    } catch {
      return [];
    }
  },

  setCommitDrawerOpen: (open) => set({ commitDrawerOpen: open }),
}));
