import yaml from 'js-yaml';
import type { Entity, SchemaDefinition, CalendarDefinition, FantasyDate, EraWithOffset } from '../types';

/* ─── Timeline item types ───────────────────────────────── */

export interface TimelinePoint {
  kind: 'point';
  entityId: string;
  entityTitle: string;
  entityType: string;
  entityColor: string;
  entityIcon: string;
  fieldLabel: string;
  linear: number;    // absolute linear position for Y-axis
  dateLabel: string; // formatted display string
}

export interface TimelineSpan {
  kind: 'span';
  entityId: string;
  entityTitle: string;
  entityType: string;
  entityColor: string;
  entityIcon: string;
  startLinear: number;
  endLinear: number;
  dateLabel: string; // "Yr 1 – Yr 1200 · First Age"
  isEra: boolean;    // true for Era entities (styled differently)
}

export type TimelineItem = TimelinePoint | TimelineSpan;

/* ─── Calendar parsing ──────────────────────────────────── */

export function parseCalendarEntity(entity: Entity): CalendarDefinition {
  const fm = entity.frontmatter;
  const rawMonths = fm.months;

  // rawMonths is an array when stored as native YAML in frontmatter (raw mode edit),
  // or a string when saved through the textarea field in the properties panel.
  let parsed: unknown = rawMonths;
  if (typeof rawMonths === 'string' && rawMonths.trim()) {
    try { parsed = yaml.load(rawMonths); } catch { parsed = []; }
  }
  const months = Array.isArray(parsed)
    ? (parsed as Array<{ name: string; days: number }>)
        .filter((m) => m && typeof m.name === 'string' && typeof m.days === 'number')
        .map((m) => ({ name: m.name, days: m.days }))
    : [];
  return {
    id: entity.id,
    name: entity.title,
    months,
    weekdays: typeof fm.weekdays === 'number' ? fm.weekdays : 7,
  };
}

/* ─── Era offset computation ────────────────────────────── */

export function computeEraOffsets(entities: Entity[]): EraWithOffset[] {
  const eras = entities
    .filter((e) => e.type === 'Era' && !e.archived)
    .sort((a, b) => {
      const an = Number(a.frontmatter.number ?? 9999);
      const bn = Number(b.frontmatter.number ?? 9999);
      return an - bn;
    });

  let cumulative = 0;
  return eras.map((era) => {
    const duration = Number(era.frontmatter.end ?? 1000);
    const result: EraWithOffset = {
      id: era.id,
      title: era.title,
      order: Number(era.frontmatter.number ?? 0),
      duration,
      cumulativeStart: cumulative,
    };
    cumulative += duration;
    return result;
  });
}

/* ─── FantasyDate parsing ───────────────────────────────── */

export function parseFantasyDate(value: unknown): FantasyDate | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.era !== 'string' || typeof v.year !== 'number') return null;
  return {
    era: v.era,
    year: v.year,
    month: typeof v.month === 'number' ? v.month : 1,
    day: typeof v.day === 'number' ? v.day : 1,
  };
}

/* ─── Date → linear conversion ──────────────────────────── */
//
// Linear position: each unit = one year. Era 1 starts at 0, Era 2 starts at
// Era 1's duration, etc. Sub-year precision comes from month/day via the calendar.
// Falls back to treating plain integers as absolute linear positions so
// data created before this system still appears on the timeline.
//
export function dateToLinear(
  value: unknown,
  eras: EraWithOffset[],
  calendar?: CalendarDefinition,
): number | null {
  const fd = parseFantasyDate(value);
  if (fd) {
    const era = eras.find((e) => e.id === fd.era);
    if (!era) return null;

    let yearFraction = 0;
    if (calendar && calendar.months.length > 0) {
      const totalDays = calendar.months.reduce((sum, m) => sum + m.days, 0);
      if (totalDays > 0) {
        let dayOfYear = fd.day;
        for (let i = 0; i < fd.month - 1 && i < calendar.months.length; i++) {
          dayOfYear += calendar.months[i].days;
        }
        yearFraction = (dayOfYear - 1) / totalDays;
      }
    }

    // Year 1 of an era maps to cumulativeStart
    return era.cumulativeStart + (fd.year - 1) + yearFraction;
  }

  // Legacy: plain number treated as absolute linear position
  const n = Number(value);
  return isNaN(n) ? null : n;
}

/* ─── Display formatting ────────────────────────────────── */

function eraAtLinear(linear: number, eras: EraWithOffset[]): EraWithOffset | undefined {
  // Find the last era whose cumulativeStart is ≤ linear
  return [...eras].reverse().find((e) => linear >= e.cumulativeStart);
}

export function formatDateLabel(linear: number, eras: EraWithOffset[]): string {
  if (eras.length === 0) return String(Math.round(linear));
  const era = eraAtLinear(linear, eras);
  if (!era) return String(Math.round(linear));
  const yearWithinEra = Math.floor(linear - era.cumulativeStart) + 1;
  return `Yr ${yearWithinEra} · ${era.title}`;
}

function formatSpanLabel(startLinear: number, endLinear: number, eras: EraWithOffset[]): string {
  if (eras.length === 0) return `${Math.round(startLinear)} – ${Math.round(endLinear)}`;
  const startEra = eraAtLinear(startLinear, eras);
  const endEra   = eraAtLinear(endLinear, eras);
  const startYr  = Math.floor(startLinear - (startEra?.cumulativeStart ?? 0)) + 1;
  const endYr    = Math.floor(endLinear   - (endEra?.cumulativeStart   ?? 0)) + 1;
  if (startEra && endEra && startEra.id === endEra.id) {
    return `Yr ${startYr} – ${endYr} · ${startEra.title}`;
  }
  const startStr = startEra ? `Yr ${startYr} · ${startEra.title}` : String(Math.round(startLinear));
  const endStr   = endEra   ? `Yr ${endYr} · ${endEra.title}`     : String(Math.round(endLinear));
  return `${startStr} → ${endStr}`;
}

/* ─── Build timeline items from vault data ──────────────── */

export function buildTimelineItems(
  entities: Entity[],
  schemas: SchemaDefinition[],
  eras: EraWithOffset[],
  calendar?: CalendarDefinition,
  filterTypes?: string[],
): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const entity of entities) {
    if (entity.archived) continue;
    if (filterTypes && filterTypes.length > 0 && !filterTypes.includes(entity.type)) continue;

    const schema = schemas.find((s) => s.name === entity.type);

    // ── Era entities: position from computed offsets, not from date fields ──
    if (entity.type === 'Era') {
      const eraOffset = eras.find((e) => e.id === entity.id);
      if (!eraOffset) continue;
      const startLinear = eraOffset.cumulativeStart;
      const endLinear   = eraOffset.cumulativeStart + eraOffset.duration;
      items.push({
        kind: 'span',
        entityId:    entity.id,
        entityTitle: entity.title,
        entityType:  entity.type,
        entityColor: entity.color ?? schema?.color ?? '#FF5370',
        entityIcon:  entity.icon  ?? schema?.icon  ?? 'Timer',
        startLinear,
        endLinear,
        dateLabel: formatSpanLabel(startLinear, endLinear, eras),
        isEra: true,
      });
      continue;
    }

    if (!schema) continue;

    const visibleFields = schema.fields.filter(
      (f) => f.type === 'date' && f.timelineVisible,
    );
    // Also include custom per-entity date fields marked timelineVisible
    const customFields = (entity.frontmatter.__customFields as Array<{
      key: string; label?: string; type: string; timelineVisible?: boolean; dateKind?: string;
    }> | undefined) ?? [];
    const visibleCustomFields = customFields.filter((f) => f.type === 'date' && f.timelineVisible);

    if (visibleFields.length === 0 && visibleCustomFields.length === 0) continue;

    const flags = entity.frontmatter.__timelineFlags as Record<string, boolean> | undefined;

    const resolved: { fieldKey: string; fieldLabel: string; linear: number }[] = [];
    for (const field of visibleFields) {
      if (flags && flags[field.key] === false) continue;
      const linear = dateToLinear(entity.frontmatter[field.key], eras, calendar);
      if (linear !== null) resolved.push({ fieldKey: field.key, fieldLabel: field.label, linear });
    }
    for (const cf of visibleCustomFields) {
      if (flags && flags[cf.key] === false) continue;
      const linear = dateToLinear(entity.frontmatter[cf.key], eras, calendar);
      if (linear !== null) resolved.push({ fieldKey: cf.key, fieldLabel: cf.label ?? cf.key, linear });
    }

    if (resolved.length === 0) continue;

    if (resolved.length === 2) {
      const [a, b] = resolved.sort((x, y) => x.linear - y.linear);
      items.push({
        kind: 'span',
        entityId:    entity.id,
        entityTitle: entity.title,
        entityType:  entity.type,
        entityColor: entity.color ?? schema.color,
        entityIcon:  entity.icon  ?? schema.icon,
        startLinear: a.linear,
        endLinear:   b.linear,
        dateLabel: formatSpanLabel(a.linear, b.linear, eras),
        isEra: false,
      });
    } else {
      for (const r of resolved) {
        items.push({
          kind: 'point',
          entityId:    entity.id,
          entityTitle: entity.title,
          entityType:  entity.type,
          entityColor: entity.color ?? schema.color,
          entityIcon:  entity.icon  ?? schema.icon,
          fieldLabel:  r.fieldLabel,
          linear:      r.linear,
          dateLabel:   formatDateLabel(r.linear, eras),
        });
      }
    }
  }

  return items.sort((a, b) => {
    const al = a.kind === 'span' ? a.startLinear : a.linear;
    const bl = b.kind === 'span' ? b.startLinear : b.linear;
    return al - bl;
  });
}

/* ─── Axis tick generation ──────────────────────────────── */

export interface Tick {
  linear: number;
  label: string;
  major: boolean;
  isEraBoundary: boolean;
}

export function generateTicks(
  minLinear: number,
  maxLinear: number,
  pxPerYear: number,
  eras: EraWithOffset[] = [],
): Tick[] {
  const range = maxLinear - minLinear;
  if (range <= 0) return [];

  const targetTicks = Math.max(4, Math.min(20, Math.floor((range * pxPerYear) / 80)));
  const rawInterval = range / targetTicks;
  const magnitude   = Math.pow(10, Math.floor(Math.log10(rawInterval || 1)));
  const candidates  = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000];
  const multiplied  = candidates.map((c) => c * magnitude);
  const interval    = multiplied.find((c) => c >= rawInterval) ?? magnitude;
  const majorInterval = interval * 5;

  const start = Math.ceil(minLinear / interval) * interval;
  const ticks: Tick[] = [];

  for (let lin = start; lin <= maxLinear; lin += interval) {
    ticks.push({
      linear: lin,
      label: formatTickLabel(lin, eras),
      major: lin % majorInterval < interval / 2,
      isEraBoundary: false,
    });
  }

  // Insert era boundary ticks, replacing any regular tick too close to the boundary
  for (const era of eras) {
    const boundary = era.cumulativeStart;
    if (boundary < minLinear || boundary > maxLinear) continue;
    const nearIdx = ticks.findIndex((t) => !t.isEraBoundary && Math.abs(t.linear - boundary) < interval * 0.6);
    if (nearIdx >= 0) ticks.splice(nearIdx, 1);
    ticks.push({
      linear: boundary,
      label: era.title,
      major: true,
      isEraBoundary: true,
    });
  }

  return ticks.sort((a, b) => a.linear - b.linear);
}

function formatTickLabel(linear: number, eras: EraWithOffset[]): string {
  if (eras.length === 0) return String(Math.round(linear));
  const era = eraAtLinear(linear, eras);
  if (!era) return String(Math.round(linear));
  return `Yr ${Math.floor(linear - era.cumulativeStart) + 1}`;
}

/* ─── Coordinate helpers ────────────────────────────────── */

export function yearToY(linear: number, minLinear: number, pxPerYear: number, topPad: number): number {
  return topPad + (linear - minLinear) * pxPerYear;
}
