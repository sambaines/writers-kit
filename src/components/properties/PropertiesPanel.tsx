import React, { useState, useRef, useMemo } from 'react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import * as Select from '@radix-ui/react-select';
import * as Popover from '@radix-ui/react-popover';
import {
  X, HashStraight, Calendar, CalendarDots, CalendarX, Tag, Textbox, ToggleLeft, CirclesFour,
  ArrowSquareOut, Plus, BookOpenText, HardDrives, Books, Clock, ClockUser,
  FileText, CaretUpDown, CaretDown, DotsSixVertical,
} from '@phosphor-icons/react';
import IconWrapper from '../ui/IconWrapper';
import { useUIStore } from '../../store/ui.store';
import { useVaultData, useVaultStore } from '../../store/vault.store';
import { useShallow } from 'zustand/react/shallow';
import DynamicIcon from '../ui/DynamicIcon';
import Chip from '../ui/Chip';
import TagsRow from '../ui/TagsRow';
import TagDropdown from '../ui/TagDropdown';
import SelectDropdown from '../ui/SelectDropdown';
import SelectWrapper from '../ui/SelectWrapper';
import type { SelectItem } from '../ui/SelectWrapper';
import Switch from '../ui/Switch';
import Input from '../ui/Input';
import TextArea from '../ui/TextArea';
import PanelHeader from '../ui/PanelHeader';
import SubHeader from '../ui/SubHeader';
import PropertyRow from '../ui/PropertyRow';
import Button from '../ui/Button';
import StatRow from '../ui/StatRow';
import RelationPickerDialog from '../relations/RelationPickerDialog';
import EntityHistory from './EntityHistory';
import { parseCustomDate, parseCustomDateRange, getDaysInMonth } from '../../services/calendar.service';
import styles from './PropertiesPanel.module.css';
import type { FieldDefinition, RelationKind, PresetRelation, CustomDate, CustomDateRange, SchemaDefinition } from '../../types';

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

function getFieldIcon(type: string): React.ReactNode {
  const size = 12;
  switch (type) {
    case 'date':              return <Calendar size={size} />;
    case 'custom-date':       return <CalendarX size={size} />;
    case 'custom-date-range': return <CalendarDots size={size} />;
    case 'tags':              return <Tag size={size} />;
    case 'number':            return <HashStraight size={size} />;
    case 'boolean':           return <ToggleLeft size={size} />;
    case 'select':            return <CirclesFour size={size} />;
    case 'textarea':          return <Textbox size={size} />;
    default:                  return <Textbox size={size} />;
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
  onCreateOption?: (option: string) => void;
}

function FieldInput({ field, value, onSave, entities = [], schemas = [], onCreateOption }: FieldInputProps) {
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
      <TextArea
        value={localVal}
        placeholder="Add text..."
        onChange={(e) => schedule(e.target.value)}
        rows={3}
      />
    );
  }

  if (field.type === 'number') {
    return (
      <Input
        type="number"
        value={localVal}
        onChange={(e) => schedule(e.target.value)}
      />
    );
  }

  if (field.type === 'tags') {
    return null;
  }

  if (field.type === 'select') {
    return (
      <SelectDropdown
        fieldKey={field.key}
        value={typeof value === 'string' ? value : undefined}
        options={field.options ?? []}
        mode={field.selectMode ?? 'options'}
        entities={entities}
        targetType={field.targetType}
        schemas={schemas}
        onSave={onSave}
        onCreateOption={onCreateOption}
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
    <Input
      value={localVal}
      placeholder="Add text..."
      onChange={(e) => schedule(e.target.value)}
    />
  );
}

// ─── Custom field types ───────────────────────────────────

interface CustomField {
  key: string;
  label: string;
  type: string;
  selectMode?: 'options' | 'entity';
  options?: string[];
  targetType?: string;
}

const CUSTOM_PROP_TYPES = [
  { value: 'text',              label: 'Text' },
  { value: 'number',            label: 'Number' },
  { value: 'boolean',           label: 'Toggle' },
  { value: 'textarea',          label: 'Long text' },
  { value: 'date',              label: 'Date' },
  { value: 'custom-date',       label: 'Custom Date' },
  { value: 'custom-date-range', label: 'Custom Date Range' },
  { value: 'select',            label: 'Select' },
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

  const patchEntityFrontmatter  = useVaultStore((s) => s.patchEntityFrontmatter);
  const addRelation             = useVaultStore((s) => s.addRelation);
  const removeRelation          = useVaultStore((s) => s.removeRelation);
  const updateSchemaFieldOrder  = useVaultStore((s) => s.updateSchemaFieldOrder);

  const [typeSelectOpen, setTypeSelectOpen]       = useState(false);
  const [typeSelectQuery, setTypeSelectQuery]     = useState('');
  const [pickerOpen, setPickerOpen]               = useState(false);
  const [addingProp, setAddingProp]                     = useState(false);
  const [newPropLabel, setNewPropLabel]                 = useState('');
  const [newPropType, setNewPropType]                   = useState('text');
  const [newPropSelectMode, setNewPropSelectMode]       = useState<'options' | 'entity'>('options');
  const [newPropOptions, setNewPropOptions]             = useState('');
  const [newPropTargetType, setNewPropTargetType]       = useState('');
  const [propsOpen, setPropsOpen]         = useState(() => localStorage.getItem('pp-props') !== 'false');
  const [relationsOpen, setRelationsOpen] = useState(() => localStorage.getItem('pp-relations') !== 'false');
  const [statsOpen, setStatsOpen]         = useState(() => localStorage.getItem('pp-stats') !== 'false');
  const [presetRelOpen, setPresetRelOpen] = useState(-1);
  const [addingRelKind, setAddingRelKind] = useState<RelationKind | null>(null);
  const [addRelQuery, setAddRelQuery]     = useState('');

  // ── Drag state ──────────────────────────────────────────
  const [draggingKey, _setDraggingKey] = useState<string | null>(null);
  const [overIndex, _setOverIndex]     = useState<number>(-1);
  const overIndexRef     = useRef<number>(-1);
  const dragStartIdxRef  = useRef<number>(-1);
  const dragOffsetYRef   = useRef<number>(0);
  const dragCloneRef     = useRef<HTMLDivElement | null>(null);
  const fieldWrapperRefs = useRef<(HTMLElement | null)[]>([]);
  const spacerRefs       = useRef<(HTMLElement | null)[]>([]);

  // ── Portal drag handle state ─────────────────────────────
  const panelRef       = useRef<HTMLDivElement>(null);
  const [handlePos, setHandlePos] = useState<{ key: string; idx: number; top: number; left: number } | null>(null);
  const handleHoverRef = useRef(false);
  const hideTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setDraggingKey(v: string | null) { _setDraggingKey(v); }
  function setOverIndex(v: number)          { overIndexRef.current = v; _setOverIndex(v); }

  function scheduleHide() {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!handleHoverRef.current) setHandlePos(null);
    }, 150);
  }

  function onFieldsMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (draggingKey) return;
    const panel = panelRef.current;
    if (!panel) return;
    const panelRect = panel.getBoundingClientRect();
    for (let i = 0; i < fieldWrapperRefs.current.length; i++) {
      const el = fieldWrapperRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (e.clientY >= r.top && e.clientY < r.bottom) {
        const key = allDraggableItems[i]?.key;
        if (key) {
          if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
          const isTextarea = allDraggableItems[i]?.field.type === 'textarea';
          setHandlePos({ key, idx: i, top: r.top + (isTextarea ? 0 : 4), left: panelRect.left - 20 });
        }
        return;
      }
    }
    scheduleHide();
  }

  function onFieldsMouseLeave() {
    if (!handleHoverRef.current) scheduleHide();
  }

  function toggleSection(key: string, setter: React.Dispatch<React.SetStateAction<boolean>>) {
    setter((o) => { localStorage.setItem(key, String(!o)); return !o; });
  }

  const entity = entities.find((e) => e.id === activeEntityId) ?? null;
  const schema = entity ? schemas.find((s) => s.name === entity.type) : null;

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

  // ── Unified ordered field list (schema + custom, respects fieldOrder) ──
  type DraggableItem =
    | { key: string; isCustom: false; field: FieldDefinition }
    | { key: string; isCustom: true;  field: FieldDefinition; cfField: CustomField };

  const allDraggableItems = useMemo((): DraggableItem[] => {
    if (!entity) return [];
    const seen = new Set<string>();
    const items: DraggableItem[] = [];
    for (const f of schema?.fields ?? []) {
      if (!seen.has(f.key)) { seen.add(f.key); items.push({ key: f.key, isCustom: false, field: f }); }
    }
    for (const cf of customFields) {
      if (!seen.has(cf.key)) { seen.add(cf.key); items.push({ key: cf.key, isCustom: true, field: cf as FieldDefinition, cfField: cf }); }
    }
    const fieldOrder = schema?.fieldOrder ?? [];
    if (fieldOrder.length === 0) return items;
    const remaining = [...items];
    const ordered: DraggableItem[] = [];
    for (const key of fieldOrder) {
      const idx = remaining.findIndex((it) => it.key === key);
      if (idx !== -1) { ordered.push(remaining[idx]); remaining.splice(idx, 1); }
    }
    return [...ordered, ...remaining];
  }, [schema, customFields, entity]); // eslint-disable-line react-hooks/exhaustive-deps

  function reorderItems(keys: string[], from: number, toSpacer: number): string[] {
    const result = [...keys];
    const [removed] = result.splice(from, 1);
    const insertAt = toSpacer > from ? toSpacer - 1 : toSpacer;
    result.splice(insertAt, 0, removed);
    return result;
  }

  function spacerClass(i: number): string {
    if (!draggingKey) return styles.spacer;
    if (overIndex === i) return `${styles.spacer} ${styles.spacerTarget}`;
    return `${styles.spacer} ${styles.spacerVisible}`;
  }

  function handleDragStart(
    e: React.PointerEvent<HTMLButtonElement>,
    fieldKey: string,
    fieldIndex: number,
    currentSchema: SchemaDefinition,
  ) {
    if (!entity) return;
    e.preventDefault();
    e.stopPropagation();

    const containerEl = fieldWrapperRefs.current[fieldIndex];
    if (!containerEl) return;

    const rect = containerEl.getBoundingClientRect();
    dragOffsetYRef.current = e.clientY - rect.top;
    dragStartIdxRef.current = fieldIndex;

    // Snapshot items for this drag session
    const itemsSnapshot = allDraggableItems.map((it) => it.key);

    // Create fixed clone
    const clone = document.createElement('div');
    clone.style.cssText = [
      `position:fixed`,
      `top:${rect.top}px`,
      `left:${rect.left}px`,
      `width:${rect.width}px`,
      `height:${rect.height}px`,
      `z-index:9999`,
      `pointer-events:none`,
      `border-radius:4px`,
      `border:1px solid #323434`,
      `background:#282A2A`,
      `box-shadow:0 4px 16px rgba(0,0,0,0.5),inset 0 0 0 1px rgba(255,255,255,0.04)`,
      `overflow:hidden`,
    ].join(';');
    clone.innerHTML = containerEl.innerHTML;
    document.body.appendChild(clone);
    dragCloneRef.current = clone;

    setDraggingKey(fieldKey);
    setOverIndex(fieldIndex);
    setHandlePos(null);

    function onMove(ev: PointerEvent) {
      if (dragCloneRef.current) {
        dragCloneRef.current.style.top = `${ev.clientY - dragOffsetYRef.current}px`;
      }
      const wrappers = fieldWrapperRefs.current;
      let insertIdx = wrappers.length;
      for (let i = 0; i < wrappers.length; i++) {
        const el = wrappers[i];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (ev.clientY < (r.top + r.bottom) / 2) { insertIdx = i; break; }
      }
      setOverIndex(insertIdx);
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (dragCloneRef.current) {
        document.body.removeChild(dragCloneRef.current);
        dragCloneRef.current = null;
      }
      const from = dragStartIdxRef.current;
      const to   = overIndexRef.current;
      if (from !== -1 && to !== from && to !== from + 1) {
        const newOrder = reorderItems(itemsSnapshot, from, to);
        void updateSchemaFieldOrder(currentSchema.id, newOrder);
      }
      setDraggingKey(null);
      setOverIndex(-1);
      dragStartIdxRef.current = -1;
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function handleAddCustomProp() {
    if (!entity || !newPropLabel.trim()) return;
    const key = toKey(newPropLabel);
    if (!key || customFields.find((f) => f.key === key)) return;
    const newField: CustomField = {
      key,
      label: newPropLabel.trim(),
      type: newPropType,
      ...(newPropType === 'select' ? {
        selectMode: newPropSelectMode,
        ...(newPropSelectMode === 'options' && newPropOptions.trim()
          ? { options: newPropOptions.split(',').map((o) => o.trim()).filter(Boolean) }
          : {}),
        ...(newPropSelectMode === 'entity' && newPropTargetType
          ? { targetType: newPropTargetType }
          : {}),
      } : {}),
    };
    const updated: CustomField[] = [...customFields, newField];
    void patchEntityFrontmatter(entity, { __customFields: updated });
    setNewPropLabel('');
    setNewPropType('text');
    setNewPropSelectMode('options');
    setNewPropOptions('');
    setNewPropTargetType('');
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
    <div ref={panelRef} className={styles.panel}>
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
                {propsOpen && <div className={styles.panelOptions}><div className={styles.fields} onMouseMove={onFieldsMouseMove} onMouseLeave={onFieldsMouseLeave}>
                  {/* Type row */}
                  <PropertyRow icon={<CirclesFour size={12} />} label="Type">
                    <Popover.Root
                      open={typeSelectOpen}
                      onOpenChange={(o) => { setTypeSelectOpen(o); if (!o) setTypeSelectQuery(''); }}
                    >
                      <div className={styles.typeSelectRoot}>
                        <div className={styles.typeSelectRing} />
                        <Popover.Trigger asChild>
                          <button className={styles.typeSelectInline}>
                            {schema && <DynamicIcon name={schema.icon} size={12} color={schema.color} />}
                            <span className={styles.typeSelectText}>{entity.type}</span>
                            <CaretUpDown size={12} className={styles.typeSelectCaret} />
                          </button>
                        </Popover.Trigger>
                      </div>
                      <Popover.Portal>
                        <Popover.Content
                          className={styles.typeSelectPopover}
                          side="bottom"
                          sideOffset={4}
                          align="start"
                          avoidCollisions={false}
                          onOpenAutoFocus={(e) => e.preventDefault()}
                        >
                          <SelectWrapper
                            items={schemas.map((s): SelectItem => ({
                              type: 'option',
                              label: s.name,
                              icon: <DynamicIcon name={s.icon} size={12} />,
                              iconColor: s.color,
                              selected: entity.type === s.name,
                              onClick: () => {
                                void patchEntityFrontmatter(entity, { __type: s.name });
                                setTypeSelectOpen(false);
                              },
                            }))}
                            showSearch
                            searchValue={typeSelectQuery}
                            searchPlaceholder="Search types…"
                            onSearchChange={setTypeSelectQuery}
                            emptyMessage="No types match that search query"
                          />
                        </Popover.Content>
                      </Popover.Portal>
                    </Popover.Root>
                  </PropertyRow>
                  {/* Unified draggable field list (schema + custom, ordered by fieldOrder) */}
                  {allDraggableItems.map((item, i) => {
                    const { key, isCustom, field } = item;
                    const value      = entity.frontmatter[key];
                    const isTag      = field.type === 'tags';
                    const isMultiline = field.type === 'textarea';
                    const tagList    = isTag ? parseTags(value) : [];
                    const createOpt  = isCustom && field.type === 'select' && field.selectMode !== 'entity'
                      ? (option: string) => {
                          const updated = customFields.map((f) =>
                            f.key === key ? { ...f, options: [...(f.options ?? []), option] } : f,
                          );
                          void patchEntityFrontmatter(entity, { __customFields: updated });
                        }
                      : undefined;
                    return (
                      <React.Fragment key={`${entity.id}-${key}`}>
                        <div
                          className={`${styles.spacer} ${draggingKey ? (overIndex === i ? styles.spacerTarget : styles.spacerVisible) : ''}`}
                          ref={(el) => { spacerRefs.current[i] = el; }}
                        />
                        <div
                          className={`${styles.draggableItem}${draggingKey === key ? ` ${styles.draggingGhost}` : ''}`}
                          ref={(el) => { fieldWrapperRefs.current[i] = el; }}
                        >
                          <PropertyRow
                            icon={getFieldIcon(field.type)}
                            label={field.label}
                            multiline={isMultiline}
                            onDelete={isCustom ? () => handleRemoveCustomProp(key) : undefined}
                          >
                            <FieldInput
                              field={field}
                              value={value}
                              onSave={handleFieldSave}
                              entities={entities}
                              schemas={schemas}
                              onCreateOption={createOpt}
                            />
                          </PropertyRow>
                          {isTag && tagList.length > 0 && (
                            <TagsRow>
                              {tagList.map((tag) => (
                                <Chip
                                  key={tag}
                                  label={tag}
                                  leadingIcon={<Tag size={12} />}
                                  onRemove={() => handleFieldSave(key, tagList.filter((t) => t !== tag))}
                                />
                              ))}
                            </TagsRow>
                          )}
                          {isTag && (
                            <TagDropdown
                              fieldKey={key}
                              currentTags={tagList}
                              entities={entities}
                              onSave={handleFieldSave}
                            />
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })}
                  {/* Trailing spacer */}
                  <div
                    className={`${styles.spacer} ${draggingKey ? (overIndex === allDraggableItems.length ? styles.spacerTarget : styles.spacerVisible) : ''}`}
                    ref={(el) => { spacerRefs.current[allDraggableItems.length] = el; }}
                  />
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
                        onValueChange={(v) => { setNewPropType(v); setNewPropSelectMode('options'); setNewPropOptions(''); setNewPropTargetType(''); }}
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
                      {newPropType === 'select' && (
                        <div className={styles.addPropSelectConfig}>
                          <div className={styles.addPropModeRow}>
                            <button
                              type="button"
                              className={`${styles.addPropModeBtn} ${newPropSelectMode === 'options' ? styles.addPropModeBtnActive : ''}`}
                              onClick={() => setNewPropSelectMode('options')}
                            >
                              Options
                            </button>
                            <button
                              type="button"
                              className={`${styles.addPropModeBtn} ${newPropSelectMode === 'entity' ? styles.addPropModeBtnActive : ''}`}
                              onClick={() => setNewPropSelectMode('entity')}
                            >
                              Entity
                            </button>
                          </div>
                          {newPropSelectMode === 'options' ? (
                            <input
                              className={styles.addPropInput}
                              placeholder="Options (comma-separated)"
                              value={newPropOptions}
                              onChange={(e) => setNewPropOptions(e.target.value)}
                            />
                          ) : (
                            <select
                              className={styles.addPropEntityTypeSelect}
                              value={newPropTargetType}
                              onChange={(e) => setNewPropTargetType(e.target.value)}
                            >
                              <option value="">Select entity type…</option>
                              {schemas.map((s) => (
                                <option key={s.name} value={s.name}>{s.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}
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
                          onClick={() => { setAddingProp(false); setNewPropLabel(''); setNewPropSelectMode('options'); setNewPropOptions(''); setNewPropTargetType(''); }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.addPropRow}>
                      <Button
                        leadingIcon={<Plus size={11} />}
                        onClick={() => setAddingProp(true)}
                      >
                        Add property
                      </Button>
                    </div>
                  )}
                </div></div>}
              </section>

              {/* Relations */}
              <section className={styles.section}>
                <SubHeader title="Relations" open={relationsOpen} onToggle={() => toggleSection('pp-relations', setRelationsOpen)} />
                {relationsOpen && <div className={styles.panelOptions}><div className={styles.relations}>
                  {/* Preset (schema-level / type-bound) relations — shown first */}
                  {presetRelations.map((pr, i) => {
                    const currentId = getPresetValue(pr);
                    const candidates = entities.filter((e) => e.type === pr.targetType && !e.archived);
                    const current = currentId ? entities.find((e) => e.id === currentId) : null;
                    const cSchema = current ? schemas.find((s) => s.name === current.type) : null;
                    const cIcon  = current?.icon ?? cSchema?.icon ?? 'File';
                    const cColor = current?.color ?? cSchema?.color ?? 'var(--text-tertiary)';
                    return (
                      <div key={`preset-${pr.targetType}-${i}`} className={styles.presetRelSlot} style={{ paddingTop: i === 0 ? 4 : 8 }}>
                        <div className={styles.presetRelHeading}>
                          <span className={styles.presetRelBelongsTo}>Belongs to</span>
                          <span className={styles.presetRelTypeName}>{pr.targetType}</span>
                        </div>
                        <Popover.Root
                          open={presetRelOpen === i}
                          onOpenChange={(o) => setPresetRelOpen(o ? i : -1)}
                        >
                          <div className={styles.presetRelInput}>
                            <div className={styles.presetRelInputRing} />
                            <Popover.Trigger className={styles.presetRelInputBtn}>
                              {current ? (
                                <>
                                  <DynamicIcon name={cIcon} size={12} color={cColor} />
                                  <span className={styles.presetRelInputText}>{current.title}</span>
                                </>
                              ) : (
                                <span className={styles.presetRelInputPlaceholder}>Select {pr.targetType}…</span>
                              )}
                              <CaretUpDown size={12} className={styles.presetRelInputCaret} />
                            </Popover.Trigger>
                          </div>
                          <Popover.Portal>
                            <Popover.Content
                              className={styles.presetRelPopover}
                              side="bottom"
                              sideOffset={4}
                              align="start"
                              avoidCollisions={false}
                            >
                              <SelectWrapper
                                showSearch
                                searchPlaceholder={`Search ${pr.targetType}s…`}
                                items={[
                                  {
                                    type: 'option' as const,
                                    label: 'None',
                                    selected: !currentId,
                                    onClick: () => { handlePresetChange(pr, ''); setPresetRelOpen(-1); },
                                  },
                                  ...candidates.map((e) => {
                                    const eSchema = schemas.find((s) => s.name === e.type);
                                    const eIcon  = e.icon ?? eSchema?.icon ?? 'File';
                                    const eColor = e.color ?? eSchema?.color ?? 'var(--text-tertiary)';
                                    return {
                                      type: 'option' as const,
                                      label: e.title,
                                      icon: <DynamicIcon name={eIcon} size={12} color={eColor} />,
                                      selected: e.id === currentId,
                                      onClick: () => { handlePresetChange(pr, e.id); setPresetRelOpen(-1); },
                                    };
                                  }),
                                ]}
                              />
                            </Popover.Content>
                          </Popover.Portal>
                        </Popover.Root>
                      </div>
                    );
                  })}

                  {/* Freeform relation groups */}
                  {(() => {
                    const hasFreeformRelations = RELATION_GROUPS.some(({ key }) =>
                      ((entity.frontmatter[key] as string[] | undefined) ?? [])
                        .filter((id) => !presetCoveredIds.has(id)).length > 0
                    );
                    const allGroupsFilled = RELATION_GROUPS.every(({ key }) =>
                      ((entity.frontmatter[key] as string[] | undefined) ?? [])
                        .filter((id) => !presetCoveredIds.has(id)).length > 0
                    );

                    // All IDs already related to this entity in any way
                    const allRelatedIds = new Set([
                      entity.id,
                      ...Array.from(presetCoveredIds),
                      ...RELATION_GROUPS.flatMap(({ key }) =>
                        (entity.frontmatter[key] as string[] | undefined) ?? []
                      ),
                    ]);

                    // Candidates for the add-relation picker (filtered by query)
                    const q = addRelQuery.toLowerCase().trim();
                    const candidates = entities.filter(
                      (e) => !e.archived && !allRelatedIds.has(e.id) &&
                        (!q || e.title.toLowerCase().includes(q))
                    );

                    // Group candidates by entity type
                    const byType = new Map<string, typeof entities>();
                    for (const e of candidates) {
                      const t = e.type || '__none';
                      if (!byType.has(t)) byType.set(t, []);
                      byType.get(t)!.push(e);
                    }

                    // Build SelectWrapper items with headers + dividers
                    const addRelItems: SelectItem[] = [];
                    let firstGroup = true;
                    for (const [typeName, typeEntities] of byType) {
                      if (!firstGroup) addRelItems.push({ type: 'divider' });
                      firstGroup = false;
                      const pluralLabel = typeName.endsWith('s') ? typeName : `${typeName}s`;
                      addRelItems.push({ type: 'header', label: pluralLabel });
                      for (const e of typeEntities) {
                        const eSchema = schemas.find((s) => s.name === e.type);
                        const eIcon  = e.icon ?? eSchema?.icon ?? 'File';
                        const eColor = e.color ?? eSchema?.color ?? 'var(--text-tertiary)';
                        addRelItems.push({
                          type: 'option',
                          label: e.title,
                          icon: <DynamicIcon name={eIcon} size={12} color={eColor} />,
                          onClick: () => {
                            handleAddRelation(e.id, addingRelKind!);
                            setAddingRelKind(null);
                            setAddRelQuery('');
                          },
                        });
                      }
                    }

                    return (
                      <>
                        {hasFreeformRelations || addingRelKind ? (
                          RELATION_GROUPS.map(({ kind, label, key }) => {
                            const ids = ((entity.frontmatter[key] as string[] | undefined) ?? [])
                              .filter((id) => !presetCoveredIds.has(id));
                            const isAdding = addingRelKind === kind;
                            if (ids.length === 0 && !isAdding) return null;
                            return (
                              <div key={kind} className={styles.relGroup}>
                                <div className={styles.relGroupHeader}>
                                  <span className={styles.relGroupName}>{label}</span>
                                  <button
                                    className={styles.relGroupAddBtn}
                                    aria-label={`Add ${label} relation`}
                                    onClick={() => { setAddingRelKind(kind); setAddRelQuery(''); }}
                                  >
                                    <IconWrapper size={16}>
                                      <Plus size={12} />
                                    </IconWrapper>
                                  </button>
                                </div>
                                {ids.map((targetId) => {
                                  const target = entities.find((e) => e.id === targetId);
                                  const tSchema = target ? schemas.find((s) => s.name === target.type) : null;
                                  const tIcon  = target?.icon ?? tSchema?.icon ?? 'File';
                                  const tColor = target?.color ?? tSchema?.color ?? '#888888';
                                  const lightColor = `color-mix(in srgb, ${tColor} 65%, #ffffff)`;
                                  return (
                                    <div key={targetId} className={styles.relEntityRow}>
                                      <Chip
                                        label={target?.title ?? targetId}
                                        leadingIcon={<DynamicIcon name={tIcon} size={11} color={lightColor} />}
                                        color={lightColor}
                                        backgroundColor="transparent"
                                        className={styles.relChip}
                                      />
                                      <button
                                        className={styles.relChipNavBtn}
                                        onClick={() => target && setActiveEntityId(target.id)}
                                        aria-label={target ? `Open ${target.title}` : undefined}
                                      >
                                        <ArrowSquareOut size={12} />
                                      </button>
                                      <div className={styles.relEntityActions}>
                                        <button
                                          className={styles.relChipRemoveBtn}
                                          onClick={() => handleRemoveRelation(targetId, kind)}
                                          aria-label="Remove relation"
                                        >
                                          <X size={10} />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                                {isAdding && (
                                  <Popover.Root
                                    open={true}
                                    onOpenChange={(o) => { if (!o) { setAddingRelKind(null); setAddRelQuery(''); } }}
                                  >
                                    <Popover.Trigger asChild>
                                      <div className={styles.addRelSearchWrap}>
                                        <Input
                                          value={addRelQuery}
                                          onChange={(e) => setAddRelQuery(e.target.value)}
                                          placeholder="Search entities…"
                                          autoFocus
                                          onKeyDown={(e) => {
                                            if (e.key === 'Escape') { setAddingRelKind(null); setAddRelQuery(''); }
                                          }}
                                        />
                                      </div>
                                    </Popover.Trigger>
                                    <Popover.Portal>
                                      <Popover.Content
                                        className={styles.addRelPopover}
                                        side="bottom"
                                        sideOffset={4}
                                        align="start"
                                        avoidCollisions={false}
                                        onOpenAutoFocus={(e) => e.preventDefault()}
                                        onInteractOutside={() => { setAddingRelKind(null); setAddRelQuery(''); }}
                                      >
                                        <SelectWrapper
                                          items={addRelItems}
                                          emptyMessage="No entities match your search"
                                        />
                                      </Popover.Content>
                                    </Popover.Portal>
                                  </Popover.Root>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <p className={styles.relEmptyText}>No relations added to this entity yet</p>
                        )}
                        {!allGroupsFilled && !addingRelKind && (
                          <div className={styles.addRelationRow}>
                            <Button leadingIcon={<Plus size={11} />} onClick={() => setPickerOpen(true)}>
                              Add Relation
                            </Button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div></div>}
              </section>

              {/* Stats */}
              <section className={styles.section}>
                <SubHeader title="Stats" open={statsOpen} onToggle={() => toggleSection('pp-stats', setStatsOpen)} />
                {statsOpen && (
                  <div className={styles.panelOptions}>
                    <div className={styles.stats}>
                      <StatRow icon={<BookOpenText size={12} />} label="Words" value={entity.wordCount.toLocaleString()} />
                      <StatRow icon={<HardDrives size={12} />} label="File Size" value={formatFileSize(entity.fileSize)} />
                      <StatRow icon={<Books size={12} />} label="Read Time" value={`~${Math.max(1, Math.round(entity.wordCount / 200))} mins`} />
                      <StatRow icon={<Clock size={12} />} label="Created at" value={formatDate(entity.createdAt)} />
                      <StatRow icon={<ClockUser size={12} />} label="Modified at" value={relativeTime(entity.modifiedAt)} />
                    </div>
                  </div>
                )}
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

      {handlePos && !draggingKey && schema && (
        <button
          className={styles.floatingDragHandle}
          style={{ top: handlePos.top, left: handlePos.left }}
          onPointerDown={(e) => {
            const item = allDraggableItems[handlePos.idx];
            if (item) handleDragStart(e, item.key, handlePos.idx, schema);
          }}
          onMouseEnter={() => {
            handleHoverRef.current = true;
            if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
          }}
          onMouseLeave={() => {
            handleHoverRef.current = false;
            scheduleHide();
          }}
          aria-label="Drag to reorder"
          tabIndex={-1}
        >
          <IconWrapper size={24}>
            <DotsSixVertical size={16} />
          </IconWrapper>
        </button>
      )}

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
