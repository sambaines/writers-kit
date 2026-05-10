import matter from 'gray-matter';
import { readTextFile, writeTextFile, fileExists } from './fs.service';
import type { VaultCalendar, CalendarMonthDef, EraDef, CustomDate, CustomDateRange } from '../types';

const CALENDAR_PATH = '.writerkit/calendar.md';

function joinPath(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/');
}

/* ─── Load / Save ───────────────────────────────────────── */

export async function loadCalendar(vaultPath: string): Promise<VaultCalendar | null> {
  const fullPath = joinPath(vaultPath, CALENDAR_PATH);
  const exists = await fileExists(fullPath);
  if (!exists) return null;
  try {
    const content = await readTextFile(fullPath);
    const { data: fm } = matter(content);
    return parseCalendarFrontmatter(fm);
  } catch (err) {
    console.error('[calendar] failed to load calendar:', err);
    return null;
  }
}

export async function saveCalendar(vaultPath: string, calendar: VaultCalendar): Promise<void> {
  const fullPath = joinPath(vaultPath, CALENDAR_PATH);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fm: Record<string, any> = {
    name: calendar.name,
    months: calendar.months,
    eras: calendar.eras,
  };
  if (calendar.leapYear) fm.leapYear = calendar.leapYear;
  if (calendar.negativeLabel) fm.negativeLabel = calendar.negativeLabel;
  const content = matter.stringify('', fm);
  await writeTextFile(fullPath, content);
}

/* ─── Parsing ───────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCalendarFrontmatter(fm: Record<string, any>): VaultCalendar {
  const months: CalendarMonthDef[] = Array.isArray(fm.months)
    ? (fm.months as Array<{ name?: unknown; days?: unknown }>)
        .filter((m) => m && typeof m.name === 'string')
        .map((m) => ({ name: String(m.name), days: Number(m.days) || 30 }))
    : [];

  const eras: EraDef[] = Array.isArray(fm.eras)
    ? (fm.eras as Array<{ name?: unknown; startYear?: unknown; endYear?: unknown }>)
        .filter((e) => e && typeof e.name === 'string')
        .map((e) => ({
          name: String(e.name),
          startYear: Number(e.startYear) || 1,
          endYear: Number(e.endYear) || 0,
          ...(typeof e.color === 'string' ? { color: e.color } : {}),
        }))
    : [];

  const leapYear = fm.leapYear && typeof fm.leapYear === 'object'
    ? {
        interval: Number(fm.leapYear.interval) || 4,
        month: Number(fm.leapYear.month) || 1,
        extraDays: Number(fm.leapYear.extraDays) || 1,
      }
    : undefined;

  return {
    name: typeof fm.name === 'string' ? fm.name : 'Calendar',
    months,
    leapYear,
    eras,
    ...(typeof fm.negativeLabel === 'string' && fm.negativeLabel ? { negativeLabel: fm.negativeLabel } : {}),
  };
}

/* ─── Calendar helpers ──────────────────────────────────── */

export function isLeapYear(calendar: VaultCalendar, year: number): boolean {
  if (!calendar.leapYear) return false;
  // Use absolute year value so negative years follow the same pattern
  return Math.abs(year) % calendar.leapYear.interval === 0;
}

export function getDaysInMonth(
  calendar: VaultCalendar,
  year: number,
  monthIndex: number, // 1-based
): number {
  const month = calendar.months[monthIndex - 1];
  if (!month) return 30;
  const base = month.days;
  if (
    calendar.leapYear &&
    calendar.leapYear.month === monthIndex &&
    isLeapYear(calendar, year)
  ) {
    return base + calendar.leapYear.extraDays;
  }
  return base;
}

export function getTotalDaysInYear(calendar: VaultCalendar, year: number): number {
  return calendar.months.reduce((sum, _, i) => sum + getDaysInMonth(calendar, year, i + 1), 0);
}

export function getEraForYear(calendar: VaultCalendar, year: number): EraDef | null {
  // Find the era whose range contains the year; last matching era wins for overlaps
  const matches = calendar.eras.filter(
    (e) => year >= e.startYear && (e.endYear === 0 || year <= e.endYear),
  );
  return matches[matches.length - 1] ?? null;
}

export function yearToLabel(calendar: VaultCalendar, year: number): string {
  const era = getEraForYear(calendar, year);
  const negLabel = calendar.negativeLabel ?? 'BR';
  const yearStr = year < 0 ? `${Math.abs(year)} ${negLabel}` : `Yr ${year}`;
  return era ? `${yearStr} · ${era.name}` : yearStr;
}

/* ─── Date → linear float ───────────────────────────────── */
//
// Linear position: integer part = absolute year, decimal = fractional position
// within that year based on cumulative days. Negative years work naturally.
// Year 0 is valid and maps to linear 0.
//
export function customDateToLinear(date: CustomDate, calendar?: VaultCalendar): number {
  if (!calendar || calendar.months.length === 0) {
    return date.year;
  }
  const totalDays = getTotalDaysInYear(calendar, date.year);
  if (totalDays === 0) return date.year;

  // Sum days of months before this one
  let dayOfYear = date.day;
  for (let i = 1; i < date.month && i <= calendar.months.length; i++) {
    dayOfYear += getDaysInMonth(calendar, date.year, i);
  }
  // Clamp: never go past the end of the year
  const fraction = Math.min((dayOfYear - 1) / totalDays, 0.9999);
  return date.year + fraction;
}

export function parseCustomDate(value: unknown): CustomDate | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.year !== 'number') return null;
  return {
    year: v.year,
    month: typeof v.month === 'number' ? v.month : 1,
    day: typeof v.day === 'number' ? v.day : 1,
  };
}

export function parseCustomDateRange(value: unknown): CustomDateRange | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const start = parseCustomDate(v.start);
  if (!start) return null;
  const ongoing = !!v.ongoing;
  const end = !ongoing ? (parseCustomDate(v.end) ?? undefined) : undefined;
  return { start, end, ongoing };
}

export function formatCustomDateLabel(linear: number, calendar?: VaultCalendar): string {
  if (!calendar) return String(Math.round(linear));
  return yearToLabel(calendar, Math.floor(linear));
}

/* ─── Linear float → CustomDate ─────────────────────────── */

export function linearToCustomDate(linear: number, calendar: VaultCalendar): CustomDate {
  const year     = Math.floor(linear);
  const fraction = linear - year;
  const totalDays = getTotalDaysInYear(calendar, year);

  if (totalDays === 0 || fraction <= 0) return { year, month: 1, day: 1 };

  // fraction = (dayOfYear - 1) / totalDays  →  dayOfYear = round(fraction * totalDays) + 1
  const targetDay = Math.round(fraction * totalDays) + 1;

  let accumulated = 0;
  for (let m = 1; m <= calendar.months.length; m++) {
    const daysInMonth = getDaysInMonth(calendar, year, m);
    if (targetDay <= accumulated + daysInMonth) {
      return { year, month: m, day: Math.max(1, targetDay - accumulated) };
    }
    accumulated += daysInMonth;
  }

  // Clamp to last day of last month
  const lastMonth = calendar.months.length;
  return { year, month: lastMonth, day: getDaysInMonth(calendar, year, lastMonth) };
}

/* ─── Detailed label (month/day aware) ──────────────────── */

export function formatDetailedDateLabel(
  linear: number,
  calendar: VaultCalendar,
  showDay = false,
): string {
  const { year, month, day } = linearToCustomDate(linear, calendar);
  const monthName = calendar.months[month - 1]?.name ?? `M${month}`;
  const eraLabel  = yearToLabel(calendar, year);
  return showDay ? `${monthName} ${day}, ${eraLabel}` : `${monthName}, ${eraLabel}`;
}
