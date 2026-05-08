import type { Entity, SchemaDefinition, VaultCalendar } from '../types';
import {
  customDateToLinear,
  parseCustomDate,
  parseCustomDateRange,
  formatCustomDateLabel,
  getEraForYear,
  yearToLabel,
} from './calendar.service';

/* ─── Timeline item types ───────────────────────────────── */

export interface TimelinePoint {
  kind: 'point';
  entityId: string;
  entityTitle: string;
  entityType: string;
  entityColor: string;
  entityIcon: string;
  fieldLabel: string;
  linear: number;
  dateLabel: string;
}

export interface TimelineSpan {
  kind: 'span';
  entityId: string;
  entityTitle: string;
  entityType: string;
  entityColor: string;
  entityIcon: string;
  startLinear: number;
  endLinear: number;   // ignored for rendering when ongoing=true
  ongoing: boolean;
  dateLabel: string;
}

export type TimelineItem = TimelinePoint | TimelineSpan;

/* ─── Build timeline items ──────────────────────────────── */

export function buildTimelineItems(
  entities: Entity[],
  schemas: SchemaDefinition[],
  calendar?: VaultCalendar,
): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const entity of entities) {
    if (entity.archived) continue;

    const schema = schemas.find((s) => s.name === entity.type);
    if (!schema) continue;

    // Collect all date fields from schema + per-entity custom fields
    type FieldMeta = { key: string; label: string; type: string };
    const allFields: FieldMeta[] = [
      ...schema.fields.map((f) => ({ key: f.key, label: f.label, type: f.type })),
      ...((entity.frontmatter.__customFields as FieldMeta[] | undefined) ?? []),
    ];

    const shared = {
      entityId:    entity.id,
      entityTitle: entity.title,
      entityType:  entity.type,
      entityColor: entity.color ?? schema.color,
      entityIcon:  entity.icon  ?? schema.icon,
    };

    for (const field of allFields) {
      const raw = entity.frontmatter[field.key];

      if (field.type === 'custom-date') {
        const cd = parseCustomDate(raw);
        if (!cd) continue;
        const linear = customDateToLinear(cd, calendar);
        items.push({
          kind: 'point',
          ...shared,
          fieldLabel: field.label,
          linear,
          dateLabel: formatCustomDateLabel(linear, calendar),
        });
      }

      if (field.type === 'custom-date-range') {
        const range = parseCustomDateRange(raw);
        if (!range) continue;
        const startLinear = customDateToLinear(range.start, calendar);
        const endLinear   = range.ongoing || !range.end
          ? startLinear   // view extends to canvas bottom when ongoing
          : customDateToLinear(range.end, calendar);
        const startLabel = formatCustomDateLabel(startLinear, calendar);
        const dateLabel  = range.ongoing
          ? `${startLabel} →`
          : `${startLabel} – ${formatCustomDateLabel(endLinear, calendar)}`;
        items.push({
          kind: 'span',
          ...shared,
          startLinear,
          endLinear,
          ongoing:   range.ongoing,
          dateLabel,
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
  calendar?: VaultCalendar,
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
    const year = Math.round(lin);
    const label = calendar
      ? yearToLabel(calendar, year)
      : year < 0 ? `${Math.abs(year)} BR` : `Yr ${year}`;
    ticks.push({
      linear: lin,
      label,
      major: lin % majorInterval < interval / 2,
      isEraBoundary: false,
    });
  }

  // Insert era boundary ticks
  if (calendar) {
    for (const era of calendar.eras) {
      const boundary = era.startYear;
      if (boundary < minLinear || boundary > maxLinear) continue;
      const nearIdx = ticks.findIndex(
        (t) => !t.isEraBoundary && Math.abs(t.linear - boundary) < interval * 0.6,
      );
      if (nearIdx >= 0) ticks.splice(nearIdx, 1);
      ticks.push({
        linear: boundary,
        label: era.name,
        major: true,
        isEraBoundary: true,
      });
    }
  }

  return ticks.sort((a, b) => a.linear - b.linear);
}

/* ─── Era band rendering data ───────────────────────────── */

export interface EraBand {
  name: string;
  startLinear: number;
  endLinear: number;
  color?: string;
}

export function getEraBands(calendar: VaultCalendar, maxLinear: number): EraBand[] {
  const sorted = [...calendar.eras].sort((a, b) => a.startYear - b.startYear);
  return sorted.map((era, idx) => {
    const nextStart = idx < sorted.length - 1 ? sorted[idx + 1].startYear : null;
    let endLinear: number;
    if (era.endYear === 0) {
      endLinear = maxLinear;
    } else if (nextStart !== null && era.endYear < nextStart) {
      // Fill the gap between this era and the next so the timeline has no dead space
      endLinear = nextStart;
    } else {
      endLinear = era.endYear;
    }
    return { name: era.name, startLinear: era.startYear, endLinear, color: era.color };
  });
}

/* ─── Coordinate helpers ────────────────────────────────── */

export function yearToY(linear: number, minLinear: number, pxPerYear: number, topPad: number): number {
  return topPad + (linear - minLinear) * pxPerYear;
}

/* ─── Re-export for convenience ─────────────────────────── */

export { getEraForYear, formatCustomDateLabel };
