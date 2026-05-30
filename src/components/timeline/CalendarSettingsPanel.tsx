import { useState, useEffect, useRef } from 'react';
import { useVaultStore } from '../../store/vault.store';
import {
  CalendarBlank, Plus, X, ArrowUp, ArrowDown, CaretDown, CaretRight, PencilSimple, Check,
} from '@phosphor-icons/react';
import type { VaultCalendar, CalendarMonthDef, EraDef } from '../../types';
import ColorPicker, { PRESET_COLORS } from '../type-editor/ColorPicker';
import styles from './CalendarSettingsPanel.module.css';

// Allows empty string, minus sign, and negative/positive integers.
// Calls onChange with the parsed number as the user types valid digits.
// Uses key prop from parent to reset when rows are reordered/removed.
function NumberTextInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  className?: string;
}) {
  const [str, setStr] = useState(() => value === 0 ? '' : String(value));
  const lastReported = useRef(value);

  // During-render prop sync: React's documented alternative to useEffect for
  // "derived state from props". When the value changes externally (e.g. row
  // reorder/remove), reset the string. When the user typed the change, lastReported
  // is already up to date so this is skipped and focus is preserved.
  if (value !== lastReported.current) {
    lastReported.current = value;
    setStr(value === 0 ? '' : String(value));
  }

  function handleChange(raw: string) {
    // Allow: empty, lone minus, or a valid integer (including negative)
    if (raw === '' || raw === '-' || /^-?\d+$/.test(raw)) {
      setStr(raw);
      const n = parseInt(raw, 10);
      if (!isNaN(n) && n !== lastReported.current) {
        lastReported.current = n; // update eagerly so the render-time check above stays silent
        onChange(n);
      }
    }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      className={className}
      value={str}
      placeholder={placeholder}
      onChange={(e) => handleChange(e.target.value)}
    />
  );
}

const EMPTY_CALENDAR: VaultCalendar = {
  name: 'My Calendar',
  months: [],
  eras: [],
};

export default function CalendarSettingsPanel() {
  const calendar    = useVaultStore((s) => s.calendar);
  const saveCalendar = useVaultStore((s) => s.saveCalendar);

  const [local, setLocal] = useState<VaultCalendar>(() => calendar ?? EMPTY_CALENDAR);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'saved'>('idle');
  const [monthsOpen, setMonthsOpen]   = useState(true);
  const [erasOpen, setErasOpen]       = useState(true);
  const [leapOpen, setLeapOpen]       = useState(false);
  const [openColorIdx, setOpenColorIdx] = useState<number | null>(null);

  // Month add-form state
  const [newMonthName, setNewMonthName] = useState('');
  const [newMonthDays, setNewMonthDays] = useState('');
  // Inline edit state: index of month being edited, with draft values
  const [editingMonth, setEditingMonth] = useState<{ index: number; name: string; days: string } | null>(null);

  const isMountedRef    = useRef(false);
  const debounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Skip the initial mount — don't save on first render
    if (!isMountedRef.current) { isMountedRef.current = true; return; }

    setSaveStatus('pending');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      await saveCalendar(local);
      setSaveStatus('saved');
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    }, 800);
  }, [local]); // saveCalendar is a stable Zustand action

  /* ── Month helpers ──────────────────────────────────────── */

  function commitNewMonth() {
    const name = newMonthName.trim();
    const days = parseInt(newMonthDays, 10);
    if (!name || isNaN(days) || days < 1) return;
    setLocal((c) => ({ ...c, months: [...c.months, { name, days }] }));
    setNewMonthName('');
    setNewMonthDays('');
  }

  function commitEditMonth() {
    if (!editingMonth) return;
    const name = editingMonth.name.trim();
    const days = parseInt(editingMonth.days, 10);
    if (!name || isNaN(days) || days < 1) return;
    setLocal((c) => ({
      ...c,
      months: c.months.map((m, idx) =>
        idx === editingMonth.index ? { name, days } : m,
      ),
    }));
    setEditingMonth(null);
  }

  function removeMonth(i: number) {
    setLocal((c) => ({ ...c, months: c.months.filter((_, idx) => idx !== i) }));
    if (editingMonth?.index === i) setEditingMonth(null);
  }

  function moveMonth(i: number, dir: -1 | 1) {
    setLocal((c) => {
      const next = [...c.months];
      const t = i + dir;
      if (t < 0 || t >= next.length) return c;
      [next[i], next[t]] = [next[t], next[i]];
      return { ...c, months: next };
    });
    if (editingMonth?.index === i) setEditingMonth((e) => e ? { ...e, index: i + dir } : null);
  }

  /* ── Era helpers ────────────────────────────────────────── */

  function addEra() {
    setLocal((c) => ({
      ...c,
      eras: [...c.eras, { name: '', startYear: 1, endYear: 0 }],
    }));
  }

  function removeEra(i: number) {
    setLocal((c) => ({ ...c, eras: c.eras.filter((_, idx) => idx !== i) }));
  }

  function patchEra(i: number, patch: Partial<EraDef>) {
    setLocal((c) => ({
      ...c,
      eras: c.eras.map((e, idx) => idx === i ? { ...e, ...patch } : e),
    }));
  }

  function moveEra(i: number, dir: -1 | 1) {
    setLocal((c) => {
      const next = [...c.eras];
      const t = i + dir;
      if (t < 0 || t >= next.length) return c;
      [next[i], next[t]] = [next[t], next[i]];
      return { ...c, eras: next };
    });
  }

  /* ── Leap year helpers ──────────────────────────────────── */

  function toggleLeapYear(enabled: boolean) {
    setLocal((c) => ({
      ...c,
      leapYear: enabled
        ? (c.leapYear ?? { interval: 4, month: 1, extraDays: 1 })
        : undefined,
    }));
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <CalendarBlank size={14} color="var(--accent)" />
        <span className={styles.headerTitle}>Calendar</span>
        {saveStatus !== 'idle' && (
          <span className={styles.saveStatus}>
            {saveStatus === 'pending' ? 'Saving…' : 'Saved'}
          </span>
        )}
      </div>

      <div className={styles.body}>
        {/* Calendar name */}
        <div className={styles.row}>
          <label className={styles.label}>Name</label>
          <input
            className={styles.input}
            value={local.name}
            placeholder="Calendar name"
            onChange={(e) => setLocal((c) => ({ ...c, name: e.target.value }))}
          />
        </div>

        {/* Negative year label */}
        <div className={styles.row}>
          <label className={styles.label}>Pre-zero year label</label>
          <input
            className={styles.inputShort}
            value={local.negativeLabel ?? ''}
            placeholder="BR"
            maxLength={12}
            onChange={(e) => setLocal((c) => ({
              ...c,
              negativeLabel: e.target.value || undefined,
            }))}
          />
        </div>

        {/* Months section */}
        <div className={styles.section}>
          <button className={styles.sectionToggle} onClick={() => setMonthsOpen((o) => !o)}>
            {monthsOpen ? <CaretDown size={10} /> : <CaretRight size={10} />}
            <span>Months</span>
            <span className={styles.sectionCount}>{local.months.length}</span>
          </button>
          {monthsOpen && (
            <div className={styles.sectionBody}>
              {/* Add-form row */}
              <div className={styles.monthAddForm}>
                <input
                  className={styles.monthName}
                  value={newMonthName}
                  placeholder="Month name"
                  onChange={(e) => setNewMonthName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && commitNewMonth()}
                />
                <input
                  type="number"
                  className={styles.monthDays}
                  value={newMonthDays}
                  placeholder="Days"
                  min={1}
                  onChange={(e) => setNewMonthDays(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && commitNewMonth()}
                />
                <button
                  className={styles.monthAddBtn}
                  onClick={commitNewMonth}
                  disabled={!newMonthName.trim() || !newMonthDays}
                  aria-label="Add month"
                >
                  <Plus size={12} />
                </button>
              </div>

              {/* Committed month rows */}
              {local.months.map((m, i) => (
                editingMonth?.index === i ? (
                  /* Inline edit mode */
                  <div key={i} className={styles.monthAddForm}>
                    <input
                      className={styles.monthName}
                      value={editingMonth.name}
                      autoFocus
                      onChange={(e) => setEditingMonth((ed) => ed ? { ...ed, name: e.target.value } : ed)}
                      onKeyDown={(e) => e.key === 'Enter' && commitEditMonth()}
                    />
                    <input
                      type="number"
                      className={styles.monthDays}
                      value={editingMonth.days}
                      min={1}
                      onChange={(e) => setEditingMonth((ed) => ed ? { ...ed, days: e.target.value } : ed)}
                      onKeyDown={(e) => e.key === 'Enter' && commitEditMonth()}
                    />
                    <button className={styles.monthAddBtn} onClick={commitEditMonth} aria-label="Confirm">
                      <Check size={12} />
                    </button>
                  </div>
                ) : (
                  <div key={i} className={styles.monthRow}>
                    <span className={styles.monthRowName}>{m.name}</span>
                    <span className={styles.monthRowDays}>{m.days}d</span>
                    <div className={styles.rowActions}>
                      <button className={styles.moveBtn} onClick={() => moveMonth(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp size={10} /></button>
                      <button className={styles.moveBtn} onClick={() => moveMonth(i, 1)} disabled={i === local.months.length - 1} aria-label="Move down"><ArrowDown size={10} /></button>
                      <button className={styles.editBtn} onClick={() => setEditingMonth({ index: i, name: m.name, days: String(m.days) })} aria-label="Edit"><PencilSimple size={10} /></button>
                      <button className={styles.removeBtn} onClick={() => removeMonth(i)} aria-label="Remove"><X size={10} /></button>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>

        {/* Eras section */}
        <div className={styles.section}>
          <button className={styles.sectionToggle} onClick={() => setErasOpen((o) => !o)}>
            {erasOpen ? <CaretDown size={10} /> : <CaretRight size={10} />}
            <span>Eras</span>
            <span className={styles.sectionCount}>{local.eras.length}</span>
          </button>
          {erasOpen && (
            <div className={styles.sectionBody}>
              <div className={styles.eraHeader}>
                <span className={styles.colLabel}>Name</span>
                <span className={styles.colLabel}>Start yr</span>
                <span className={styles.colLabel}>End yr</span>
              </div>
              {local.eras.map((era, i) => (
                <div key={i} className={styles.eraWrapper}>
                  <div className={styles.eraRow}>
                    <button
                      type="button"
                      className={styles.eraColorBtn}
                      style={{ background: era.color ?? 'var(--bg-overlay)' }}
                      aria-label="Pick era colour"
                      onClick={() => setOpenColorIdx(openColorIdx === i ? null : i)}
                    />
                    <input
                      className={styles.eraName}
                      value={era.name}
                      placeholder="Era name"
                      onChange={(e) => patchEra(i, { name: e.target.value })}
                    />
                    <NumberTextInput
                      key={`start-${i}`}
                      className={styles.eraYear}
                      value={era.startYear}
                      placeholder="Start"
                      onChange={(v) => patchEra(i, { startYear: v })}
                    />
                    <NumberTextInput
                      key={`end-${i}`}
                      className={styles.eraYear}
                      value={era.endYear}
                      placeholder="End (0=open)"
                      onChange={(v) => patchEra(i, { endYear: v })}
                    />
                    <div className={styles.rowActions}>
                      <button className={styles.moveBtn} onClick={() => moveEra(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp size={10} /></button>
                      <button className={styles.moveBtn} onClick={() => moveEra(i, 1)} disabled={i === local.eras.length - 1} aria-label="Move down"><ArrowDown size={10} /></button>
                      <button className={styles.removeBtn} onClick={() => removeEra(i)} aria-label="Remove"><X size={10} /></button>
                    </div>
                  </div>
                  {openColorIdx === i && (
                    <div className={styles.eraColorPopover}>
                      <ColorPicker
                        value={era.color ?? PRESET_COLORS[0]}
                        onChange={(c) => {
                          patchEra(i, { color: c });
                          setOpenColorIdx(null);
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
              <p className={styles.eraHint}>Negative start years are supported. End year 0 = ongoing.</p>
              <button className={styles.addBtn} onClick={addEra}>
                <Plus size={11} /> Add era
              </button>
            </div>
          )}
        </div>

        {/* Leap year section */}
        <div className={styles.section}>
          <button className={styles.sectionToggle} onClick={() => setLeapOpen((o) => !o)}>
            {leapOpen ? <CaretDown size={10} /> : <CaretRight size={10} />}
            <span>Leap years</span>
          </button>
          {leapOpen && (
            <div className={styles.sectionBody}>
              <div className={styles.row}>
                <label className={styles.label}>Enabled</label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!local.leapYear}
                  className={`${styles.toggle} ${local.leapYear ? styles.toggleOn : ''}`}
                  onClick={() => toggleLeapYear(!local.leapYear)}
                >
                  <span className={styles.toggleThumb} />
                </button>
              </div>
              {local.leapYear && (
                <>
                  <div className={styles.row}>
                    <label className={styles.label}>Every N years</label>
                    <input
                      type="number"
                      className={styles.inputShort}
                      value={local.leapYear.interval}
                      min={1}
                      onChange={(e) => setLocal((c) => c.leapYear
                        ? { ...c, leapYear: { ...c.leapYear, interval: Math.max(1, Number(e.target.value) || 1) } }
                        : c
                      )}
                    />
                  </div>
                  <div className={styles.row}>
                    <label className={styles.label}>Add to month</label>
                    {local.months.length > 0 ? (
                      <select
                        className={styles.select}
                        value={local.leapYear.month}
                        onChange={(e) => setLocal((c) => c.leapYear
                          ? { ...c, leapYear: { ...c.leapYear, month: Number(e.target.value) } }
                          : c
                        )}
                      >
                        {local.months.map((m, i) => (
                          <option key={i} value={i + 1}>{m.name || `Month ${i + 1}`}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        className={styles.inputShort}
                        value={local.leapYear.month}
                        min={1}
                        onChange={(e) => setLocal((c) => c.leapYear
                          ? { ...c, leapYear: { ...c.leapYear, month: Math.max(1, Number(e.target.value) || 1) } }
                          : c
                        )}
                      />
                    )}
                  </div>
                  <div className={styles.row}>
                    <label className={styles.label}>Extra days</label>
                    <input
                      type="number"
                      className={styles.inputShort}
                      value={local.leapYear.extraDays}
                      min={1}
                      onChange={(e) => setLocal((c) => c.leapYear
                        ? { ...c, leapYear: { ...c.leapYear, extraDays: Math.max(1, Number(e.target.value) || 1) } }
                        : c
                      )}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
