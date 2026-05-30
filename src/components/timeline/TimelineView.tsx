import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useUIStore } from '../../store/ui.store';
import { useVaultData, useVaultStore } from '../../store/vault.store';
import { useShallow } from 'zustand/react/shallow';
import {
  buildTimelineItems,
  generateTicks,
  getEraBands,
  yearToY,
  MONTH_TICK_THRESHOLD,
  DAY_TICK_THRESHOLD,
  type TimelineItem,
  type TimelineSpan,
} from '../../services/timeline.service';
import { formatDetailedDateLabel } from '../../services/calendar.service';
import DynamicIcon from '../ui/DynamicIcon';
import { MagnifyingGlassPlus, MagnifyingGlassMinus, ChartLine, ArrowsOut } from '@phosphor-icons/react';
import styles from './TimelineView.module.css';

const TOP_PAD     = 56;
const MIN_SPACING = 22;
const DEFAULT_PX  = 60;
const MIN_PX      = 6;
const MAX_PX      = 8000;
const AXIS_X      = 88;
const SPAN_BAR_W  = 4;
const SPAN_LANE_W = 12;
const SPAN_OFFSET = 8;

export default function TimelineView() {
  const { setActiveEntityId, setPropertiesPanelOpen } = useUIStore(
    useShallow((s) => ({
      setActiveEntityId:      s.setActiveEntityId,
      setPropertiesPanelOpen: s.setPropertiesPanelOpen,
    })),
  );
  const { entities, schemas } = useVaultData();
  const calendar      = useVaultStore((s) => s.calendar);
  const hiddenTypes   = useVaultStore((s) => s.hiddenTypes);
  const hiddenEntities = useVaultStore((s) => s.hiddenEntities);

  const visibleEntities = useMemo(
    () => entities.filter((e) => !hiddenTypes.includes(e.type) && !hiddenEntities.includes(e.id)),
    [entities, hiddenTypes, hiddenEntities],
  );

  const [pxPerYear, setPxPerYear] = useState(() => useUIStore.getState().timelinePxPerYear);
  const [zoomStr, setZoomStr]     = useState(() => String(Math.round(useUIStore.getState().timelinePxPerYear / DEFAULT_PX * 100)));
  const [scrollTop, setScrollTop] = useState(() => useUIStore.getState().timelineScrollTop);
  const zoomInputFocused    = useRef(false);
  const scrollAreaRef       = useRef<HTMLDivElement>(null);
  const prevPxRef           = useRef(pxPerYear);
  const pendingScrollRef    = useRef<number | null>(null);
  const viewportHRef        = useRef(800); // updated on scroll/resize
  const didRestoreScrollRef = useRef(false);

  // Navigator state
  const [goToYearStr, setGoToYearStr] = useState('');
  const [fromYearStr, setFromYearStr] = useState('');
  const [toYearStr, setToYearStr]     = useState('');

  // Sync zoom input display when pxPerYear changes externally (zoom buttons, fit)
  if (pxPerYear !== prevPxRef.current) {
    prevPxRef.current = pxPerYear;
    if (!zoomInputFocused.current) {
      setZoomStr(String(Math.round(pxPerYear / DEFAULT_PX * 100)));
    }
  }

  // Persist zoom level to store so it survives navigation away and back
  useEffect(() => {
    useUIStore.getState().setTimelinePxPerYear(pxPerYear);
  }, [pxPerYear]);

  // Restore scroll position on mount; apply zoom-triggered scroll corrections on zoom changes
  useLayoutEffect(() => {
    if (!didRestoreScrollRef.current && scrollAreaRef.current) {
      const stored = useUIStore.getState().timelineScrollTop;
      if (stored > 0) scrollAreaRef.current.scrollTop = stored;
      didRestoreScrollRef.current = true;
    }
    if (pendingScrollRef.current !== null && scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = Math.max(0, pendingScrollRef.current);
      pendingScrollRef.current = null;
    }
  }, [pxPerYear]);

  // Schemas with any timeline-visible date fields
  const timelineSchemas = useMemo(
    () => schemas.filter((s) => s.fields.some((f) => f.type === 'date' && f.timelineVisible)),
    [schemas],
  );

  const rawItems = useMemo(
    () => buildTimelineItems(visibleEntities, schemas, calendar ?? undefined),
    [visibleEntities, schemas, calendar],
  );

  // ── Data memo: positions, heights, era bands ─────────────
  // Does NOT include ticks — those are viewport-dependent and live in their own memo.
  const { visMin, visMax, totalHeight, eraBands, positionedItems, spanLaneMap, dataRange } = useMemo(() => {
    const hasEras = calendar && calendar.eras.length > 0;

    if (rawItems.length === 0 && !hasEras) {
      return {
        visMin: 0, visMax: 0, totalHeight: 400, eraBands: [],
        positionedItems: [], spanLaneMap: new Map<string, number>(), dataRange: 0,
      };
    }

    let minL: number, maxL: number;
    if (rawItems.length === 0) {
      minL = Math.min(...calendar!.eras.map((e) => e.startYear));
      const closedEnds = calendar!.eras.filter((e) => e.endYear !== 0).map((e) => e.endYear);
      maxL = closedEnds.length > 0 ? Math.max(...closedEnds) : minL + 1000;
    } else {
      const allLinear = rawItems.flatMap((item) => {
        if (item.kind === 'span') {
          return item.ongoing ? [item.startLinear] : [item.startLinear, item.endLinear];
        }
        return [item.linear];
      });
      minL = Math.min(...allLinear);
      maxL = Math.max(...allLinear);
    }

    if (calendar && calendar.eras.length > 0) {
      const eraStarts = calendar.eras.map((e) => e.startYear);
      const eraEnds   = calendar.eras.filter((e) => e.endYear !== 0).map((e) => e.endYear);
      minL = Math.min(minL, ...eraStarts);
      maxL = Math.max(maxL, ...eraStarts, ...eraEnds);
    }

    const eraBands      = calendar ? getEraBands(calendar, maxL) : [];
    const naturalHeight = TOP_PAD * 2 + (maxL - minL) * pxPerYear;

    const spanItems = rawItems.filter((i): i is TimelineSpan => i.kind === 'span');
    const spanLaneMap = new Map<string, number>();
    const laneEndLinears: number[] = [];
    for (const span of spanItems) {
      let lane = laneEndLinears.findIndex((el) => el <= span.startLinear);
      if (lane === -1) lane = laneEndLinears.length;
      laneEndLinears[lane] = span.endLinear;
      spanLaneMap.set(span.entityId, lane);
    }

    let lastPointY = -Infinity;
    const positionedItems = rawItems.map((item) => {
      if (item.kind === 'span') {
        const y = yearToY(item.startLinear, minL, pxPerYear, TOP_PAD);
        return { item, y };
      }
      const natural = yearToY(item.linear, minL, pxPerYear, TOP_PAD);
      const y = Math.max(natural, lastPointY + MIN_SPACING);
      lastPointY = y;
      return { item, y };
    });

    const lastItemY   = positionedItems.length > 0 ? positionedItems[positionedItems.length - 1].y + 32 : 0;
    const totalHeight = Math.max(naturalHeight, lastItemY + TOP_PAD);

    return { visMin: minL, visMax: maxL, totalHeight, eraBands, positionedItems, spanLaneMap, dataRange: maxL - minL };
  }, [rawItems, pxPerYear, calendar]);

  // Always-current ref so the store subscription below never reads a stale closure
  const positionedItemsRef = useRef(positionedItems);
  positionedItemsRef.current = positionedItems;

  // Scroll to entity when filter panel name is clicked — set up once, reads from refs
  useEffect(() => {
    return useUIStore.subscribe((state, prevState) => {
      if (state.timelineScrollTarget === prevState.timelineScrollTarget) return;
      const target = state.timelineScrollTarget;
      if (!target || !scrollAreaRef.current) return;
      const match = positionedItemsRef.current.find((pi) => pi.item.entityId === target);
      if (match) {
        const el = scrollAreaRef.current;
        el.scrollTop = Math.max(0, match.y - el.clientHeight / 2);
      }
      useUIStore.getState().setTimelineScrollTarget(null);
    });
  }, []);

  // ── Tick memo: only generates ticks for the visible slice ─
  // Re-runs on scroll (cheap — generates ~20–50 ticks max).
  const ticks = useMemo(() => {
    const vh     = viewportHRef.current;
    const buffer = vh / pxPerYear; // one viewport's worth of buffer above + below
    const viewMin = Math.max(visMin, visMin + (scrollTop - TOP_PAD) / pxPerYear - buffer);
    const viewMax = Math.min(visMax, visMin + (scrollTop + vh - TOP_PAD) / pxPerYear + buffer);
    if (viewMin >= viewMax) return [];
    return generateTicks(viewMin, viewMax, pxPerYear, calendar ?? undefined);
  }, [scrollTop, pxPerYear, calendar, visMin, visMax]);

  function zoom(factor: number) {
    const el = scrollAreaRef.current;
    setPxPerYear((prev) => {
      const next = Math.min(MAX_PX, Math.max(MIN_PX, prev * factor));
      if (el && next !== prev) {
        // Keep the linear position at the viewport centre stable after zoom
        const centerLinear = visMin + (el.scrollTop + el.clientHeight / 2 - TOP_PAD) / prev;
        pendingScrollRef.current = TOP_PAD + (centerLinear - visMin) * next - el.clientHeight / 2;
      }
      return next;
    });
  }

  function applyZoomStr() {
    const n = parseInt(zoomStr, 10);
    if (!isNaN(n) && n > 0) {
      const el = scrollAreaRef.current;
      setPxPerYear((prev) => {
        const next = Math.min(MAX_PX, Math.max(MIN_PX, (n / 100) * DEFAULT_PX));
        if (el && next !== prev) {
          const centerLinear = visMin + (el.scrollTop + el.clientHeight / 2 - TOP_PAD) / prev;
          pendingScrollRef.current = TOP_PAD + (centerLinear - visMin) * next - el.clientHeight / 2;
        }
        return next;
      });
    } else {
      setZoomStr(String(Math.round(pxPerYear / DEFAULT_PX * 100)));
    }
  }

  function fitToViewport() {
    if (!scrollAreaRef.current || dataRange === 0) return;
    const availableH = scrollAreaRef.current.clientHeight - TOP_PAD * 2;
    const fitted = Math.max(MIN_PX, Math.min(MAX_PX, availableH / dataRange));
    setPxPerYear(fitted);
  }

  const GOTO_YEAR_ZOOM = MONTH_TICK_THRESHOLD * 2; // 240px/yr — comfortably shows months

  function handleGoToYear() {
    const year = parseInt(goToYearStr, 10);
    if (isNaN(year) || !scrollAreaRef.current) return;
    const el = scrollAreaRef.current;
    // Zoom to month level if not already there; keep existing zoom if already deeper
    const targetPx = Math.max(pxPerYear, GOTO_YEAR_ZOOM);
    if (targetPx !== pxPerYear) {
      flushSync(() => setPxPerYear(targetPx));
    }
    const targetY = yearToY(year, visMin, targetPx, TOP_PAD);
    el.scrollTop = Math.max(0, targetY - el.clientHeight / 2);
  }

  function handleFitToRange() {
    const from = parseInt(fromYearStr, 10);
    const to   = parseInt(toYearStr, 10);
    if (isNaN(from) || isNaN(to) || from >= to || !scrollAreaRef.current) return;
    const el      = scrollAreaRef.current;
    const availH  = el.clientHeight - TOP_PAD * 2;
    const fitted  = Math.max(MIN_PX, Math.min(MAX_PX, availH / (to - from)));
    // flushSync forces React to commit the new canvas height before we set scrollTop
    flushSync(() => setPxPerYear(fitted));
    // Position 'from' at TOP_PAD from the viewport top — 'to' then lands at TOP_PAD from the bottom
    const targetY = yearToY(from, visMin, fitted, TOP_PAD);
    el.scrollTop  = Math.max(0, targetY - TOP_PAD);
  }

  const showMonthDetail = pxPerYear >= MONTH_TICK_THRESHOLD;
  const showDayDetail   = pxPerYear >= DAY_TICK_THRESHOLD;

  function getItemLabel(item: TimelineItem): string {
    if (!showMonthDetail || !calendar) return item.dateLabel;
    if (item.kind === 'point') {
      return formatDetailedDateLabel(item.linear, calendar, showDayDetail);
    }
    const startLabel = formatDetailedDateLabel(item.startLinear, calendar, showDayDetail);
    if (item.ongoing) return `${startLabel} →`;
    return `${startLabel} – ${formatDetailedDateLabel(item.endLinear, calendar, showDayDetail)}`;
  }

  function handleItemClick(entityId: string) {
    setActiveEntityId(entityId);
    setPropertiesPanelOpen(true);
  }

  if (timelineSchemas.length === 0) {
    return (
      <div className={styles.emptyState}>
        <ChartLine size={40} weight="thin" color="var(--text-tertiary)" />
        <p>No timeline fields configured</p>
        <p className={styles.emptyHint}>
          Edit a Type and enable "Show on timeline" on a date field
        </p>
      </div>
    );
  }

  if (rawItems.length === 0 && (!calendar || calendar.eras.length === 0)) {
    return (
      <div className={styles.emptyState}>
        <ChartLine size={40} weight="thin" color="var(--text-tertiary)" />
        <p>No events to display</p>
        <p className={styles.emptyHint}>
          Fill in date fields on your entities to see them here
        </p>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.zoomControls}>
          <button className={styles.zoomBtn} onClick={() => zoom(1.5)} aria-label="Zoom in">
            <MagnifyingGlassPlus size={14} />
          </button>
          <div className={styles.zoomInputWrapper}>
            <input
              className={styles.zoomInput}
              type="text"
              value={zoomStr}
              onChange={(e) => setZoomStr(e.target.value)}
              onFocus={() => { zoomInputFocused.current = true; }}
              onBlur={() => { zoomInputFocused.current = false; applyZoomStr(); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { applyZoomStr(); (e.target as HTMLInputElement).blur(); }
                if (e.key === 'Escape') { setZoomStr(String(Math.round(pxPerYear / DEFAULT_PX * 100))); (e.target as HTMLInputElement).blur(); }
              }}
              aria-label="Zoom percent"
            />
            <span className={styles.zoomPct}>%</span>
          </div>
          <button className={styles.zoomBtn} onClick={() => zoom(1 / 1.5)} aria-label="Zoom out">
            <MagnifyingGlassMinus size={14} />
          </button>
          <button className={styles.zoomBtn} onClick={fitToViewport} aria-label="Fit timeline to viewport">
            <ArrowsOut size={14} />
          </button>
        </div>

        <div className={styles.toolbarSpacer} />

        {/* Navigator */}
        <div className={styles.navControls}>
          <span className={styles.navLabel}>Go to</span>
          <input
            className={styles.navInput}
            type="text"
            value={goToYearStr}
            onChange={(e) => setGoToYearStr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { handleGoToYear(); (e.target as HTMLInputElement).blur(); }
            }}
            placeholder="Year"
            aria-label="Go to year"
          />
          <button className={styles.navFitBtn} onClick={handleGoToYear}>Go</button>
          <div className={styles.navSep} />
          <span className={styles.navLabel}>Fit</span>
          <input
            className={styles.navInput}
            type="text"
            value={fromYearStr}
            onChange={(e) => setFromYearStr(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleFitToRange(); }}
            placeholder="From"
            aria-label="Fit from year"
          />
          <span className={styles.navLabel}>–</span>
          <input
            className={styles.navInput}
            type="text"
            value={toYearStr}
            onChange={(e) => setToYearStr(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleFitToRange(); }}
            placeholder="To"
            aria-label="Fit to year"
          />
          <button className={styles.navFitBtn} onClick={handleFitToRange}>
            Fit
          </button>
        </div>
      </div>

      {/* Scrollable canvas */}
      <div
        className={styles.scrollArea}
        ref={scrollAreaRef}
        onScroll={(e) => {
          const top = e.currentTarget.scrollTop;
          setScrollTop(top);
          viewportHRef.current = e.currentTarget.clientHeight;
          useUIStore.getState().setTimelineScrollTop(top);
        }}
      >
        <div className={styles.canvas} style={{ height: totalHeight }}>

          {/* Era bands (background shading) */}
          {(() => {
            let stackedLabelY = 6;
            return eraBands.map((band) => {
              const y1 = yearToY(band.startLinear, visMin, pxPerYear, TOP_PAD);
              const y2 = yearToY(band.endLinear,   visMin, pxPerYear, TOP_PAD);
              // Clamp band to the visible canvas area to avoid huge off-screen elements
              const clampedTop    = Math.max(y1, 0);
              const clampedBottom = Math.max(clampedTop + 4, Math.min(y2, totalHeight));
              const clampedHeight = clampedBottom - clampedTop;

              // Stack labels when multiple eras are all clamped to the top
              let labelTopInBand: number;
              if (y1 < 4) {
                labelTopInBand = stackedLabelY - clampedTop;
                stackedLabelY += 20;
              } else {
                labelTopInBand = 4;
              }

              const bandBg    = band.color ? `${band.color}18` : undefined;
              const bandBorder = band.color ? `${band.color}40` : undefined;

              return (
                <div
                  key={band.name}
                  className={styles.eraBand}
                  style={{
                    top: clampedTop,
                    height: clampedHeight,
                    ...(bandBg    ? { background: bandBg }        : {}),
                    ...(bandBorder ? { borderTopColor: bandBorder } : {}),
                  }}
                >
                  <span
                    className={styles.eraBandLabel}
                    style={{
                      top: labelTopInBand,
                      ...(band.color ? { color: band.color } : {}),
                    }}
                  >
                    {band.name}
                  </span>
                </div>
              );
            });
          })()}

          {/* Axis line */}
          <div className={styles.axisLine} style={{ left: AXIS_X }} />

          {/* Tick marks + labels */}
          {ticks.map((tick) => {
            const y = yearToY(tick.linear, visMin, pxPerYear, TOP_PAD);
            return (
              <div
                key={`${tick.linear}-${tick.label}`}
                className={[
                  styles.tickRow,
                  tick.major ? styles.tickMajor : '',
                  tick.isEraBoundary ? styles.tickEraBoundary : '',
                ].join(' ')}
                style={{ top: y, '--axis-x': `${AXIS_X}px` } as React.CSSProperties}
              >
                <span className={styles.tickLabel}>{tick.label}</span>
                <span className={styles.tickMark} />
              </div>
            );
          })}

          {/* Events — only render items visible in the current scroll window */}
          {positionedItems.filter(({ y }) =>
            y >= scrollTop - 80 && y <= scrollTop + viewportHRef.current + 80
          ).map(({ item, y }) => {
            if (item.kind === 'span') {
              const lane      = spanLaneMap.get(item.entityId) ?? 0;
              const barLeft   = AXIS_X + SPAN_OFFSET + lane * SPAN_LANE_W;
              const labelLeft = barLeft + SPAN_BAR_W + 6;
              const y2        = item.ongoing
                ? totalHeight
                : yearToY(item.endLinear, visMin, pxPerYear, TOP_PAD);
              const spanHeight = Math.max(8, y2 - y);

              return (
                <div key={`${item.entityId}-span`} className={styles.spanItem} style={{ top: y }}>
                  <div
                    className={styles.spanBar}
                    style={{
                      left:       barLeft,
                      height:     spanHeight,
                      width:      SPAN_BAR_W,
                      background: item.ongoing
                        ? `linear-gradient(to bottom, ${item.entityColor}b3 60%, transparent)`
                        : item.entityColor,
                      opacity: item.ongoing ? 1 : 0.7,
                    }}
                  />
                  <button
                    className={styles.eventLabel}
                    style={{ left: labelLeft }}
                    onClick={() => handleItemClick(item.entityId)}
                  >
                    <DynamicIcon name={item.entityIcon} size={12} color={item.entityColor} />
                    <span style={{ color: item.entityColor }}>{item.entityTitle}</span>
                    <span className={styles.itemYear}>{getItemLabel(item)}</span>
                  </button>
                </div>
              );
            }

            return (
              <div
                key={`${item.entityId}-${item.fieldLabel}`}
                className={styles.pointItem}
                style={{ top: y, left: AXIS_X }}
              >
                <div className={styles.pointDot} style={{ background: item.entityColor }} />
                <button
                  className={styles.eventLabel}
                  style={{ position: 'relative', left: 'unset', transform: 'none' }}
                  onClick={() => handleItemClick(item.entityId)}
                >
                  <DynamicIcon name={item.entityIcon} size={12} color={item.entityColor} />
                  <span>{item.entityTitle}</span>
                  {item.fieldLabel && <span className={styles.fieldTag}>· {item.fieldLabel}</span>}
                  <span className={styles.itemYear}>{getItemLabel(item)}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
