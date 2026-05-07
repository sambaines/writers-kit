import * as ScrollArea from '@radix-ui/react-scroll-area';
import { MagnifyingGlass, Plus } from '@phosphor-icons/react';
import { useState } from 'react';
import { useUIStore } from '../../store/ui.store';
import { useShallow } from 'zustand/react/shallow';
import { useVaultData } from '../../store/vault.store';
import DynamicIcon from '../ui/DynamicIcon';
import clsx from 'clsx';
import styles from './EntityList.module.css';

export default function EntityList() {
  const [search, setSearch] = useState('');

  const { activeTypeId, activeEntityId, setActiveEntityId } = useUIStore(
    useShallow((s) => ({
      activeTypeId:      s.activeTypeId,
      activeEntityId:    s.activeEntityId,
      setActiveEntityId: s.setActiveEntityId,
    })),
  );

  const { schemas, entities } = useVaultData();

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
    // Match by schema name
    return e.type === activeSchema?.name && !e.archived;
  });

  // Search
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter((e) => e.title.toLowerCase().includes(q));
  }

  const label =
    activeTypeId === '__all'     ? 'All Files' :
    activeTypeId === '__archive' ? 'Archive'   :
    activeSchema?.name           ?? activeTypeId;

  const icon  = activeSchema?.icon  ?? 'File';
  const color = activeSchema?.color ?? 'var(--text-tertiary)';

  return (
    <div className={styles.list}>
      {/* Header */}
      <div className={styles.header}>
        <DynamicIcon name={icon} size={14} color={color} weight="duotone" />
        <span className={styles.headerLabel}>{label}</span>
        <span className={styles.headerCount}>{filtered.length}</span>
      </div>

      {/* Search */}
      <div className={styles.searchRow}>
        <MagnifyingGlass size={13} className={styles.searchIcon} />
        <input
          className={styles.searchInput}
          placeholder={`Search ${label.toLowerCase()}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Entity list */}
      <ScrollArea.Root className={styles.scrollRoot}>
        <ScrollArea.Viewport className={styles.scrollViewport}>
          {filtered.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyText}>
                {search ? 'No matches' : 'No files yet'}
              </span>
            </div>
          ) : (
            <div className={styles.entityItems}>
              {filtered.map((entity) => {
                // Icon/color: use entity override first, then schema, then default
                const schema = schemas.find((s) => s.name === entity.type);
                const eIcon  = entity.icon  ?? schema?.icon  ?? 'File';
                const eColor = entity.color ?? schema?.color ?? 'var(--text-tertiary)';

                return (
                  <button
                    key={entity.id}
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
        <button className={styles.newBtn}>
          <Plus size={13} />
          <span>New {label === 'All Files' ? 'File' : label}</span>
        </button>
      </div>
    </div>
  );
}
