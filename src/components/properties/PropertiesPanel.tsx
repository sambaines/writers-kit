import { useState, useRef } from 'react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import * as Select from '@radix-ui/react-select';
import {
  X, Hash, Calendar, Tag, TextT,
  ArrowUpRight, TreeStructure, ArrowsOut,
  FileText, Clock, PencilLine, Eye, CaretUpDown,
} from '@phosphor-icons/react';
import { useUIStore } from '../../store/ui.store';
import { useVaultData, useVaultStore } from '../../store/vault.store';
import { useShallow } from 'zustand/react/shallow';
import DynamicIcon from '../ui/DynamicIcon';
import styles from './PropertiesPanel.module.css';
import type { FieldDefinition } from '../../types';

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function relativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1)   return 'just now';
    if (mins < 60)  return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return iso;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FieldIcon({ type }: { type: string }) {
  const size = 12;
  switch (type) {
    case 'date':    return <Calendar size={size} />;
    case 'tags':    return <Tag size={size} />;
    case 'number':  return <Hash size={size} />;
    default:        return <TextT size={size} />;
  }
}

// ─── Editable field input ─────────────────────────────────

interface FieldInputProps {
  field: FieldDefinition;
  value: unknown;
  onSave: (key: string, value: unknown) => void;
}

function FieldInput({ field, value, onSave }: FieldInputProps) {
  const [localVal, setLocalVal] = useState<string>(
    value === undefined || value === null ? '' : String(value),
  );
  const commitRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function schedule(v: string) {
    setLocalVal(v);
    if (commitRef.current) clearTimeout(commitRef.current);
    commitRef.current = setTimeout(() => {
      if (field.type === 'number') {
        onSave(field.key, v === '' ? undefined : Number(v));
      } else if (field.type === 'tags') {
        onSave(field.key, v);
      } else {
        onSave(field.key, v === '' ? undefined : v);
      }
    }, 600);
  }

  if (field.type === 'boolean') {
    const checked = !!value;
    return (
      <button
        type="button"
        className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`}
        onClick={() => onSave(field.key, !checked)}
        aria-checked={checked}
        role="switch"
      >
        <span className={styles.toggleThumb} />
      </button>
    );
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        className={styles.fieldTextarea}
        value={localVal}
        placeholder="—"
        onChange={(e) => schedule(e.target.value)}
        rows={3}
      />
    );
  }

  if (field.type === 'number') {
    return (
      <input
        type="number"
        className={styles.fieldInput}
        value={localVal}
        placeholder="—"
        onChange={(e) => schedule(e.target.value)}
      />
    );
  }

  // text, tags, date, select, relation → text input
  return (
    <input
      type="text"
      className={styles.fieldInput}
      value={localVal}
      placeholder={field.type === 'tags' ? 'tag1, tag2…' : '—'}
      onChange={(e) => schedule(e.target.value)}
    />
  );
}

// ─── Main panel ───────────────────────────────────────────

export default function PropertiesPanel() {
  const { activeEntityId, setPropertiesPanelOpen } = useUIStore(
    useShallow((s) => ({
      activeEntityId:         s.activeEntityId,
      setPropertiesPanelOpen: s.setPropertiesPanelOpen,
    })),
  );
  const { entities, schemas } = useVaultData();
  const patchEntityFrontmatter = useVaultStore((s) => s.patchEntityFrontmatter);

  const entity = entities.find((e) => e.id === activeEntityId) ?? null;
  const schema = entity ? schemas.find((s) => s.name === entity.type) : null;

  const userFields = schema?.fields.map((field) => ({
    ...field,
    value: entity?.frontmatter[field.key],
  })) ?? [];

  const relations = entity
    ? [
        ...((entity.frontmatter._parentOf  as string[] | undefined) ?? []).map((t) => ({ kind: 'Parent of',  target: t })),
        ...((entity.frontmatter._childOf   as string[] | undefined) ?? []).map((t) => ({ kind: 'Child of',   target: t })),
        ...((entity.frontmatter._siblingOf as string[] | undefined) ?? []).map((t) => ({ kind: 'Sibling of', target: t })),
        ...((entity.frontmatter._relatedTo as string[] | undefined) ?? []).map((t) => ({ kind: 'Related to', target: t })),
      ]
    : [];

  function handleFieldSave(key: string, value: unknown) {
    if (!entity) return;
    void patchEntityFrontmatter(entity, { [key]: value });
  }

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerMeta}>
          {entity ? (
            <>
              <button
                className={styles.iconSwatch}
                aria-label="Change icon"
                style={{ background: schema ? `${schema.color}20` : undefined }}
              >
                <DynamicIcon
                  name={entity.icon ?? schema?.icon ?? 'File'}
                  size={15}
                  weight="duotone"
                  color={entity.color ?? schema?.color ?? 'var(--accent-text)'}
                />
              </button>
              <button
                className={styles.colorSwatch}
                style={{ background: entity.color ?? schema?.color ?? 'var(--accent)' }}
                aria-label="Change color"
              />
              <span className={styles.headerTitle}>{entity.title}</span>
            </>
          ) : (
            <span className={styles.headerEmpty}>Properties</span>
          )}
        </div>
        <button
          className={styles.closeBtn}
          onClick={() => setPropertiesPanelOpen(false)}
          aria-label="Close properties"
        >
          <X size={14} />
        </button>
      </div>

      {entity && (
        <div className={styles.typeBadge}>
          <Select.Root
            value={entity.type}
            onValueChange={(newType) => void patchEntityFrontmatter(entity, { __type: newType })}
          >
            <Select.Trigger asChild>
              <button className={styles.typeSelect}>
                {schema && <DynamicIcon name={schema.icon} size={11} color={schema.color} />}
                <span style={{ color: schema?.color ?? 'var(--text-tertiary)' }}>{entity.type}</span>
                <CaretUpDown size={10} className={styles.typeSelectCaret} />
              </button>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className={styles.typeSelectContent} position="popper" sideOffset={4}>
                <Select.Viewport>
                  {schemas.map((s) => (
                    <Select.Item key={s.id} value={s.name} className={styles.typeSelectItem}>
                      <Select.ItemText>
                        <span className={styles.typeSelectItemInner}>
                          <DynamicIcon name={s.icon} size={12} color={s.color} />
                          <span>{s.name}</span>
                        </span>
                      </Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>
      )}

      <ScrollArea.Root className={styles.scrollRoot}>
        <ScrollArea.Viewport className={styles.scrollViewport}>
          {entity ? (
            <>
              {/* Schema-defined fields */}
              {userFields.length > 0 && (
                <section className={styles.section}>
                  <div className={styles.sectionHeader}>Properties</div>
                  <div className={styles.fields}>
                    {userFields.map((field) => (
                      <div key={field.key} className={styles.field}>
                        <div className={styles.fieldLabel}>
                          <FieldIcon type={field.type} />
                          <span>{field.label}</span>
                        </div>
                        <div className={styles.fieldValueWrap}>
                          <FieldInput
                            field={field}
                            value={field.value}
                            onSave={handleFieldSave}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Relations */}
              <div className={styles.divider} />
              <section className={styles.section}>
                <div className={styles.sectionHeader}>Relations</div>
                <div className={styles.relations}>
                  {relations.length === 0 ? (
                    <span className={styles.emptyHint}>No relations</span>
                  ) : (
                    relations.map((rel, i) => {
                      const target = entities.find((e) => e.id === rel.target);
                      return (
                        <div key={i} className={styles.relation}>
                          <span className={styles.relKind}>{rel.kind}</span>
                          <button className={styles.relLink}>
                            <ArrowUpRight size={11} />
                            <span>{target?.title ?? rel.target}</span>
                            {target && (
                              <span className={styles.relType}>{target.type}</span>
                            )}
                          </button>
                        </div>
                      );
                    })
                  )}
                  <button className={styles.addRelation}>
                    <TreeStructure size={12} />
                    <span>Add relation</span>
                  </button>
                </div>
              </section>

              <div className={styles.divider} />

              {/* Stats */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>Stats</div>
                <div className={styles.stats}>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}><TextT size={12} /> Words</span>
                    <span className={styles.statValue}>{entity.wordCount.toLocaleString()}</span>
                  </div>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}><Hash size={12} /> Characters</span>
                    <span className={styles.statValue}>{entity.charCount.toLocaleString()}</span>
                  </div>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}><ArrowsOut size={12} /> File size</span>
                    <span className={styles.statValue}>{formatFileSize(entity.fileSize)}</span>
                  </div>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}><Eye size={12} /> Read time</span>
                    <span className={styles.statValue}>
                      ~{Math.max(1, Math.round(entity.wordCount / 200))} min
                    </span>
                  </div>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}><PencilLine size={12} /> Created</span>
                    <span className={styles.statValue}>{formatDate(entity.createdAt)}</span>
                  </div>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}><Clock size={12} /> Modified</span>
                    <span className={styles.statValue}>{relativeTime(entity.modifiedAt)}</span>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <div className={styles.emptyState}>
              <FileText size={32} weight="thin" color="var(--text-tertiary)" />
              <p>Select a file to view its properties</p>
            </div>
          )}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar className={styles.scrollbar} orientation="vertical">
          <ScrollArea.Thumb className={styles.scrollThumb} />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  );
}
