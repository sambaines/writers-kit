import type { Entity, SchemaDefinition } from '../types';

/* ─── Timeline item types ───────────────────────────────── */

export interface TimelinePoint {
  kind: 'point';
  entityId: string;
  entityTitle: string;
  entityType: string;
  entityColor: string;
  entityIcon: string;
  fieldLabel: string;
  year: number;
}

export interface TimelineSpan {
  kind: 'span';
  entityId: string;
  entityTitle: string;
  entityType: string;
  entityColor: string;
  entityIcon: string;
  startYear: number;
  endYear: number;
}

export type TimelineItem = TimelinePoint | TimelineSpan;

/* ─── Date → year conversion ────────────────────────────── */
//
// OPTION A  ─  treats the field value as a plain integer year.
//              Supports negative years (e.g. -450).
//
// OPTION B (future)  ─  replace dateToYear with a calendar-aware
// implementation that accepts a CalendarDefinition and converts custom
// month/year strings (e.g. "3rd Harvest, Year 112 of the Second Age")
// into a canonical numeric position. Everything downstream only needs
// numbers, so this is the single swap point.
//
export function dateToYear(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

/* ─── Build timeline items from vault data ──────────────── */

export function buildTimelineItems(
  entities: Entity[],
  schemas: SchemaDefinition[],
  filterTypes?: string[],   // if provided, only include these schema names
): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const entity of entities) {
    if (entity.archived) continue;
    if (filterTypes && filterTypes.length > 0 && !filterTypes.includes(entity.type)) continue;

    const schema = schemas.find((s) => s.name === entity.type);
    if (!schema) continue;

    // Fields that should appear on the timeline
    const visibleFields = schema.fields.filter(
      (f) => f.type === 'date' && f.timelineVisible,
    );
    if (visibleFields.length === 0) continue;

    // Per-entity override: __timelineFlags: { fieldKey: false } hides a field
    const flags = entity.frontmatter.__timelineFlags as Record<string, boolean> | undefined;

    // Collect resolved years per field
    const resolved: { fieldKey: string; fieldLabel: string; year: number }[] = [];
    for (const field of visibleFields) {
      if (flags && flags[field.key] === false) continue;
      const year = dateToYear(entity.frontmatter[field.key]);
      if (year !== null) resolved.push({ fieldKey: field.key, fieldLabel: field.label, year });
    }

    if (resolved.length === 0) continue;

    // If exactly 2 fields resolved → render as a span (start→end)
    if (resolved.length === 2) {
      const [a, b] = resolved.sort((x, y) => x.year - y.year);
      items.push({
        kind: 'span',
        entityId: entity.id,
        entityTitle: entity.title,
        entityType: entity.type,
        entityColor: entity.color ?? schema.color,
        entityIcon: entity.icon ?? schema.icon,
        startYear: a.year,
        endYear: b.year,
      });
    } else {
      // 1 field or 3+ → individual points
      for (const r of resolved) {
        items.push({
          kind: 'point',
          entityId: entity.id,
          entityTitle: entity.title,
          entityType: entity.type,
          entityColor: entity.color ?? schema.color,
          entityIcon: entity.icon ?? schema.icon,
          fieldLabel: r.fieldLabel,
          year: r.year,
        });
      }
    }
  }

  return items.sort((a, b) => {
    const ay = a.kind === 'span' ? a.startYear : a.year;
    const by = b.kind === 'span' ? b.startYear : b.year;
    return ay - by;
  });
}

/* ─── Axis tick generation ──────────────────────────────── */

export interface Tick {
  year: number;
  major: boolean;
}

export function generateTicks(minYear: number, maxYear: number, pxPerYear: number): Tick[] {
  const range = maxYear - minYear;
  // Choose tick interval based on density
  const targetTicks = Math.max(4, Math.min(20, Math.floor((range * pxPerYear) / 80)));
  const rawInterval = range / targetTicks;

  // Round to a nice number
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)));
  const candidates = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000];
  const multiplied = candidates.map((c) => c * magnitude);
  const interval = multiplied.find((c) => c >= rawInterval) ?? magnitude;

  const majorInterval = interval * 5;
  const start = Math.ceil(minYear / interval) * interval;

  const ticks: Tick[] = [];
  for (let y = start; y <= maxYear; y += interval) {
    ticks.push({ year: y, major: y % majorInterval === 0 });
  }
  return ticks;
}

/* ─── Coordinate helpers ────────────────────────────────── */

export function yearToY(year: number, minYear: number, pxPerYear: number, topPad: number): number {
  return topPad + (year - minYear) * pxPerYear;
}
