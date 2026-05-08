import React, { useState, useRef, useMemo } from 'react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import * as Select from '@radix-ui/react-select';
import {
  X, Hash, Calendar, Tag, TextT,
  ArrowUpRight, Plus, ArrowsOut,
  FileText, Clock, PencilLine, Eye, CaretUpDown, Shapes,
  CaretDown, CaretRight,
} from '@phosphor-icons/react';
import { useUIStore } from '../../store/ui.store';
import { useVaultData, useVaultStore } from '../../store/vault.store';
import { useShallow } from 'zustand/react/shallow';
import DynamicIcon from '../ui/DynamicIcon';
import RelationPickerDialog from '../relations/RelationPickerDialog';
import EntityHistory from './EntityHistory';
import styles from './PropertiesPanel.module.css';
import type { FieldDefinition, RelationKind } from '../../types';

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

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

// ─── Tag input ────────────────────────────────────────────

interface TagInputProps {
  fieldKey: string;
  value: unknown;
  onSave: (key: string, value: string[]) => void;
  entities: ReturnType<typeof useVaultData>['entities'];
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) return (value as string[]).filter((t) => typeof t === 'string' && t);
  if (typeof value === 'string' && value.trim())
    return value.split(',').map((t) => t.trim()).filter(Boolean);
  return [];
}

function TagInput({ fieldKey, value, onSave, entities }: TagInputProps) {
  const tags = parseTags(value);
  const [inputVal, setInputVal] = useState('');
  const [focused, setFocused] = useState(false);

  const allVaultTags = useMemo(() => {
    const set = new Set<string>();
    for (const e of entities) {
      const v = e.frontmatter[fieldKey];
      parseTags(v).forEach((t) => set.add(t));
    }
    return [...set].sort();
  }, [entities, fieldKey]);

  const suggestions = focused && inputVal.trim()
    ? allVaultTags.filter(
        (t) => t.toLowerCase().includes(inputVal.toLowerCase()) && !tags.includes(t),
      )
    : [];

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase();
    if (!tag || tags.includes(tag)) { setInputVal(''); return; }
    onSave(fieldKey, [...tags, tag]);
    setInputVal('');
  }

  return (
    <div className={styles.tagWrap}>
      {/* Input first */}
      <div className={styles.tagInputRow}>
        <input
          className={styles.tagInput}
          value={inputVal}
          placeholder="Add tag…"
          onChange={(e) => setInputVal(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              if (inputVal.trim()) addTag(inputVal);
            }
            if (e.key === 'Backspace' && !inputVal && tags.length > 0) {
              onSave(fieldKey, tags.slice(0, -1));
            }
          }}
        />
      </div>
      {/* Floating suggestions dropdown */}
      {suggestions.length > 0 && (
        <div className={styles.tagSuggestions}>
          {suggestions.slice(0, 6).map((tag) => (
            <button
              key={tag}
              type="button"
              className={styles.tagSuggestion}
              onMouseDown={(e) => { e.preventDefault(); addTag(tag); }}
            >
              <span className={styles.tagHash}>#</span>{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Editable field input ─────────────────────────────────

interface FieldInputProps {
  field: FieldDefinition;
  value: unknown;
  onSave: (key: string, value: unknown) => void;
  entities?: ReturnType<typeof useVaultData>['entities'];
  schemas?: ReturnType<typeof useVaultData>['schemas'];
  sourceEntityId?: string;
}

function FieldInput({ field, value, onSave, entities = [], schemas = [], sourceEntityId }: FieldInputProps) {
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

  if (field.type === 'tags') {
    return (
      <TagInput
        fieldKey={field.key}
        value={value}
        onSave={(key, val) => onSave(key, val)}
        entities={entities}
      />
    );
  }

  if (field.type === 'relation') {
    const ids: string[] = Array.isArray(value) ? (value as string[]) : [];
    const [relPickerOpen, setRelPickerOpen] = useState(false);
    const allowedTypes = field.relatesTo ?? [];
    const source = sourceEntityId ? entities.find((e) => e.id === sourceEntityId) : undefined;
    return (
      <div className={styles.relFieldWrap}>
        {ids.map((id) => {
          const target = entities.find((e) => e.id === id);
          const tSchema = target ? schemas.find((s) => s.name === target.type) : null;
          return (
            <span key={id} className={styles.relChip}>
              {tSchema && <DynamicIcon name={tSchema.icon} size={10} color={tSchema.color} />}
              <span>{target?.title ?? id}</span>
              <button
                type="button"
                className={styles.relChipRemove}
                onClick={() => onSave(field.key, ids.filter((i) => i !== id))}
                aria-label="Remove"
              >
                <X size={9} />
              </button>
            </span>
          );
        })}
        <button type="button" className={styles.relFieldAdd} onClick={() => setRelPickerOpen(true)}>
          <Plus size={10} />
          Add
        </button>
        {source && (
          <RelationPickerDialog
            open={relPickerOpen}
            sourceEntity={source}
            existingTargetIds={ids}
            entities={entities}
            schemas={schemas}
            defaultKind="relatedTo"
            filterTypes={allowedTypes.length > 0 ? allowedTypes : undefined}
            onSelect={(targetId) => onSave(field.key, unique([...ids, targetId]))}
            onClose={() => setRelPickerOpen(false)}
          />
        )}
      </div>
    );
  }

  // text, date, select → text input
  return (
    <input
      type="text"
      className={styles.fieldInput}
      value={localVal}
      placeholder="—"
      onChange={(e) => schedule(e.target.value)}
    />
  );
}

// ─── Custom field types ───────────────────────────────────

interface CustomField {
  key: string;
  label: string;
  type: string;
}

const CUSTOM_PROP_TYPES = [
  { value: 'text',     label: 'Text' },
  { value: 'number',   label: 'Number' },
  { value: 'boolean',  label: 'Toggle' },
  { value: 'textarea', label: 'Long text' },
  { value: 'date',     label: 'Date' },
  { value: 'tags',     label: 'Tags' },
];

function toKey(label: string): string {
  return label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

// ─── Main panel ───────────────────────────────────────────

export default function PropertiesPanel() {
  const { activeEntityId, setActiveEntityId, setPropertiesPanelOpen } = useUIStore(
    useShallow((s) => ({
      activeEntityId:         s.activeEntityId,
      setActiveEntityId:      s.setActiveEntityId,
      setPropertiesPanelOpen: s.setPropertiesPanelOpen,
    })),
  );
  const { entities, schemas } = useVaultData();
  const patchEntityFrontmatter = useVaultStore((s) => s.patchEntityFrontmatter);
  const addRelation             = useVaultStore((s) => s.addRelation);
  const removeRelation          = useVaultStore((s) => s.removeRelation);

  const [pickerOpen, setPickerOpen]         = useState(false);
  const [addingProp, setAddingProp]         = useState(false);
  const [newPropLabel, setNewPropLabel]     = useState('');
  const [newPropType, setNewPropType]       = useState('text');
  const [propsOpen, setPropsOpen]         = useState(() => localStorage.getItem('pp-props') !== 'false');
  const [relationsOpen, setRelationsOpen] = useState(() => localStorage.getItem('pp-relations') !== 'false');
  const [statsOpen, setStatsOpen]         = useState(() => localStorage.getItem('pp-stats') !== 'false');

  function toggleSection(key: string, setter: React.Dispatch<React.SetStateAction<boolean>>) {
    setter((o) => { localStorage.setItem(key, String(!o)); return !o; });
  }

  const entity = entities.find((e) => e.id === activeEntityId) ?? null;
  const schema = entity ? schemas.find((s) => s.name === entity.type) : null;

  const userFields = schema?.fields.map((field) => ({
    ...field,
    value: entity?.frontmatter[field.key],
  })) ?? [];

  const RELATION_GROUPS: { kind: RelationKind; label: string; key: string }[] = [
    { kind: 'parentOf',  label: 'Parent of',  key: '_parentOf'  },
    { kind: 'childOf',   label: 'Child of',   key: '_childOf'   },
    { kind: 'siblingOf', label: 'Sibling of', key: '_siblingOf' },
    { kind: 'relatedTo', label: 'Related to', key: '_relatedTo' },
  ];

  const existingTargetIds = entity
    ? RELATION_GROUPS.flatMap(({ key }) =>
        (entity.frontmatter[key] as string[] | undefined) ?? [],
      )
    : [];

  function handleFieldSave(key: string, value: unknown) {
    if (!entity) return;
    void patchEntityFrontmatter(entity, { [key]: value });
  }

  function handleAddRelation(targetId: string, kind: RelationKind) {
    if (!entity) return;
    void addRelation(entity.id, targetId, kind);
  }

  function handleRemoveRelation(targetId: string, kind: RelationKind) {
    if (!entity) return;
    void removeRelation(entity.id, targetId, kind);
  }

  // ── Custom per-entity properties ──────────────────────────
  const customFields: CustomField[] = useMemo(
    () => (entity?.frontmatter.__customFields as CustomField[] | undefined) ?? [],
    [entity?.frontmatter.__customFields], // eslint-disable-line react-hooks/exhaustive-deps
  );

  function handleAddCustomProp() {
    if (!entity || !newPropLabel.trim()) return;
    const key = toKey(newPropLabel);
    if (!key || customFields.find((f) => f.key === key)) return;
    const updated: CustomField[] = [...customFields, { key, label: newPropLabel.trim(), type: newPropType }];
    void patchEntityFrontmatter(entity, { __customFields: updated });
    setNewPropLabel('');
    setNewPropType('text');
    setAddingProp(false);
  }

  function handleRemoveCustomProp(key: string) {
    if (!entity) return;
    const updated = customFields.filter((f) => f.key !== key);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: Record<string, any> = { __customFields: updated };
    patch[key] = undefined; // clear value too
    void patchEntityFrontmatter(entity, patch);
  }

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerMeta}>
          <span className={styles.headerTitle}>Metadata</span>
        </div>
        <button
          className={styles.closeBtn}
          onClick={() => setPropertiesPanelOpen(false)}
          aria-label="Close properties"
        >
          <X size={14} />
        </button>
      </div>


      <ScrollArea.Root className={styles.scrollRoot}>
        <ScrollArea.Viewport className={styles.scrollViewport}>
          {entity ? (
            <>
              {/* Properties: type + schema-defined fields */}
              <section className={styles.section}>
                <button className={styles.sectionToggle} onClick={() => toggleSection('pp-props', setPropsOpen)}>
                  {propsOpen ? <CaretDown size={10} /> : <CaretRight size={10} />}
                  <span>Properties</span>
                </button>
                {propsOpen && <div className={styles.fields}>
                  {/* Type row */}
                  <div className={styles.field}>
                    <div className={styles.fieldLabel}>
                      <Shapes size={12} />
                      <span>Type</span>
                    </div>
                    <div className={styles.fieldValueWrap}>
                      <Select.Root
                        value={entity.type}
                        onValueChange={(newType) => void patchEntityFrontmatter(entity, { __type: newType })}
                      >
                        <Select.Trigger asChild>
                          <button className={styles.typeSelectInline}>
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
                  </div>
                  {/* Schema fields */}
                  {userFields.map((field) => {
                    const isTag = field.type === 'tags';
                    const tagList = isTag ? parseTags(field.value) : [];
                    return (
                      <div
                        key={`${entity.id}-${field.key}`}
                        className={isTag ? styles.fieldTag : styles.field}
                      >
                        <div className={styles.fieldLabel}>
                          <FieldIcon type={field.type} />
                          <span>{field.label}</span>
                        </div>
                        <div className={styles.fieldValueWrap}>
                          <FieldInput
                            field={field}
                            value={field.value}
                            onSave={handleFieldSave}
                            entities={entities}
                            schemas={schemas}
                            sourceEntityId={entity?.id}
                          />
                        </div>
                        {isTag && tagList.length > 0 && (
                          <div className={styles.tagPillsRow}>
                            {tagList.map((tag) => (
                              <span key={tag} className={styles.tagPill}>
                                <span className={styles.tagHash}>#</span>{tag}
                                <button
                                  type="button"
                                  className={styles.tagPillRemove}
                                  onMouseDown={(e) => { e.preventDefault(); handleFieldSave(field.key, tagList.filter((t) => t !== tag)); }}
                                  aria-label={`Remove ${tag}`}
                                ><X size={9} /></button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {/* Custom per-entity fields */}
                  {customFields.map((cf) => {
                    const isTag = cf.type === 'tags';
                    const cfValue = entity.frontmatter[cf.key];
                    const tagList = isTag ? parseTags(cfValue) : [];
                    return (
                      <div
                        key={`${entity.id}-custom-${cf.key}`}
                        className={isTag ? styles.fieldTag : styles.field}
                      >
                        <div className={styles.fieldLabel}>
                          <FieldIcon type={cf.type} />
                          <span>{cf.label}</span>
                        </div>
                        <div className={styles.fieldValueWrap}>
                          <FieldInput
                            field={cf}
                            value={cfValue}
                            onSave={handleFieldSave}
                            entities={entities}
                            schemas={schemas}
                            sourceEntityId={entity?.id}
                          />
                        </div>
                        <button
                          type="button"
                          className={styles.removePropBtn}
                          onClick={() => handleRemoveCustomProp(cf.key)}
                          aria-label={`Remove ${cf.label}`}
                        >
                          <X size={10} />
                        </button>
                        {isTag && tagList.length > 0 && (
                          <div className={styles.tagPillsRow}>
                            {tagList.map((tag) => (
                              <span key={tag} className={styles.tagPill}>
                                <span className={styles.tagHash}>#</span>{tag}
                                <button
                                  type="button"
                                  className={styles.tagPillRemove}
                                  onMouseDown={(e) => { e.preventDefault(); handleFieldSave(cf.key, tagList.filter((t) => t !== tag)); }}
                                  aria-label={`Remove ${tag}`}
                                ><X size={9} /></button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {/* Add property form */}
                  {addingProp ? (
                    <div className={styles.addPropForm}>
                      <input
                        className={styles.addPropInput}
                        placeholder="Property name"
                        value={newPropLabel}
                        autoFocus
                        onChange={(e) => setNewPropLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddCustomProp();
                          if (e.key === 'Escape') { setAddingProp(false); setNewPropLabel(''); }
                        }}
                      />
                      <select
                        className={styles.addPropSelect}
                        value={newPropType}
                        onChange={(e) => setNewPropType(e.target.value)}
                      >
                        {CUSTOM_PROP_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      <div className={styles.addPropActions}>
                        <button
                          type="button"
                          className={styles.addPropConfirm}
                          onClick={handleAddCustomProp}
                          disabled={!newPropLabel.trim()}
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          className={styles.addPropCancel}
                          onClick={() => { setAddingProp(false); setNewPropLabel(''); }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.addPropBtn}
                      onClick={() => setAddingProp(true)}
                    >
                      <Plus size={11} />
                      <span>Add property</span>
                    </button>
                  )}
                </div>}
              </section>

              {/* Relations */}
              <section className={styles.section}>
                <button className={styles.sectionToggle} onClick={() => toggleSection('pp-relations', setRelationsOpen)}>
                  {relationsOpen ? <CaretDown size={10} /> : <CaretRight size={10} />}
                  <span>Relations</span>
                </button>
                {relationsOpen && <div className={styles.relations}>
                  {existingTargetIds.length === 0 && (
                    <span className={styles.emptyHint}>No relations yet</span>
                  )}
                  {RELATION_GROUPS.map(({ kind, label, key }) => {
                    const ids = (entity.frontmatter[key] as string[] | undefined) ?? [];
                    if (ids.length === 0) return null;
                    return (
                      <div key={kind} className={styles.relGroup}>
                        <div className={styles.relGroupLabel}>{label}</div>
                        {ids.map((targetId) => {
                          const target = entities.find((e) => e.id === targetId);
                          const tSchema = target ? schemas.find((s) => s.name === target.type) : null;
                          const tIcon  = target?.icon ?? tSchema?.icon ?? 'File';
                          const tColor = target?.color ?? tSchema?.color ?? 'var(--text-tertiary)';
                          return (
                            <div key={targetId} className={styles.relItem}>
                              <button
                                className={styles.relLink}
                                onClick={() => target && setActiveEntityId(target.id)}
                                title={target ? `Open ${target.title}` : targetId}
                              >
                                <DynamicIcon name={tIcon} size={11} color={tColor} weight="duotone" />
                                <span>{target?.title ?? targetId}</span>
                                {target && <ArrowUpRight size={10} className={styles.relArrow} />}
                              </button>
                              <button
                                className={styles.relRemoveBtn}
                                onClick={() => handleRemoveRelation(targetId, kind)}
                                aria-label="Remove relation"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                  <button className={styles.addRelation} onClick={() => setPickerOpen(true)}>
                    <Plus size={12} />
                    <span>Add relation</span>
                  </button>
                </div>}
              </section>

              {/* Stats */}
              <section className={styles.section}>
                <button className={styles.sectionToggle} onClick={() => toggleSection('pp-stats', setStatsOpen)}>
                  {statsOpen ? <CaretDown size={10} /> : <CaretRight size={10} />}
                  <span>Stats</span>
                </button>
                {statsOpen && <div className={styles.stats}>
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
                </div>}
              </section>

              <EntityHistory entityPath={entity.path} />
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

      {entity && (
        <RelationPickerDialog
          open={pickerOpen}
          sourceEntity={entity}
          existingTargetIds={existingTargetIds}
          entities={entities}
          schemas={schemas}
          onSelect={handleAddRelation}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
