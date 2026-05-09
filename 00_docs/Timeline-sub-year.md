# Feature: Timeline Sub-Year Zoom & Navigation

## Overview

Extend the timeline to support zooming into individual months and days within a year,
and add a date range navigator so users can jump directly to a specific year or period.

This is required for novel-level granularity — placing scene-level events, character
actions, and short-duration spans (days/weeks) on the same timeline as long eras.

Estimated total work: ~2 days.

---

## Current State

- `customDateToLinear()` already encodes month/day as a decimal fraction of the year,
  so event positions are sub-year accurate right now.
- `yearToY()` uses the full float, so dots and span bars are already placed correctly
  at month/day precision — the axis just doesn't show it.
- `generateTicks()` only emits whole-year intervals (minimum step = 1).
- `yearToLabel()` calls `Math.floor(linear)` — month/day info is discarded for labels.
- `MAX_PX = 600` (pixels per year). At day-level granularity you need ~3,600–8,000+.

---

## Part 1 — Month/Day Zoom (~6–8 hours)

### 1a. Inverse linear→date function

**File:** `src/services/calendar.service.ts`

Add a new export:

```typescript
export function linearToCustomDate(linear: number, calendar: VaultCalendar): CustomDate
```

Algorithm:
- Extract `year = Math.floor(linear)` and `fraction = linear - year`
- Compute `totalDays = getTotalDaysInYear(calendar, year)`
- The fraction represents `dayOfYear / totalDays` (see `customDateToLinear`)
- `targetDay = Math.round(fraction * totalDays) + 1` (1-based)
- Walk `calendar.months`, accumulating days with `getDaysInMonth(calendar, year, monthIndex)`,
  until cumulative days >= targetDay to find the month
- Subtract accumulated days to get the day-within-month
- Return `{ year, month, monthIndex, day }`

Edge cases:
- Negative years: `getDaysInMonth` already handles negative years (leap year uses `Math.abs`)
- Fraction = 0: return month 1, day 1
- Fraction at or near 1: clamp to last day of last month

### 1b. Detailed label formatter

**File:** `src/services/calendar.service.ts`

Add:

```typescript
export function formatDetailedDateLabel(
  linear: number,
  calendar: VaultCalendar,
  showDay = false,
): string
```

- Calls `linearToCustomDate(linear, calendar)`
- Returns `"Month Day, Yr N · EraName"` or `"Month, Yr N · EraName"` depending on `showDay`
- Month name comes from `calendar.months[monthIndex - 1].name`
- Year/era suffix reuses `yearToLabel(calendar, year)` logic

Also update `formatCustomDateLabel` to accept an optional detail level so event labels
on the canvas can show month/day when the zoom is high enough.

### 1c. Raise MAX_PX and zoom scale

**File:** `src/components/timeline/TimelineView.tsx`

```typescript
const MAX_PX = 8000; // was 600
```

At 8000px/year with a 30-day month, each day is ~267px — comfortable for day ticks.
At 6000px/year each day is ~200px. The zoom % display will reach large numbers;
consider switching the input label to show "px/yr" at very high zoom, or just let
large percentages display (1000%+, 10000%+ are valid).

### 1d. Sub-year tick generation

**File:** `src/services/timeline.service.ts` — `generateTicks()`

Add zoom-level branching before the existing year-interval logic:

```typescript
// Thresholds (tune as needed)
const MONTH_TICK_THRESHOLD = 120; // pxPerYear where months become visible
const DAY_TICK_THRESHOLD   = 800; // pxPerYear where days become visible
```

**Month ticks** (`pxPerYear >= MONTH_TICK_THRESHOLD && calendar`):

```
for each year from Math.floor(minLinear) to Math.floor(maxLinear):
  for each month 1..calendar.months.length:
    linear = customDateToLinear({ year, month, day: 1 }, calendar)
    if linear < minLinear or linear > maxLinear: skip
    label = calendar.months[month-1].name  (major tick)
    push tick { linear, label, major: true, isEraBoundary: false }
  also push a year-boundary tick for the year start (major, bold)
```

**Day ticks** (`pxPerYear >= DAY_TICK_THRESHOLD && calendar`):
Only emit ticks for the visible year range (keep total tick count sane):

```
for each year in view:
  for each month:
    daysInMonth = getDaysInMonth(calendar, year, month)
    for day = 1, 5, 10, 15, 20, 25, ...daysInMonth (every 5 days, or every day if very zoomed):
      linear = customDateToLinear({ year, month, day }, calendar)
      label  = String(day)
      push tick { linear, label, major: day === 1, isEraBoundary: false }
```

Emit days every 1 at extreme zoom, every 5 at moderate day-zoom. Tune with a secondary
threshold or derive from how many px a single day occupies:

```typescript
const pxPerDay = pxPerYear / (totalDaysInYear(calendar, year));
const dayStep  = pxPerDay >= 15 ? 1 : pxPerDay >= 8 ? 5 : 10;
```

**Compatibility:** Keep the existing year-interval logic as the fallback
(`pxPerYear < MONTH_TICK_THRESHOLD`). Era boundary ticks should still be injected
after month/day ticks and override nearby ticks at the boundary year.

### 1e. Event label detail level

**File:** `src/components/timeline/TimelineView.tsx`

Pass `pxPerYear` into the label formatter for events. At high zoom, show month/day
in the date label on point and span items:

```typescript
const showMonthDetail = pxPerYear >= MONTH_TICK_THRESHOLD;
const showDayDetail   = pxPerYear >= DAY_TICK_THRESHOLD;
```

Use `formatDetailedDateLabel(linear, calendar, showDayDetail)` for event labels
when `showMonthDetail` is true, falling back to the existing `formatCustomDateLabel`
at lower zoom.

---

## Part 2 — Date Range Navigator (~3–5 hours)

### 2a. "Go to year" input

**File:** `src/components/timeline/TimelineView.tsx` — toolbar

Add a text input in the toolbar (right side, or its own group):

```
[ Go to year: _____ ]
```

On Enter/blur:
- Parse the integer year
- Compute `targetY = yearToY(year, visMin, pxPerYear, TOP_PAD)`
- Set `scrollAreaRef.current.scrollTop = targetY - scrollAreaRef.current.clientHeight / 2`
  (centres the year vertically in the viewport)

Uses the same `scrollAreaRef` already attached to the scroll area for the fit button.

State: local `useState<string>` in the component, same pattern as `zoomStr`.

### 2b. "Fit to range" control

**File:** `src/components/timeline/TimelineView.tsx` — toolbar

Two year inputs: **From** and **To**. A "Fit" button beside them:

```
[ From: _____ ]  [ To: _____ ]  [Fit]
```

On Fit click:
1. Parse `fromYear` and `toYear`
2. Compute `rangeLinear = toYear - fromYear`
3. `fittedPx = (scrollAreaRef.current.clientHeight - TOP_PAD * 2) / rangeLinear`
4. `setPxPerYear(clamp(fittedPx, MIN_PX, MAX_PX))`
5. After state update, scroll to `yearToY(fromYear, visMin, fittedPx, TOP_PAD)`
   — use a `useEffect` with a flag or `setTimeout(0)` to scroll after the render
   that applies the new pxPerYear, since scrolling before the canvas height updates
   will land in the wrong position.

### 2c. Toolbar layout

When both zoom controls and navigation controls are present the toolbar may get crowded.
Suggested layout:

```
[+] [ 100% ] [-] [⊡]          [spacer flex:1]       [ Yr: ___ ]  [ ___ – ___ ] [Fit]
```

Or put the navigator in a collapsible section / popover to keep the toolbar clean.
Use the existing `.zoomControls` pattern for grouping.

---

## Key Files Reference

| File | Role |
|------|------|
| `src/services/calendar.service.ts` | Add `linearToCustomDate`, `formatDetailedDateLabel` |
| `src/services/timeline.service.ts` | Update `generateTicks` with month/day branching |
| `src/components/timeline/TimelineView.tsx` | Raise `MAX_PX`, add navigator UI, pass detail level to labels |
| `src/components/timeline/TimelineView.module.css` | Navigator input styles |

No changes needed to:
- The `CustomDate` / `CustomDateRange` types (already store year/month/day)
- `customDateToLinear` (already produces correct sub-year floats)
- `yearToY` (already uses the full float)
- The vault/entity/schema system (no data model changes)

---

## Thresholds to Tune

These should be adjusted based on feel during implementation:

| Constant | Suggested value | Meaning |
|----------|----------------|---------|
| `MAX_PX` | 8000 | Max pixels per year |
| `MONTH_TICK_THRESHOLD` | 120 | px/yr at which month ticks appear |
| `DAY_TICK_THRESHOLD` | 800 | px/yr at which day ticks appear |
| `pxPerDay` for step=1 | ≥ 15px | Show every day |
| `pxPerDay` for step=5 | ≥ 8px | Show every 5th day |

---

## Testing Checklist

- [ ] Zoom to month level: month names appear on axis, year labels still present at boundaries
- [ ] Zoom to day level: day numbers appear, month names remain at month boundaries
- [ ] Negative years (pre-zero eras): `linearToCustomDate` handles negative year correctly
- [ ] Leap years: month with extra days expands correctly at day zoom
- [ ] Custom month lengths: uneven month sizes position ticks at correct fractional positions
- [ ] Era boundary ticks do not duplicate with month/day ticks at boundaries
- [ ] Go to year: scrolls and centres correctly, including negative years
- [ ] Fit to range: pxPerYear clamps, scroll lands at correct position after render
- [ ] Event labels: show month/day at high zoom, revert to year-only at low zoom
- [ ] Ongoing spans: still extend to canvas bottom at all zoom levels
