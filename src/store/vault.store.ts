import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { Entity, EntityFrontmatter, SchemaDefinition } from '../types';
import {
  initVault,
  scanVault,
  saveSchema,
  createSchemaFile,
  deleteSchemaFile,
  createEntityFile,
  updateEntityFrontmatter,
} from '../services/vault.service';

interface VaultState {
  vaultPath: string | null;
  schemas: SchemaDefinition[];
  entities: Entity[];
  isIndexing: boolean;
  error: string | null;

  openVault: (path: string, seedDefaults?: boolean) => Promise<void>;
  closeVault: () => void;
  refreshVault: () => Promise<void>;

  // Entity mutations
  addEntity: (entity: Entity) => void;
  updateEntity: (entity: Entity) => void;
  removeEntity: (id: string) => void;

  // Schema mutations
  addSchema: (schema: SchemaDefinition) => void;
  updateSchema: (schema: SchemaDefinition) => void;
  removeSchema: (id: string) => void;

  // Async operations
  createSchema: (draft: Omit<SchemaDefinition, 'id' | 'filePath'>) => Promise<SchemaDefinition>;
  editSchema: (schema: SchemaDefinition) => Promise<void>;
  deleteSchema: (schema: SchemaDefinition) => Promise<void>;
  createEntity: (type: string, title: string) => Promise<Entity>;
  patchEntityFrontmatter: (entity: Entity, updates: Partial<EntityFrontmatter>) => Promise<Entity>;
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

      // ── Entity sync mutations ──────────────────────────────

      addEntity: (entity) =>
        set((s) => ({ entities: [...s.entities, entity] })),

      updateEntity: (entity) =>
        set((s) => ({
          entities: s.entities.map((e) => (e.id === entity.id ? entity : e)),
        })),

      removeEntity: (id) =>
        set((s) => ({ entities: s.entities.filter((e) => e.id !== id) })),

      // ── Schema sync mutations ──────────────────────────────

      addSchema: (schema) =>
        set((s) => ({ schemas: [...s.schemas, schema] })),

      updateSchema: (schema) =>
        set((s) => ({
          schemas: s.schemas.map((sc) => (sc.id === schema.id ? schema : sc)),
        })),

      removeSchema: (id) =>
        set((s) => ({ schemas: s.schemas.filter((sc) => sc.id !== id) })),

      // ── Async operations ───────────────────────────────────

      createSchema: async (draft) => {
        const { vaultPath, addSchema } = get();
        if (!vaultPath) throw new Error('No vault open');
        const schema = await createSchemaFile(vaultPath, draft);
        addSchema(schema);
        return schema;
      },

      editSchema: async (schema) => {
        const { vaultPath, updateSchema } = get();
        if (!vaultPath) throw new Error('No vault open');
        await saveSchema(vaultPath, schema);
        updateSchema(schema);
      },

      deleteSchema: async (schema) => {
        const { vaultPath, removeSchema } = get();
        if (!vaultPath) throw new Error('No vault open');
        await deleteSchemaFile(vaultPath, schema);
        removeSchema(schema.id);
      },

      createEntity: async (type, title) => {
        const { vaultPath, addEntity } = get();
        if (!vaultPath) throw new Error('No vault open');
        const entity = await createEntityFile(vaultPath, type, title);
        addEntity(entity);
        return entity;
      },

      patchEntityFrontmatter: async (entity, updates) => {
        const { vaultPath, updateEntity } = get();
        if (!vaultPath) throw new Error('No vault open');
        const updated = await updateEntityFrontmatter(vaultPath, entity, updates);
        updateEntity(updated);
        return updated;
      },
    }),
    {
      name: 'writers-kit-vault',
      partialize: (state) => ({ vaultPath: state.vaultPath }),
    },
  ),
);

/** Re-opens the persisted vault path on app startup. */
export async function rehydrateVault(): Promise<void> {
  const { vaultPath, openVault } = useVaultStore.getState();
  if (vaultPath) {
    await openVault(vaultPath).catch(() => {
      useVaultStore.setState({ vaultPath: null });
    });
  }
}

/* Convenience hook for read-only vault data */
export function useVaultData() {
  return useVaultStore(
    useShallow((s) => ({
      vaultPath:  s.vaultPath,
      schemas:    s.schemas,
      entities:   s.entities,
      isIndexing: s.isIndexing,
      error:      s.error,
    })),
  );
}
