import * as ScrollArea from '@radix-ui/react-scroll-area';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Plus, ArrowCounterClockwise, Archive, Trash, ArrowUp, ArrowDown, ArrowsDownUp, Faders } from '@phosphor-icons/react';
import { useState } from 'react';
import { useUIStore } from '../../store/ui.store';
import { useShallow } from 'zustand/react/shallow';
import { useVaultData, useVaultStore } from '../../store/vault.store';
import type { Entity, VaultCalendar } from '../../types';
import { parseCustomDate, parseCustomDateRange, yearToLabel } from '../../services/calendar.service';
import DynamicIcon from '../ui/DynamicIcon';
import clsx from 'clsx';
import styles from './EntityList.module.css';

type SortDir = 'asc' | 'desc';
interface SortState { field: string; dir: SortDir; }

const SORTABLE_FIELD_TYPES = new Set(['text', 'number', 'date', 'custom-date']);

function formatFieldValue(value: unknown, fieldType: string, calendar: VaultCalendar | null): string | null {
  if (value == null || value === '') return null;
  switch (fieldType) {
    case 'text':
    case 'number':
      return String(value);
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'date':
      return String(value);
    case 'custom-date': {
      const cd = parseCustomDate(value);
      if (!cd) return null;
      return calendar ? yearToLabel(calendar, cd.year) : `Yr ${cd.year}`;
    }
    case 'custom-date-range': {
      const range = parseCustomDateRange(value);
      if (!range) return null;
      const startLabel = calendar ? yearToLabel(calendar, range.start.year) : `Yr ${range.start.year}`;
      if (range.ongoing) return `${startLabel} →`;
      if (!range.end) return startLabel;
      const endLabel = calendar ? yearToLabel(calendar, range.end.year) : `Yr ${range.end.year}`;
      return `${startLabel} – ${endLabel}`;
    }
    default:
      if (Array.isArray(value)) return (value as unknown[]).map(String).filter(Boolean).join(', ');
      if (typeof value === 'object') return null;
      return String(value);
  }
}
const BUILTIN_SORTS = [
  { key: 'name',     label: 'Title' },
  { key: 'created',  label: 'Created' },
  { key: 'modified', label: 'Modified' },
];

export default function EntityList() {
  const [creating, setCreating] = useState(false);
  const [sortPerType, setSortPerType] = useState<Record<string, SortState>>({});
  const [visiblePropsPerType, setVisiblePropsPerType] = useState<Record<string, string[]>>({});

  const { activeTypeId, activeEntityId, setActiveEntityId } = useUIStore(
    useShallow((s) => ({
      activeTypeId:      s.activeTypeId,
      activeEntityId:    s.activeEntityId,
      setActiveEntityId: s.setActiveEntityId,
    })),
  );

  const { schemas, entities } = useVaultData();
  const calendar      = useVaultStore((s) => s.calendar);
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

  // Sort state for this type
  const currentSort: SortState = sortPerType[activeTypeId] ?? { field: 'name', dir: 'asc' };

  function setSort(field: string, explicitDir?: SortDir) {
    setSortPerType((prev) => {
      const cur = prev[activeTypeId] ?? { field: 'name', dir: 'asc' };
      const dir: SortDir = explicitDir ?? (
        cur.field === field ? (cur.dir === 'asc' ? 'desc' : 'asc') : 'asc'
      );
      return { ...prev, [activeTypeId]: { field, dir } };
    });
  }

  // Available sort options: builtins + schema custom fields (filtered types only)
  const customSortFields = activeSchema
    ? activeSchema.fields
        .filter((f) => SORTABLE_FIELD_TYPES.has(f.type))
        .map((f) => ({ key: f.key, label: f.label }))
    : [];
  const allSortOptions = [...BUILTIN_SORTS, ...customSortFields];
  const currentSortLabel = allSortOptions.find((o) => o.key === currentSort.field)?.label ?? 'Title';

  // Visible properties (column picker) — only for schema types, not __all / __archive
  const visiblePropKeys: string[] = activeSchema ? (visiblePropsPerType[activeTypeId] ?? []) : [];
  const schemaFields = activeSchema ? activeSchema.fields : [];

  // Collect unique per-entity custom fields across all entities of this type
  type FieldMeta = { key: string; label: string; type: string };
  const entityCustomFields: FieldMeta[] = [];
  if (activeSchema) {
    const seen = new Set(schemaFields.map((f) => f.key));
    for (const entity of entities.filter((e) => e.type === activeSchema.name)) {
      const customFields = entity.frontmatter.__customFields as FieldMeta[] | undefined;
      if (!customFields) continue;
      for (const f of customFields) {
        if (!seen.has(f.key)) {
          seen.add(f.key);
          entityCustomFields.push(f);
        }
      }
    }
  }

  const allPropFields = schemaFields;

  function toggleProp(key: string) {
    setVisiblePropsPerType((prev) => {
      const cur = prev[activeTypeId] ?? [];
      const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
      return { ...prev, [activeTypeId]: next };
    });
  }

  function compareEntities(a: Entity, b: Entity): number {
    const { field, dir } = currentSort;
    let cmp = 0;

    if (field === 'name') {
      cmp = a.title.localeCompare(b.title);
    } else if (field === 'created') {
      cmp = String(a.frontmatter.__created ?? '').localeCompare(String(b.frontmatter.__created ?? ''));
    } else if (field === 'modified') {
      cmp = String(a.frontmatter.__modified ?? '').localeCompare(String(b.frontmatter.__modified ?? ''));
    } else {
      const aVal = a.frontmatter[field];
      const bVal = b.frontmatter[field];
      if (aVal == null && bVal == null) {
        cmp = 0;
      } else if (aVal == null) {
        return 1; // nulls always last
      } else if (bVal == null) {
        return -1;
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else if (aVal && typeof aVal === 'object' && 'year' in (aVal as object)) {
        const ad = aVal as { year: number; month?: number; day?: number };
        const bd = bVal as { year: number; month?: number; day?: number };
        cmp = ad.year !== bd.year         ? ad.year - bd.year
            : (ad.month ?? 1) !== (bd.month ?? 1) ? (ad.month ?? 1) - (bd.month ?? 1)
            : (ad.day   ?? 1) - (bd.day   ?? 1);
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }
    }

    return dir === 'asc' ? cmp : -cmp;
  }

  // Filter entities
  let filtered = entities.filter((e) => {
    if (activeTypeId === '__all')     return !e.archived;
    if (activeTypeId === '__archive') return e.archived;
    return e.type === activeSchema?.name && !e.archived;
  });

  filtered = [...filtered].sort(compareEntities);

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
        {/* Column picker — only for schema-typed views */}
        {activeSchema && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                className={clsx(styles.sortBtn, visiblePropKeys.length > 0 && styles.sortBtnActive)}
                aria-label="Toggle visible properties"
                title="Show/hide properties"
              >
                <Faders size={12} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className={styles.sortMenu} side="bottom" align="end" sideOffset={4}>
                {allPropFields.length === 0 && entityCustomFields.length === 0 ? (
                  <div className={styles.sortItem} style={{ color: 'var(--text-disabled)', cursor: 'default' }}>
                    No properties defined
                  </div>
                ) : (
                  <>
                    {allPropFields.map((field) => {
                      const checked = visiblePropKeys.includes(field.key);
                      return (
                        <DropdownMenu.CheckboxItem
                          key={field.key}
                          className={clsx(styles.sortItem, checked && styles.sortItemActive)}
                          checked={checked}
                          onCheckedChange={() => toggleProp(field.key)}
                        >
                          <span className={styles.sortItemLabel}>{field.label}</span>
                          <DropdownMenu.ItemIndicator className={styles.propCheckIndicator}>
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </DropdownMenu.ItemIndicator>
                        </DropdownMenu.CheckboxItem>
                      );
                    })}
                    {entityCustomFields.length > 0 && (
                      <>
                        {allPropFields.length > 0 && <DropdownMenu.Separator className={styles.sortSep} />}
                        {entityCustomFields.map((field) => {
                          const checked = visiblePropKeys.includes(field.key);
                          return (
                            <DropdownMenu.CheckboxItem
                              key={field.key}
                              className={clsx(styles.sortItem, checked && styles.sortItemActive)}
                              checked={checked}
                              onCheckedChange={() => toggleProp(field.key)}
                            >
                              <span className={styles.sortItemLabel}>{field.label}</span>
                              <DropdownMenu.ItemIndicator className={styles.propCheckIndicator}>
                                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                  <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </DropdownMenu.ItemIndicator>
                            </DropdownMenu.CheckboxItem>
                          );
                        })}
                      </>
                    )}
                  </>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className={clsx(styles.sortBtn, currentSort.field !== 'name' && styles.sortBtnActive)}
              aria-label="Sort entities"
            >
              <ArrowsDownUp size={11} />
              <span className={styles.sortBtnLabel}>{currentSortLabel}</span>
              {currentSort.dir === 'asc'
                ? <ArrowUp size={10} weight="bold" />
                : <ArrowDown size={10} weight="bold" />
              }
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={styles.sortMenu} side="bottom" align="end" sideOffset={4}>
              {[...BUILTIN_SORTS, ...(customSortFields.length > 0 ? [null, ...customSortFields] : [])].map((opt, i) => {
                if (opt === null) return <DropdownMenu.Separator key="sep" className={styles.sortSep} />;
                const isActive = currentSort.field === opt.key;
                return (
                  <DropdownMenu.Item
                    key={opt.key}
                    className={clsx(styles.sortItem, isActive && styles.sortItemActive)}
                    onSelect={() => setSort(opt.key)}
                  >
                    <span className={styles.sortItemLabel}>{opt.label}</span>
                    <button
                      className={clsx(styles.sortDirBtn, isActive && currentSort.dir === 'asc' && styles.sortDirBtnActive)}
                      onClick={(e) => { e.stopPropagation(); setSort(opt.key, 'asc'); }}
                      aria-label={`Sort ${opt.label} ascending`}
                    >
                      <ArrowUp size={10} weight="bold" />
                    </button>
                    <button
                      className={clsx(styles.sortDirBtn, isActive && currentSort.dir === 'desc' && styles.sortDirBtnActive)}
                      onClick={(e) => { e.stopPropagation(); setSort(opt.key, 'desc'); }}
                      aria-label={`Sort ${opt.label} descending`}
                    >
                      <ArrowDown size={10} weight="bold" />
                    </button>
                  </DropdownMenu.Item>
                );
              })}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
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

                // Compute visible prop values for this entity
                // Check schema fields first, then fall back to per-entity __customFields
                const entityCustom = entity.frontmatter.__customFields as FieldMeta[] | undefined;
                const propRows = visiblePropKeys
                  .map((key) => {
                    const field =
                      activeSchema?.fields.find((f) => f.key === key) ??
                      entityCustom?.find((f) => f.key === key);
                    if (!field) return null;
                    const value = formatFieldValue(entity.frontmatter[key], field.type, calendar);
                    if (value == null) return null;
                    return { label: field.label, value };
                  })
                  .filter((r): r is { label: string; value: string } => r !== null);

                return (
                  <ContextMenu.Root key={entity.id}>
                    <ContextMenu.Trigger asChild>
                      <button
                        className={clsx(
                          styles.entityItem,
                          propRows.length > 0 && styles.entityItemExpanded,
                          activeEntityId === entity.id && styles.active,
                        )}
                        onClick={() => setActiveEntityId(entity.id)}
                      >
                        <div className={styles.entityItemRow}>
                          <span className={styles.entityIcon}>
                            <DynamicIcon
                              name={eIcon}
                              size={13}
                              color={activeEntityId === entity.id ? eColor : undefined}
                              weight={activeEntityId === entity.id ? 'fill' : 'regular'}
                            />
                          </span>
                          <span className={styles.entityTitle}>{entity.title}</span>
                        </div>
                        {propRows.length > 0 && (
                          <div className={styles.entityProps}>
                            {propRows.map(({ label, value }) => (
                              <div key={label} className={styles.entityProp}>
                                <span className={styles.entityPropLabel}>{label}</span>
                                <span className={styles.entityPropValue}>{value}</span>
                              </div>
                            ))}
                          </div>
                        )}
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
