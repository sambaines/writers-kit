import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { ChatMessage } from '../types';
import { useVaultStore } from './vault.store';

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  apiKey: string | null;
  apiKeyError: string | null;

  loadApiKey: () => Promise<void>;
  saveApiKey: (key: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  apiKey: null,
  apiKeyError: null,

  loadApiKey: async () => {
    const vaultPath = useVaultStore.getState().vaultPath;
    if (!vaultPath) return;
    try {
      const key = await invoke<string | null>('get_api_key', { vaultPath });
      set({ apiKey: key, apiKeyError: null });
    } catch {
      set({ apiKey: null });
    }
  },

  saveApiKey: async (key: string) => {
    const vaultPath = useVaultStore.getState().vaultPath;
    if (!vaultPath) return;
    await invoke('save_api_key', { vaultPath, key });
    set({ apiKey: key, apiKeyError: null });
  },

  sendMessage: async (content: string) => {
    const { apiKey, messages } = get();
    const vaultPath = useVaultStore.getState().vaultPath;
    if (!apiKey || !vaultPath) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    set((s) => ({ messages: [...s.messages, userMsg], isLoading: true, apiKeyError: null }));

    // Build messages array for Claude API (role/content pairs only)
    const apiMessages = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const response = await invoke<string>('claude_chat', {
        vaultPath,
        apiKey,
        messages: apiMessages,
      });

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };
      set((s) => ({ messages: [...s.messages, assistantMsg] }));
    } catch (e) {
      const errMsg = String(e);
      if (errMsg.includes('401') || errMsg.includes('invalid_api_key')) {
        set({ apiKeyError: 'Invalid API key. Please check and re-enter.' });
      }
      const errMsg2: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${errMsg}`,
        timestamp: Date.now(),
      };
      set((s) => ({ messages: [...s.messages, errMsg2] }));
    } finally {
      set({ isLoading: false });
    }
  },

  clearMessages: () => set({ messages: [] }),
}));
