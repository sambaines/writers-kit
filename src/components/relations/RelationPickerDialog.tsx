import { useState, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import type { Entity, RelationKind, SchemaDefinition } from '../../types';
import DynamicIcon from '../ui/DynamicIcon';
import styles from './RelationPickerDialog.module.css';

const KIND_OPTIONS: { value: RelationKind; label: string }[] = [
  { value: 'parentOf',  label: 'Parent of'  },
  { value: 'childOf',   label: 'Child of'   },
  { value: 'siblingOf', label: 'Sibling of' },
  { value: 'relatedTo', label: 'Related to' },
];

interface RelationPickerDialogProps {
  open: boolean;
  sourceEntity: Entity;
  existingTargetIds: string[];
  entities: Entity[];
  schemas: SchemaDefinition[];
  /** If set, pre-select this kind and skip the kind selector */
  defaultKind?: RelationKind;
  /** If set, only show entities of these schema names */
  filterTypes?: string[];
  onSelect: (targetId: string, kind: RelationKind) => void;
  onClose: () => void;
}

export default function RelationPickerDialog({
  open,
  sourceEntity,
  existingTargetIds,
  entities,
  schemas,
  defaultKind,
  filterTypes,
  onSelect,
  onClose,
}: RelationPickerDialogProps) {
  const [search, setSearch]   = useState('');
  const [kind, setKind]       = useState<RelationKind>(defaultKind ?? 'relatedTo');

  const candidates = useMemo(() => {
    return entities.filter((e) => {
      if (e.id === sourceEntity.id) return false;
      if (existingTargetIds.includes(e.id)) return false;
      if (filterTypes && filterTypes.length > 0 && !filterTypes.includes(e.type)) return false;
      return true;
    });
  }, [entities, sourceEntity.id, existingTargetIds, filterTypes]);

  const filtered = useMemo(() => {
    if (!search.trim()) return candidates;
    const q = search.toLowerCase();
    return candidates.filter(
      (e) => e.title.toLowerCase().includes(q) || e.type.toLowerCase().includes(q),
    );
  }, [candidates, search]);

  // Group by type for display
  const grouped = useMemo(() => {
    const map = new Map<string, Entity[]>();
    for (const e of filtered) {
      const group = map.get(e.type) ?? [];
      group.push(e);
      map.set(e.type, group);
    }
    return map;
  }, [filtered]);

  function handleSelect(targetId: string) {
    onSelect(targetId, kind);
    setSearch('');
    onClose();
  }

  function handleOpenChange(o: boolean) {
    if (!o) { setSearch(''); onClose(); }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <div className={styles.header}>
            <Dialog.Title className={styles.title}>Add Relation</Dialog.Title>
            <Dialog.Close asChild>
              <button className={styles.closeBtn} aria-label="Close"><X size={15} /></button>
            </Dialog.Close>
          </div>

          {/* Kind selector */}
          {!defaultKind && (
            <div className={styles.kindRow}>
              <span className={styles.kindLabel}>
                <strong style={{ color: 'var(--text-primary)' }}>{sourceEntity.title}</strong>
                {' '}is a…
              </span>
              <div className={styles.kindOptions}>
                {KIND_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`${styles.kindBtn} ${kind === opt.value ? styles.kindBtnActive : ''}`}
                    onClick={() => setKind(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <div className={styles.searchRow}>
            <MagnifyingGlass size={13} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search entities…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          {/* Entity list */}
          <div className={styles.list}>
            {filtered.length === 0 ? (
              <div className={styles.empty}>
                {search ? 'No matches' : candidates.length === 0 ? 'No other entities available' : 'No results'}
              </div>
            ) : (
              Array.from(grouped.entries()).map(([type, items]) => {
                const schema = schemas.find((s) => s.name === type);
                return (
                  <div key={type} className={styles.group}>
                    <div className={styles.groupHeader}>
                      {schema && <DynamicIcon name={schema.icon} size={11} color={schema.color} />}
                      <span style={{ color: schema?.color ?? 'var(--text-tertiary)' }}>{type}</span>
                    </div>
                    {items.map((entity) => {
                      const eIcon  = entity.icon  ?? schema?.icon  ?? 'File';
                      const eColor = entity.color ?? schema?.color ?? 'var(--text-tertiary)';
                      return (
                        <button
                          key={entity.id}
                          className={styles.entityRow}
                          onClick={() => handleSelect(entity.id)}
                        >
                          <DynamicIcon name={eIcon} size={13} color={eColor} weight="duotone" />
                          <span className={styles.entityTitle}>{entity.title}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
