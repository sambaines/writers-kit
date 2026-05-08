import { useMemo, useState } from 'react';
import { useUIStore } from '../../store/ui.store';
import { useVaultData } from '../../store/vault.store';
import { useShallow } from 'zustand/react/shallow';
import {
  buildTimelineItems,
  computeEraOffsets,
  parseCalendarEntity,
  generateTicks,
  yearToY,
  type TimelineSpan,
} from '../../services/timeline.service';
import DynamicIcon from '../ui/DynamicIcon';
import { MagnifyingGlassPlus, MagnifyingGlassMinus, ChartLine } from '@phosphor-icons/react';
import styles from './TimelineView.module.css';

const TOP_PAD      = 56;
const MIN_SPACING  = 22;
const DEFAULT_PX   = 60;
const MIN_PX       = 6;
const MAX_PX       = 600;
const AXIS_X       = 88;
const SPAN_BAR_W   = 4;
const SPAN_LANE_W  = 12;
const SPAN_OFFSET  = 8;
const ERA_BAR_W    = 6;

export default function TimelineView() {
  const {
    setActiveEntityId, setPropertiesPanelOpen,
    activeCalendarId, setActiveCalendarId,
  } = useUIStore(
    useShallow((s) => ({
      setActiveEntityId:      s.setActiveEntityId,
      setPropertiesPanelOpen: s.setPropertiesPanelOpen,
      activeCalendarId:       s.activeCalendarId,
      setActiveCalendarId:    s.setActiveCalendarId,
    })),
  );
  const { entities, schemas } = useVaultData();

  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [pxPerYear, setPxPerYear]     = useState(DEFAULT_PX);

  // Compute era offsets from all Era entities (ordering by 'number' field)
  const eraOffsets = useMemo(() => computeEraOffsets(entities), [entities]);

  // Parse the active calendar entity
  const calendarEntities = useMemo(
    () => entities.filter((e) => e.type === 'Calendar' && !e.archived),
    [entities],
  );
  const activeCalendarEntity = calendarEntities.find((e) => e.id === activeCalendarId);
  const activeCalendar = activeCalendarEntity ? parseCalendarEntity(activeCalendarEntity) : undefined;

  // Schemas that have timeline-visible date fields, plus Era (always shown)
  const timelineSchemas = useMemo(
    () => schemas.filter(
      (s) => s.name === 'Era' || s.fields.some((f) => f.type === 'date' && f.timelineVisible),
    ),
    [schemas],
  );

  const activeFilter = filterTypes.length > 0 ? filterTypes : undefined;
  const rawItems = useMemo(
    () => buildTimelineItems(entities, schemas, eraOffsets, activeCalendar, activeFilter),
    [entities, schemas, eraOffsets, activeCalendar, activeFilter], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const { visMin, totalHeight, ticks, positionedItems, spanLaneMap } = useMemo(() => {
    if (rawItems.length === 0) {
      return {
        visMin: 0, totalHeight: 400, ticks: [],
        positionedItems: [], spanLaneMap: new Map<string, number>(),
      };
    }

    const allLinear = rawItems.flatMap((item) =>
      item.kind === 'span' ? [item.startLinear, item.endLinear] : [item.linear],
    );
    const minL = Math.min(...allLinear);
    const maxL = Math.max(...allLinear);
    const visMin = minL;
    const visMax = maxL;

    const ticks = generateTicks(visMin, visMax, pxPerYear, eraOffsets);
    const naturalHeight = TOP_PAD * 2 + (visMax - visMin) * pxPerYear;

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
        const y = yearToY(item.startLinear, visMin, pxPerYear, TOP_PAD);
        return { item, y };
      }
      const natural = yearToY(item.linear, visMin, pxPerYear, TOP_PAD);
      const y = Math.max(natural, lastPointY + MIN_SPACING);
      lastPointY = y;
      return { item, y };
    });

    const lastItemY = positionedItems.length > 0
      ? positionedItems[positionedItems.length - 1].y + 32
      : 0;
    const totalHeight = Math.max(naturalHeight, lastItemY + TOP_PAD);

    return { visMin, totalHeight, ticks, positionedItems, spanLaneMap };
  }, [rawItems, pxPerYear, eraOffsets]);

  function toggleFilter(typeName: string) {
    setFilterTypes((prev) =>
      prev.includes(typeName) ? prev.filter((t) => t !== typeName) : [...prev, typeName],
    );
  }

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

  if (rawItems.length === 0) {
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
        <div className={styles.filterChips}>
          {timelineSchemas.map((schema) => {
            const active = filterTypes.includes(schema.name);
            return (
              <button
                key={schema.id}
                className={`${styles.chip} ${active ? styles.chipActive : ''}`}
                style={active ? {
                  borderColor: schema.color,
                  color:       schema.color,
                  background:  `${schema.color}22`,
                } : undefined}
                onClick={() => toggleFilter(schema.name)}
              >
                <DynamicIcon name={schema.icon} size={11} color={active ? schema.color : undefined} />
                <span>{schema.name}</span>
              </button>
            );
          })}
        </div>

        {/* Calendar picker */}
        {calendarEntities.length > 0 && (
          <select
            className={styles.calendarPicker}
            value={activeCalendarId ?? ''}
            onChange={(e) => setActiveCalendarId(e.target.value || null)}
            title="Select calendar"
          >
            <option value="">No calendar</option>
            {calendarEntities.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        )}

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
              const barW      = item.isEra ? ERA_BAR_W : SPAN_BAR_W;
              const barLeft   = AXIS_X + SPAN_OFFSET + lane * SPAN_LANE_W;
              const labelLeft = barLeft + barW + 6;
              const y2        = yearToY(item.endLinear, visMin, pxPerYear, TOP_PAD);
              const spanHeight = Math.max(8, y2 - y);

              return (
                <div key={`${item.entityId}-span`} className={styles.spanItem} style={{ top: y }}>
                  <div
                    className={styles.spanBar}
                    style={{
                      left:       barLeft,
                      height:     spanHeight,
                      width:      barW,
                      background: item.entityColor,
                      opacity:    item.isEra ? 0.4 : 0.7,
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
