import * as ScrollArea from '@radix-ui/react-scroll-area';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { Plus, ArrowCounterClockwise, Archive, Trash } from '@phosphor-icons/react';
import { useState } from 'react';
import { useUIStore } from '../../store/ui.store';
import { useShallow } from 'zustand/react/shallow';
import { useVaultData, useVaultStore } from '../../store/vault.store';
import DynamicIcon from '../ui/DynamicIcon';
import clsx from 'clsx';
import styles from './EntityList.module.css';

export default function EntityList() {
  const [creating, setCreating] = useState(false);

  const { activeTypeId, activeEntityId, setActiveEntityId } = useUIStore(
    useShallow((s) => ({
      activeTypeId:      s.activeTypeId,
      activeEntityId:    s.activeEntityId,
      setActiveEntityId: s.setActiveEntityId,
    })),
  );

  const { schemas, entities } = useVaultData();
  const createEntity  = useVaultStore((s) => s.createEntity);
  const archiveEntity = useVaultStore((s) => s.archiveEntity);
  const restoreEntity = useVaultStore((s) => s.restoreEntity);
  const deleteEntity  = useVaultStore((s) => s.deleteEntity);

  if (!activeTypeId) {
    return (
      <div className={styles.list}>
        <div className={styles.empty}>
          <span className={styles.emptyText}>Select a type</span>
        </div>
      </div>
    );
  }

  // Resolve the active schema (null for __all / __archive)
  const activeSchema =
    activeTypeId.startsWith('__')
      ? null
      : schemas.find((s) => s.id === activeTypeId) ?? null;

  // Filter entities
  let filtered = entities.filter((e) => {
    if (activeTypeId === '__all')     return !e.archived;
    if (activeTypeId === '__archive') return e.archived;
    return e.type === activeSchema?.name && !e.archived;
  });

  const label =
    activeTypeId === '__all'     ? 'All Files' :
    activeTypeId === '__archive' ? 'Archive'   :
    activeSchema?.name           ?? activeTypeId;

  const icon  = activeSchema?.icon  ?? 'File';
  const color = activeSchema?.color ?? 'var(--text-tertiary)';

  async function handleNewEntity() {
    if (!activeSchema) return;
    if (creating) return;
    setCreating(true);
    try {
      const entity = await createEntity(activeSchema.name, `New ${activeSchema.name}`);
      setActiveEntityId(entity.id);
    } finally {
      setCreating(false);
    }
  }

  const canCreate = !!activeSchema;

  return (
    <div className={styles.list}>
      {/* Header */}
      <div className={styles.header}>
        <DynamicIcon name={icon} size={14} color={color} weight="duotone" />
        <span className={styles.headerLabel}>{label}</span>
        <span className={styles.headerCount}>{filtered.length}</span>
      </div>

      {/* Entity list */}
      <ScrollArea.Root className={styles.scrollRoot}>
        <ScrollArea.Viewport className={styles.scrollViewport}>
          {filtered.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyText}>No files yet</span>
            </div>
          ) : (
            <div className={styles.entityItems}>
              {filtered.map((entity) => {
                const schema = schemas.find((s) => s.name === entity.type);
                const eIcon  = entity.icon  ?? schema?.icon  ?? 'File';
                const eColor = entity.color ?? schema?.color ?? 'var(--text-tertiary)';
                const isArchived = entity.archived;

                return (
                  <ContextMenu.Root key={entity.id}>
                    <ContextMenu.Trigger asChild>
                      <button
                        className={clsx(
                          styles.entityItem,
                          activeEntityId === entity.id && styles.active,
                        )}
                        onClick={() => setActiveEntityId(entity.id)}
                      >
                        <span className={styles.entityIcon}>
                          <DynamicIcon
                            name={eIcon}
                            size={13}
                            color={activeEntityId === entity.id ? eColor : undefined}
                            weight={activeEntityId === entity.id ? 'fill' : 'regular'}
                          />
                        </span>
                        <span className={styles.entityTitle}>{entity.title}</span>
                      </button>
                    </ContextMenu.Trigger>
                    <ContextMenu.Portal>
                      <ContextMenu.Content className={styles.ctxMenu}>
                        {isArchived ? (
                          <ContextMenu.Item
                            className={styles.ctxItem}
                            onSelect={() => void restoreEntity(entity)}
                          >
                            <ArrowCounterClockwise size={13} />
                            <span>Restore</span>
                          </ContextMenu.Item>
                        ) : (
                          <ContextMenu.Item
                            className={styles.ctxItem}
                            onSelect={() => {
                              void archiveEntity(entity);
                              if (activeEntityId === entity.id) setActiveEntityId(null);
                            }}
                          >
                            <Archive size={13} />
                            <span>Archive</span>
                          </ContextMenu.Item>
                        )}
                        <ContextMenu.Separator className={styles.ctxSep} />
                        <ContextMenu.Item
                          className={`${styles.ctxItem} ${styles.ctxItemDanger}`}
                          onSelect={() => {
                            if (confirm(`Delete "${entity.title}"? This cannot be undone.`)) {
                              void deleteEntity(entity);
                              if (activeEntityId === entity.id) setActiveEntityId(null);
                            }
                          }}
                        >
                          <Trash size={13} />
                          <span>Delete</span>
                        </ContextMenu.Item>
                      </ContextMenu.Content>
                    </ContextMenu.Portal>
                  </ContextMenu.Root>
                );
              })}
            </div>
          )}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar className={styles.scrollbar} orientation="vertical">
          <ScrollArea.Thumb className={styles.scrollThumb} />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>

      {/* Footer */}
      <div className={styles.footer}>
        <button
          className={styles.newBtn}
          onClick={handleNewEntity}
          disabled={!canCreate || creating}
        >
          <Plus size={13} />
          <span>{creating ? 'Creating…' : `New ${label === 'All Files' ? 'File' : label}`}</span>
        </button>
      </div>
    </div>
  );
}
