import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { Entity, SchemaDefinition } from '../types';
import { initVault, scanVault } from '../services/vault.service';

interface VaultState {
  vaultPath: string | null;
  schemas: SchemaDefinition[];
  entities: Entity[];
  isIndexing: boolean;
  error: string | null;

  openVault: (path: string, seedDefaults?: boolean) => Promise<void>;
  closeVault: () => void;
  refreshVault: () => Promise<void>;
  updateEntity: (entity: Entity) => void;
  removeEntity: (id: string) => void;
}

export const useVaultStore = create<VaultState>()(
  persist(
    (set, get) => ({
      vaultPath: null,
      schemas: [],
      entities: [],
      isIndexing: false,
      error: null,

      openVault: async (path, seedDefaults = false) => {
        // Clear existing data immediately so stale schemas never linger
        set({ isIndexing: true, error: null, schemas: [], entities: [] });
        try {
          await initVault(path, seedDefaults);
          const { schemas, entities } = await scanVault(path);
          set({ vaultPath: path, schemas, entities, isIndexing: false });
        } catch (err) {
          set({ error: String(err), isIndexing: false });
          throw err;
        }
      },

      closeVault: () =>
        set({ vaultPath: null, schemas: [], entities: [], error: null }),

      refreshVault: async () => {
        const { vaultPath, openVault } = get();
        if (vaultPath) await openVault(vaultPath);
      },

      updateEntity: (entity) =>
        set((s) => ({
          entities: s.entities.map((e) => (e.id === entity.id ? entity : e)),
        })),

      removeEntity: (id) =>
        set((s) => ({ entities: s.entities.filter((e) => e.id !== id) })),
    }),
    {
      name: 'writers-kit-vault',
      // Only persist the vault path — everything else is reloaded on mount
      partialize: (state) => ({ vaultPath: state.vaultPath }),
    },
  ),
);

/** Re-opens the persisted vault path on app startup. */
export async function rehydrateVault(): Promise<void> {
  const { vaultPath, openVault } = useVaultStore.getState();
  if (vaultPath) {
    await openVault(vaultPath).catch(() => {
      // If vault no longer exists, silently clear it
      useVaultStore.setState({ vaultPath: null });
    });
  }
}

/* Convenience hook for read-only vault data */
export function useVaultData() {
  return useVaultStore(
    useShallow((s) => ({
      vaultPath: s.vaultPath,
      schemas:   s.schemas,
      entities:  s.entities,
      isIndexing: s.isIndexing,
      error:     s.error,
    })),
  );
}
