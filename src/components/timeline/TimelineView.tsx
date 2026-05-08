import { useMemo, useState } from 'react';
import { useUIStore } from '../../store/ui.store';
import { useVaultData, useVaultStore } from '../../store/vault.store';
import { useShallow } from 'zustand/react/shallow';
import {
  buildTimelineItems,
  generateTicks,
  getEraBands,
  yearToY,
  type TimelineSpan,
} from '../../services/timeline.service';
import DynamicIcon from '../ui/DynamicIcon';
import { MagnifyingGlassPlus, MagnifyingGlassMinus, ChartLine } from '@phosphor-icons/react';
import styles from './TimelineView.module.css';

const TOP_PAD     = 56;
const MIN_SPACING = 22;
const DEFAULT_PX  = 60;
const MIN_PX      = 6;
const MAX_PX      = 600;
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
  const calendar = useVaultStore((s) => s.calendar);

  const [pxPerYear, setPxPerYear] = useState(DEFAULT_PX);

  // Schemas with any timeline-visible date fields
  const timelineSchemas = useMemo(
    () => schemas.filter((s) => s.fields.some((f) => f.type === 'date' && f.timelineVisible)),
    [schemas],
  );

  const rawItems = useMemo(
    () => buildTimelineItems(entities, schemas, calendar ?? undefined),
    [entities, schemas, calendar],
  );

  const { visMin, totalHeight, ticks, eraBands, positionedItems, spanLaneMap } = useMemo(() => {
    const hasEras = calendar && calendar.eras.length > 0;

    if (rawItems.length === 0 && !hasEras) {
      return {
        visMin: 0, totalHeight: 400, ticks: [], eraBands: [],
        positionedItems: [], spanLaneMap: new Map<string, number>(),
      };
    }

    let minL: number, maxL: number;
    if (rawItems.length === 0) {
      // No events — derive visible range from era boundaries
      minL = Math.min(...calendar!.eras.map((e) => e.startYear));
      const closedEnds = calendar!.eras.filter((e) => e.endYear !== 0).map((e) => e.endYear);
      maxL = closedEnds.length > 0 ? Math.max(...closedEnds) : minL + 1000;
    } else {
      const allLinear = rawItems.flatMap((item) => {
        if (item.kind === 'span') {
          // Exclude endLinear for ongoing spans — they extend to canvas bottom, not a real date
          return item.ongoing ? [item.startLinear] : [item.startLinear, item.endLinear];
        }
        return [item.linear];
      });
      minL = Math.min(...allLinear);
      maxL = Math.max(...allLinear);
    }

    // Extend range to include era boundaries so eras that start/end beyond event dates are visible
    if (calendar && calendar.eras.length > 0) {
      const eraStarts = calendar.eras.map((e) => e.startYear);
      const eraEnds   = calendar.eras.filter((e) => e.endYear !== 0).map((e) => e.endYear);
      minL = Math.min(minL, ...eraStarts);
      maxL = Math.max(maxL, ...eraStarts, ...eraEnds);
    }

    const ticks    = generateTicks(minL, maxL, pxPerYear, calendar ?? undefined);
    const eraBands = calendar ? getEraBands(calendar, maxL) : [];
    const naturalHeight = TOP_PAD * 2 + (maxL - minL) * pxPerYear;

    // Assign overlapping spans to horizontal lanes
    const spanItems = rawItems.filter((i): i is TimelineSpan => i.kind === 'span');
    const spanLaneMap = new Map<string, number>();
    const laneEndLinears: number[] = [];
    for (const span of spanItems) {
      let lane = laneEndLinears.findIndex((el) => el <= span.startLinear);
      if (lane === -1) lane = laneEndLinears.length;
      laneEndLinears[lane] = span.endLinear;
      spanLaneMap.set(span.entityId, lane);
    }

    // Enforce minimum vertical spacing for point labels
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

    const lastItemY = positionedItems.length > 0
      ? positionedItems[positionedItems.length - 1].y + 32
      : 0;
    const totalHeight = Math.max(naturalHeight, lastItemY + TOP_PAD);

    return { visMin: minL, totalHeight, ticks, eraBands, positionedItems, spanLaneMap };
  }, [rawItems, pxPerYear, calendar]);

  function zoom(factor: number) {
    setPxPerYear((prev) => Math.min(MAX_PX, Math.max(MIN_PX, prev * factor)));
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
          <button className={styles.zoomBtn} onClick={() => zoom(1 / 1.5)} aria-label="Zoom out">
            <MagnifyingGlassMinus size={14} />
          </button>
        </div>
      </div>

      {/* Scrollable canvas */}
      <div className={styles.scrollArea}>
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

          {/* Events */}
          {positionedItems.map(({ item, y }) => {
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
                    <DynamicIcon name={item.entityIcon} size={12} color={item.entityColor} weight="duotone" />
                    <span style={{ color: item.entityColor }}>{item.entityTitle}</span>
                    <span className={styles.itemYear}>{item.dateLabel}</span>
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
                  <DynamicIcon name={item.entityIcon} size={12} color={item.entityColor} weight="duotone" />
                  <span>{item.entityTitle}</span>
                  {item.fieldLabel && <span className={styles.fieldTag}>· {item.fieldLabel}</span>}
                  <span className={styles.itemYear}>{item.dateLabel}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
