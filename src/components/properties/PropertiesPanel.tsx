import React, { useState, useRef, useMemo } from 'react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import * as Select from '@radix-ui/react-select';
import {
  X, Hash, Calendar, Tag, TextT,
  ArrowUpRight, Plus, ArrowsOut,
  FileText, Clock, PencilLine, Eye, CaretUpDown, Shapes,
  CaretDown,
} from '@phosphor-icons/react';
import { useUIStore } from '../../store/ui.store';
import { useVaultData, useVaultStore } from '../../store/vault.store';
import { useShallow } from 'zustand/react/shallow';
import DynamicIcon from '../ui/DynamicIcon';
import Switch from '../ui/Switch';
import IconWrapper from '../ui/IconWrapper';
import PanelHeader from '../ui/PanelHeader';
import SubHeader from '../ui/SubHeader';
import RelationPickerDialog from '../relations/RelationPickerDialog';
import EntityHistory from './EntityHistory';
import { parseCustomDate, parseCustomDateRange, getDaysInMonth } from '../../services/calendar.service';
import styles from './PropertiesPanel.module.css';
import type { FieldDefinition, RelationKind, PresetRelation, CustomDate, CustomDateRange } from '../../types';

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
  let icon;
  switch (type) {
    case 'date':
    case 'custom-date':
    case 'custom-date-range': icon = <Calendar size={size} />; break;
    case 'tags':    icon = <Tag size={size} />; break;
    case 'number':  icon = <Hash size={size} />; break;
    default:        icon = <TextT size={size} />;
  }
  return <IconWrapper>{icon}</IconWrapper>;
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

// ─── Months input ─────────────────────────────────────────


// ─── Inline relation picker ───────────────────────────────

interface InlineRelationPickerProps {
  ids: string[];
  field: FieldDefinition;
  entities: ReturnType<typeof useVaultData>['entities'];
  schemas: ReturnType<typeof useVaultData>['schemas'];
  onSave: (key: string, value: string[]) => void;
}

function InlineRelationPicker({ ids, field, entities, schemas, onSave }: InlineRelationPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const allowedTypes = field.relatesTo ?? [];

  // Typed relations (relatesTo defined) are single-value; untyped allow multiple
  const isSingle = allowedTypes.length > 0;

  const candidates = useMemo(() => {
    const q = query.toLowerCase().trim();
    return entities
      .filter((e) => !e.archived && !ids.includes(e.id))
      .filter((e) => allowedTypes.length === 0 || allowedTypes.includes(e.type))
      .filter((e) => !q || e.title.toLowerCase().includes(q) || e.type.toLowerCase().includes(q))
      .slice(0, 8);
  }, [entities, ids, allowedTypes, query]);

  function addEntity(entityId: string) {
    onSave(field.key, unique([...ids, entityId]));
    setQuery('');
    setOpen(false);
  }

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
      {(!isSingle || ids.length === 0) && (
        <div className={styles.relInlineSearch}>
          <input
            className={styles.relSearchInput}
            placeholder="Search…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {open && candidates.length > 0 && (
            <div className={styles.relDropdown}>
              {candidates.map((e) => {
                const sc = schemas.find((s) => s.name === e.type);
                return (
                  <button
                    key={e.id}
                    type="button"
                    className={styles.relDropdownItem}
                    onMouseDown={(ev) => { ev.preventDefault(); addEntity(e.id); }}
                  >
                    {sc && <DynamicIcon name={sc.icon} size={10} color={sc.color} />}
                    <span className={styles.relDropdownTitle}>{e.title}</span>
                    {allowedTypes.length !== 1 && (
                      <span className={styles.relDropdownType}>{e.type}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Custom date input ────────────────────────────────────

interface CustomDateInputProps {
  fieldKey: string;
  value: unknown;
  onSave: (key: string, value: CustomDate | undefined) => void;
}

function CustomDateInput({ fieldKey, value, onSave }: CustomDateInputProps) {
  const calendar = useVaultStore((s) => s.calendar);
  const parsed = parseCustomDate(value);
  const [year,  setYear]  = useState(parsed?.year  ?? 1);
  const [month, setMonth] = useState(parsed?.month ?? 1);
  const [day,   setDay]   = useState(parsed?.day   ?? 1);

  const months = calendar?.months ?? [];
  const maxDay = calendar ? getDaysInMonth(calendar, year, month) : 30;

  function commit(overrides: Partial<{ year: number; month: number; day: number }> = {}) {
    const y = overrides.year  ?? year;
    const m = overrides.month ?? month;
    const maxD = calendar ? getDaysInMonth(calendar, y, m) : 30;
    const d = Math.min(overrides.day ?? day, maxD);
    onSave(fieldKey, { year: y, month: m, day: d });
  }

  return (
    <div className={styles.fantasyDateWrap}>
      <div className={styles.fantasyDateRow}>
        <input
          type="number"
          className={styles.fantasyDateYear}
          value={year}
          placeholder="Year"
          onChange={(e) => { const v = Number(e.target.value) || 0; setYear(v); commit({ year: v }); }}
        />
        {months.length > 0 ? (
          <select
            className={styles.fantasyDateSelect}
            value={month}
            onChange={(e) => {
              const v = Number(e.target.value);
              setMonth(v);
              setDay((d) => Math.min(d, calendar ? getDaysInMonth(calendar, year, v) : 30));
              commit({ month: v });
            }}
          >
            {months.map((m, i) => (
              <option key={m.name} value={i + 1}>{m.name}</option>
            ))}
          </select>
        ) : (
          <input
            type="number"
            className={styles.fantasyDateSelect}
            value={month}
            min={1}
            placeholder="Month"
            title="Configure a calendar in the Timeline view to get month names"
            onChange={(e) => { const v = Math.max(1, Number(e.target.value) || 1); setMonth(v); commit({ month: v }); }}
          />
        )}
        <input
          type="number"
          className={styles.fantasyDateDay}
          value={day}
          min={1}
          max={maxDay}
          placeholder="Day"
          onChange={(e) => { const v = Math.min(maxDay, Math.max(1, Number(e.target.value) || 1)); setDay(v); commit({ day: v }); }}
        />
      </div>
    </div>
  );
}

// ─── Custom date range input ──────────────────────────────

interface CustomDateRangeInputProps {
  fieldKey: string;
  value: unknown;
  onSave: (key: string, value: CustomDateRange | undefined) => void;
}


function CustomDateRangeInput({ fieldKey, value, onSave }: CustomDateRangeInputProps) {
  const calendar = useVaultStore((s) => s.calendar);
  const parsed = parseCustomDateRange(value);

  const [sYear,  setSYear]  = useState(parsed?.start.year  ?? 1);
  const [sMonth, setSMonth] = useState(parsed?.start.month ?? 1);
  const [sDay,   setSDay]   = useState(parsed?.start.day   ?? 1);
  const [eYear,  setEYear]  = useState(parsed?.end?.year   ?? 1);
  const [eMonth, setEMonth] = useState(parsed?.end?.month  ?? 1);
  const [eDay,   setEDay]   = useState(parsed?.end?.day    ?? 1);
  const [ongoing, setOngoing] = useState(parsed?.ongoing ?? false);

  const months = calendar?.months ?? [];

  function commit(o: {
    sYear?: number; sMonth?: number; sDay?: number;
    eYear?: number; eMonth?: number; eDay?: number;
    ongoing?: boolean;
  } = {}) {
    const sy = o.sYear ?? sYear, sm = o.sMonth ?? sMonth;
    const maxSD = calendar ? getDaysInMonth(calendar, sy, sm) : 30;
    const sd = Math.min(o.sDay ?? sDay, maxSD);
    const isOngoing = o.ongoing ?? ongoing;
    if (isOngoing) {
      onSave(fieldKey, { start: { year: sy, month: sm, day: sd }, ongoing: true });
    } else {
      const ey = o.eYear ?? eYear, em = o.eMonth ?? eMonth;
      const maxED = calendar ? getDaysInMonth(calendar, ey, em) : 30;
      const ed = Math.min(o.eDay ?? eDay, maxED);
      onSave(fieldKey, {
        start: { year: sy, month: sm, day: sd },
        end:   { year: ey, month: em, day: ed },
        ongoing: false,
      });
    }
  }

  return (
    <div className={styles.dateRangeWrap}>
      <div className={styles.fantasyDateRow}>
        <span className={styles.dateRangeSegLabel}>From</span>
        <input type="number" className={styles.fantasyDateYear} value={sYear} placeholder="Year"
          onChange={(e) => { const v = Number(e.target.value) || 0; setSYear(v); commit({ sYear: v }); }} />
        {months.length > 0 ? (
          <select className={styles.fantasyDateSelect} value={sMonth}
            onChange={(e) => { const v = Number(e.target.value); setSMonth(v); commit({ sMonth: v }); }}>
            {months.map((m, i) => <option key={m.name} value={i + 1}>{m.name}</option>)}
          </select>
        ) : (
          <input type="number" className={styles.fantasyDateSelect} value={sMonth} min={1} placeholder="Mo"
            onChange={(e) => { const v = Math.max(1, Number(e.target.value) || 1); setSMonth(v); commit({ sMonth: v }); }} />
        )}
        <input type="number" className={styles.fantasyDateDay} value={sDay} min={1}
          max={calendar ? getDaysInMonth(calendar, sYear, sMonth) : 30} placeholder="Day"
          onChange={(e) => { const v = Math.min(calendar ? getDaysInMonth(calendar, sYear, sMonth) : 30, Math.max(1, Number(e.target.value) || 1)); setSDay(v); commit({ sDay: v }); }} />
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={ongoing}
        className={`${styles.ongoingToggle} ${ongoing ? styles.ongoingToggleOn : ''}`}
        onClick={() => setOngoing((o) => { commit({ ongoing: !o }); return !o; })}
      >
        {ongoing ? 'Ongoing / unknown end' : 'Has end date'}
      </button>
      {!ongoing && (
        <div className={styles.fantasyDateRow}>
          <span className={styles.dateRangeSegLabel}>To</span>
          <input type="number" className={styles.fantasyDateYear} value={eYear} placeholder="Year"
            onChange={(e) => { const v = Number(e.target.value) || 0; setEYear(v); commit({ eYear: v }); }} />
          {months.length > 0 ? (
            <select className={styles.fantasyDateSelect} value={eMonth}
              onChange={(e) => { const v = Number(e.target.value); setEMonth(v); commit({ eMonth: v }); }}>
              {months.map((m, i) => <option key={m.name} value={i + 1}>{m.name}</option>)}
            </select>
          ) : (
            <input type="number" className={styles.fantasyDateSelect} value={eMonth} min={1} placeholder="Mo"
              onChange={(e) => { const v = Math.max(1, Number(e.target.value) || 1); setEMonth(v); commit({ eMonth: v }); }} />
          )}
          <input type="number" className={styles.fantasyDateDay} value={eDay} min={1}
            max={calendar ? getDaysInMonth(calendar, eYear, eMonth) : 30} placeholder="Day"
            onChange={(e) => { const v = Math.min(calendar ? getDaysInMonth(calendar, eYear, eMonth) : 30, Math.max(1, Number(e.target.value) || 1)); setEDay(v); commit({ eDay: v }); }} />
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
}

function FieldInput({ field, value, onSave, entities = [], schemas = [] }: FieldInputProps) {
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
      <Switch
        checked={checked}
        onCheckedChange={(val) => onSave(field.key, val)}
        aria-label={field.label}
      />
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
    return (
      <InlineRelationPicker
        ids={ids}
        field={field}
        entities={entities}
        schemas={schemas}
        onSave={onSave}
      />
    );
  }

  if (field.type === 'custom-date') {
    return <CustomDateInput fieldKey={field.key} value={value} onSave={onSave} />;
  }

  if (field.type === 'custom-date-range') {
    return <CustomDateRangeInput fieldKey={field.key} value={value} onSave={onSave} />;
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
  { value: 'text',              label: 'Text' },
  { value: 'number',            label: 'Number' },
  { value: 'boolean',           label: 'Toggle' },
  { value: 'textarea',          label: 'Long text' },
  { value: 'date',              label: 'Date' },
  { value: 'custom-date',       label: 'Custom Date' },
  { value: 'custom-date-range', label: 'Custom Date Range' },
  { value: 'tags',              label: 'Tags' },
  { value: 'select',            label: 'Select' },
  { value: 'relation',          label: 'Relation' },
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

  const [pickerOpen, setPickerOpen]               = useState(false);
  const [addingProp, setAddingProp]               = useState(false);
  const [newPropLabel, setNewPropLabel]           = useState('');
  const [newPropType, setNewPropType]             = useState('text');
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

  const presetRelations: PresetRelation[] = schema?.presetRelations ?? [];

  /** Find the currently selected entity ID for a preset relation slot. */
  function getPresetValue(pr: PresetRelation): string {
    if (!entity) return '';
    const ids = (entity.frontmatter[`_${pr.kind}`] as string[] | undefined) ?? [];
    return ids.find((id) => entities.find((e) => e.id === id)?.type === pr.targetType) ?? '';
  }

  function handlePresetChange(pr: PresetRelation, newId: string) {
    if (!entity) return;
    const oldId = getPresetValue(pr);
    if (oldId === newId) return;
    if (oldId) void removeRelation(entity.id, oldId, pr.kind);
    if (newId) void addRelation(entity.id, newId, pr.kind);
  }

  // IDs already shown via preset slots — exclude from freeform groups to avoid duplicates
  const presetCoveredIds = new Set(presetRelations.map(getPresetValue).filter(Boolean));

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
    const newField: CustomField = { key, label: newPropLabel.trim(), type: newPropType };
    const updated: CustomField[] = [...customFields, newField];
    void patchEntityFrontmatter(entity, { __customFields: updated });
    setNewPropLabel('');
    setNewPropType('text');
    setAddingProp(false);
  }

  function handleUpdateCustomPropMeta(key: string, patch: Partial<CustomField>) {
    if (!entity) return;
    const updated = customFields.map((f) => f.key === key ? { ...f, ...patch } : f);
    void patchEntityFrontmatter(entity, { __customFields: updated });
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
      <PanelHeader
        title="Metadata"
        onClose={() => setPropertiesPanelOpen(false)}
      />



      <ScrollArea.Root className={styles.scrollRoot}>
        <ScrollArea.Viewport className={styles.scrollViewport}>
          {entity ? (
            <>
              {/* Properties: type + schema-defined fields */}
              <section className={styles.section}>
                <SubHeader title="Properties" open={propsOpen} onToggle={() => toggleSection('pp-props', setPropsOpen)} />
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
                            field={cf as FieldDefinition}
                            value={cfValue}
                            onSave={handleFieldSave}
                            entities={entities}
                            schemas={schemas}


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
                      <Select.Root
                        value={newPropType}
                        onValueChange={(v) => setNewPropType(v)}
                      >
                        <Select.Trigger asChild>
                          <button className={styles.addPropTypeBtn}>
                            <span>{CUSTOM_PROP_TYPES.find((t) => t.value === newPropType)?.label ?? newPropType}</span>
                            <CaretDown size={9} />
                          </button>
                        </Select.Trigger>
                        <Select.Portal>
                          <Select.Content className={styles.typeSelectContent} position="popper" sideOffset={4}>
                            <Select.Viewport>
                              {CUSTOM_PROP_TYPES.map((t) => (
                                <Select.Item key={t.value} value={t.value} className={styles.typeSelectItem}>
                                  <Select.ItemText>{t.label}</Select.ItemText>
                                </Select.Item>
                              ))}
                            </Select.Viewport>
                          </Select.Content>
                        </Select.Portal>
                      </Select.Root>
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
                <SubHeader title="Relations" open={relationsOpen} onToggle={() => toggleSection('pp-relations', setRelationsOpen)} />
                {relationsOpen && <div className={styles.relations}>
                  {/* Preset (schema-level) relations — shown first */}
                  {presetRelations.map((pr, i) => {
                    const currentId = getPresetValue(pr);
                    const candidates = entities.filter((e) => e.type === pr.targetType && !e.archived);
                    const current = currentId ? entities.find((e) => e.id === currentId) : null;
                    const cSchema = current ? schemas.find((s) => s.name === current.type) : null;
                    const cIcon  = current?.icon ?? cSchema?.icon ?? 'File';
                    const cColor = current?.color ?? cSchema?.color ?? 'var(--text-tertiary)';
                    return (
                      <div key={i} className={styles.presetRelGroup}>
                        <div className={styles.presetRelLabel}>{pr.label}</div>
                        <Select.Root
                          value={currentId || '__none__'}
                          onValueChange={(v) => handlePresetChange(pr, v === '__none__' ? '' : v)}
                        >
                          <Select.Trigger asChild>
                            <button className={styles.presetRelTrigger}>
                              {current ? (
                                <>
                                  <DynamicIcon name={cIcon} size={11} color={cColor} weight="duotone" />
                                  <span className={styles.presetRelTriggerText}>{current.title}</span>
                                </>
                              ) : (
                                <span className={styles.presetRelPlaceholder}>Select {pr.targetType}…</span>
                              )}
                              <CaretUpDown size={10} className={styles.presetRelCaret} />
                            </button>
                          </Select.Trigger>
                          <Select.Portal>
                            <Select.Content className={styles.presetRelContent} position="popper" sideOffset={4}>
                              <Select.Viewport>
                                <Select.Item value="__none__" className={styles.presetRelItem}>
                                  <Select.ItemText>None</Select.ItemText>
                                </Select.Item>
                                {candidates.map((e) => {
                                  const eSchema = schemas.find((s) => s.name === e.type);
                                  const eIcon  = e.icon ?? eSchema?.icon ?? 'File';
                                  const eColor = e.color ?? eSchema?.color ?? 'var(--text-tertiary)';
                                  return (
                                    <Select.Item key={e.id} value={e.id} className={styles.presetRelItem}>
                                      <Select.ItemText>
                                        <span className={styles.presetRelItemInner}>
                                          <DynamicIcon name={eIcon} size={11} color={eColor} weight="duotone" />
                                          {e.title}
                                        </span>
                                      </Select.ItemText>
                                    </Select.Item>
                                  );
                                })}
                              </Select.Viewport>
                            </Select.Content>
                          </Select.Portal>
                        </Select.Root>
                      </div>
                    );
                  })}

                  {/* Divider if both preset and freeform relations exist */}
                  {presetRelations.length > 0 && existingTargetIds.some((id) => !presetCoveredIds.has(id)) && (
                    <div className={styles.relDivider} />
                  )}

                  {/* Freeform relations (excluding preset-covered IDs) */}
                  {existingTargetIds.filter((id) => !presetCoveredIds.has(id)).length === 0 &&
                    presetRelations.length === 0 && (
                      <span className={styles.emptyHint}>No relations yet</span>
                    )}
                  {RELATION_GROUPS.map(({ kind, label, key }) => {
                    const ids = ((entity.frontmatter[key] as string[] | undefined) ?? [])
                      .filter((id) => !presetCoveredIds.has(id));
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
                <SubHeader title="Stats" open={statsOpen} onToggle={() => toggleSection('pp-stats', setStatsOpen)} />
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
