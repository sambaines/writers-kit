import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { Entity, EntityFrontmatter, RelationKind, SchemaDefinition, VaultCalendar } from '../types';
import {
  initVault,
  scanVault,
  saveSchema,
  createSchemaFile,
  deleteSchemaFile,
  createEntityFile,
  deleteEntityFile,
  updateEntityFrontmatter,
} from '../services/vault.service';
import {
  loadCalendar as loadCalendarFile,
  saveCalendar as saveCalendarFile,
} from '../services/calendar.service';
import {
  loadTimelineFilters,
  saveTimelineFilters,
} from '../services/timeline-filters.service';
import {
  loadTypeOrder,
  saveTypeOrder,
} from '../services/type-order.service';

/* ─── Relation helpers ───────────────────────────────────── */

function kindToKey(kind: RelationKind): string {
  return `_${kind}`;
}

function inverseKind(kind: RelationKind): RelationKind {
  if (kind === 'parentOf')  return 'childOf';
  if (kind === 'childOf')   return 'parentOf';
  return kind; // siblingOf ↔ siblingOf, relatedTo ↔ relatedTo
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

/* ─── Store ─────────────────────────────────────────────── */

interface VaultState {
  vaultPath: string | null;
  schemas: SchemaDefinition[];
  entities: Entity[];
  calendar: VaultCalendar | null;
  isIndexing: boolean;
  error: string | null;

  // Timeline filters
  hiddenTypes: string[];
  hiddenEntities: string[];

  openVault: (path: string) => Promise<void>;
  saveCalendar: (calendar: VaultCalendar) => Promise<void>;
  closeVault: () => void;
  refreshVault: () => Promise<void>;

  toggleTimelineType: (typeName: string) => Promise<void>;
  toggleTimelineEntity: (entityId: string) => Promise<void>;
  resetTimelineFilters: () => Promise<void>;

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
  archiveEntity: (entity: Entity) => Promise<void>;
  restoreEntity: (entity: Entity) => Promise<void>;
  deleteEntity: (entity: Entity) => Promise<void>;
  patchEntityFrontmatter: (entity: Entity, updates: Partial<EntityFrontmatter>) => Promise<Entity>;
  reassignEntitiesType: (fromType: string, toType: string) => Promise<void>;
  addRelation: (sourceId: string, targetId: string, kind: RelationKind) => Promise<void>;
  removeRelation: (sourceId: string, targetId: string, kind: RelationKind) => Promise<void>;
  reorderSchemas: (orderedIds: string[]) => Promise<void>;
}

export const useVaultStore = create<VaultState>()(
  persist(
    (set, get) => ({
      vaultPath: null,
      schemas: [],
      entities: [],
      calendar: null,
      isIndexing: false,
      error: null,
      hiddenTypes: [],
      hiddenEntities: [],

      openVault: async (path) => {
        set({ isIndexing: true, error: null, schemas: [], entities: [], calendar: null, hiddenTypes: [], hiddenEntities: [] });
        try {
          await initVault(path);
          const [{ schemas, entities }, calendar, filters, typeOrder] = await Promise.all([
            scanVault(path),
            loadCalendarFile(path),
            loadTimelineFilters(path),
            loadTypeOrder(path),
          ]);
          const orderedSchemas = typeOrder.length > 0
            ? [
                ...typeOrder.map((id) => schemas.find((s) => s.id === id)).filter(Boolean) as typeof schemas,
                ...schemas.filter((s) => !typeOrder.includes(s.id)),
              ]
            : schemas;
          set({ vaultPath: path, schemas: orderedSchemas, entities, calendar, isIndexing: false, hiddenTypes: filters.hiddenTypes, hiddenEntities: filters.hiddenEntities });
        } catch (err) {
          set({ error: String(err), isIndexing: false });
          throw err;
        }
      },

      saveCalendar: async (calendar) => {
        const { vaultPath } = get();
        if (!vaultPath) throw new Error('No vault open');
        await saveCalendarFile(vaultPath, calendar);
        set({ calendar });
      },

      closeVault: () =>
        set({ vaultPath: null, schemas: [], entities: [], calendar: null, error: null, hiddenTypes: [], hiddenEntities: [] }),

      toggleTimelineType: async (typeName) => {
        const { vaultPath, hiddenTypes, hiddenEntities } = get();
        if (!vaultPath) return;
        const next = hiddenTypes.includes(typeName)
          ? hiddenTypes.filter((t) => t !== typeName)
          : [...hiddenTypes, typeName];
        set({ hiddenTypes: next });
        await saveTimelineFilters(vaultPath, { hiddenTypes: next, hiddenEntities });
      },

      toggleTimelineEntity: async (entityId) => {
        const { vaultPath, hiddenTypes, hiddenEntities } = get();
        if (!vaultPath) return;
        const next = hiddenEntities.includes(entityId)
          ? hiddenEntities.filter((id) => id !== entityId)
          : [...hiddenEntities, entityId];
        set({ hiddenEntities: next });
        await saveTimelineFilters(vaultPath, { hiddenTypes, hiddenEntities: next });
      },

      resetTimelineFilters: async () => {
        const { vaultPath } = get();
        if (!vaultPath) return;
        set({ hiddenTypes: [], hiddenEntities: [] });
        await saveTimelineFilters(vaultPath, { hiddenTypes: [], hiddenEntities: [] });
      },

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

      archiveEntity: async (entity) => {
        const { patchEntityFrontmatter } = get();
        await patchEntityFrontmatter(entity, { __archived: true });
      },

      restoreEntity: async (entity) => {
        const { patchEntityFrontmatter } = get();
        await patchEntityFrontmatter(entity, { __archived: false });
      },

      deleteEntity: async (entity) => {
        const { vaultPath, removeEntity } = get();
        if (!vaultPath) throw new Error('No vault open');
        await deleteEntityFile(vaultPath, entity);
        removeEntity(entity.id);
      },

      patchEntityFrontmatter: async (entity, updates) => {
        const { vaultPath, updateEntity } = get();
        if (!vaultPath) throw new Error('No vault open');
        const updated = await updateEntityFrontmatter(vaultPath, entity, updates);
        updateEntity(updated);
        return updated;
      },

      reassignEntitiesType: async (fromType, toType) => {
        const { vaultPath, entities, updateEntity } = get();
        if (!vaultPath) throw new Error('No vault open');
        const targets = entities.filter((e) => e.type === fromType);
        await Promise.all(
          targets.map(async (entity) => {
            const updated = await updateEntityFrontmatter(vaultPath, entity, { __type: toType });
            updateEntity(updated);
          }),
        );
      },

      addRelation: async (sourceId, targetId, kind) => {
        const { vaultPath, entities, updateEntity } = get();
        if (!vaultPath) throw new Error('No vault open');
        const source = entities.find((e) => e.id === sourceId);
        const target = entities.find((e) => e.id === targetId);
        if (!source || !target) return;

        const fwd  = kindToKey(kind);
        const inv  = kindToKey(inverseKind(kind));

        const srcIds = unique([...((source.frontmatter[fwd] as string[]) ?? []), targetId]);
        const tgtIds = unique([...((target.frontmatter[inv] as string[]) ?? []), sourceId]);

        const [updSrc, updTgt] = await Promise.all([
          updateEntityFrontmatter(vaultPath, source, { [fwd]: srcIds }),
          updateEntityFrontmatter(vaultPath, target, { [inv]: tgtIds }),
        ]);
        updateEntity(updSrc);
        updateEntity(updTgt);
      },

      reorderSchemas: async (orderedIds) => {
        const { vaultPath, schemas } = get();
        if (!vaultPath) return;
        const reordered = [
          ...orderedIds.map((id) => schemas.find((s) => s.id === id)).filter(Boolean) as typeof schemas,
          ...schemas.filter((s) => !orderedIds.includes(s.id)),
        ];
        set({ schemas: reordered });
        await saveTypeOrder(vaultPath, orderedIds);
      },

      removeRelation: async (sourceId, targetId, kind) => {
        const { vaultPath, entities, updateEntity } = get();
        if (!vaultPath) throw new Error('No vault open');
        const source = entities.find((e) => e.id === sourceId);
        const target = entities.find((e) => e.id === targetId);
        if (!source || !target) return;

        const fwd = kindToKey(kind);
        const inv = kindToKey(inverseKind(kind));

        const srcIds = ((source.frontmatter[fwd] as string[]) ?? []).filter((id) => id !== targetId);
        const tgtIds = ((target.frontmatter[inv] as string[]) ?? []).filter((id) => id !== sourceId);

        const [updSrc, updTgt] = await Promise.all([
          updateEntityFrontmatter(vaultPath, source, { [fwd]: srcIds }),
          updateEntityFrontmatter(vaultPath, target, { [inv]: tgtIds }),
        ]);
        updateEntity(updSrc);
        updateEntity(updTgt);
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
      calendar:   s.calendar,
      isIndexing: s.isIndexing,
      error:      s.error,
    })),
  );
}
