import { useMemo, useState } from 'react';
import { useUIStore } from '../../store/ui.store';
import { useVaultData } from '../../store/vault.store';
import { useShallow } from 'zustand/react/shallow';
import {
  buildTimelineItems,
  generateTicks,
  yearToY,
} from '../../services/timeline.service';
import DynamicIcon from '../ui/DynamicIcon';
import { MagnifyingGlassPlus, MagnifyingGlassMinus, ChartLine } from '@phosphor-icons/react';
import styles from './TimelineView.module.css';

const TOP_PAD = 56;
const MIN_ITEM_SPACING = 22; // px minimum between vertically adjacent items
const DEFAULT_PX_PER_YEAR = 60;
const MIN_PX = 6;
const MAX_PX = 600;
const AXIS_X = 88; // px from left edge of canvas to the axis line

export default function TimelineView() {
  const { setActiveEntityId, setPropertiesPanelOpen } = useUIStore(
    useShallow((s) => ({
      setActiveEntityId:      s.setActiveEntityId,
      setPropertiesPanelOpen: s.setPropertiesPanelOpen,
    })),
  );
  const { entities, schemas } = useVaultData();

  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [pxPerYear, setPxPerYear] = useState(DEFAULT_PX_PER_YEAR);

  // Only schemas that have at least one timelineVisible date field
  const timelineSchemas = useMemo(
    () => schemas.filter((s) => s.fields.some((f) => f.type === 'date' && f.timelineVisible)),
    [schemas],
  );

  const activeFilter = filterTypes.length > 0 ? filterTypes : undefined;

  const rawItems = useMemo(
    () => buildTimelineItems(entities, schemas, activeFilter),
    [entities, schemas, activeFilter],
  );

  const { visMin, totalHeight, ticks, positionedItems } = useMemo(() => {
    if (rawItems.length === 0) {
      return { visMin: 0, totalHeight: 400, ticks: [], positionedItems: [] };
    }

    const allYears = rawItems.flatMap((item) =>
      item.kind === 'span' ? [item.startYear, item.endYear] : [item.year],
    );
    const minY = Math.min(...allYears);
    const maxY = Math.max(...allYears);
    const pad = Math.max(5, Math.ceil((maxY - minY) * 0.05));
    const visMin = minY - pad;
    const visMax = maxY + pad;

    const ticks = generateTicks(visMin, visMax, pxPerYear);
    const naturalHeight = TOP_PAD * 2 + (visMax - visMin) * pxPerYear;

    // Enforce minimum spacing between items so labels don't collide
    let lastY = -Infinity;
    const positionedItems = rawItems.map((item) => {
      const naturalY =
        item.kind === 'span'
          ? yearToY(item.startYear, visMin, pxPerYear, TOP_PAD)
          : yearToY(item.year, visMin, pxPerYear, TOP_PAD);
      const y = Math.max(naturalY, lastY + MIN_ITEM_SPACING);
      lastY = y;
      return { item, y };
    });

    const lastItemY =
      positionedItems.length > 0
        ? positionedItems[positionedItems.length - 1].y + 32
        : 0;
    const totalHeight = Math.max(naturalHeight, lastItemY + TOP_PAD);

    return { visMin, totalHeight, ticks, positionedItems };
  }, [rawItems, pxPerYear]);

  function toggleFilter(typeName: string) {
    setFilterTypes((prev) =>
      prev.includes(typeName)
        ? prev.filter((t) => t !== typeName)
        : [...prev, typeName],
    );
  }

  function zoom(factor: number) {
    setPxPerYear((prev) => Math.min(MAX_PX, Math.max(MIN_PX, prev * factor)));
  }

  function handleItemClick(entityId: string) {
    setActiveEntityId(entityId);
    setPropertiesPanelOpen(true);
  }

  // Empty states
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
                style={
                  active
                    ? {
                        borderColor: schema.color,
                        color: schema.color,
                        background: `${schema.color}22`,
                      }
                    : undefined
                }
                onClick={() => toggleFilter(schema.name)}
              >
                <DynamicIcon
                  name={schema.icon}
                  size={11}
                  color={active ? schema.color : undefined}
                />
                <span>{schema.name}</span>
              </button>
            );
          })}
        </div>
        <div className={styles.zoomControls}>
          <button
            className={styles.zoomBtn}
            onClick={() => zoom(1.5)}
            aria-label="Zoom in"
          >
            <MagnifyingGlassPlus size={14} />
          </button>
          <button
            className={styles.zoomBtn}
            onClick={() => zoom(1 / 1.5)}
            aria-label="Zoom out"
          >
            <MagnifyingGlassMinus size={14} />
          </button>
        </div>
      </div>

      {/* Scrollable canvas */}
      <div className={styles.scrollArea}>
        <div className={styles.canvas} style={{ height: totalHeight }}>
          {/* Axis line */}
          <div className={styles.axisLine} style={{ left: AXIS_X }} />

          {/* Tick marks + year labels */}
          {ticks.map((tick) => {
            const y = yearToY(tick.year, visMin, pxPerYear, TOP_PAD);
            return (
              <div
                key={tick.year}
                className={`${styles.tickRow} ${tick.major ? styles.tickMajor : ''}`}
                style={{ top: y, '--axis-x': `${AXIS_X}px` } as React.CSSProperties}
              >
                <span className={styles.tickLabel}>{tick.year}</span>
                <span className={styles.tickMark} />
              </div>
            );
          })}

          {/* Events */}
          {positionedItems.map(({ item, y }) => {
            if (item.kind === 'span') {
              const y2Natural = yearToY(item.endYear, visMin, pxPerYear, TOP_PAD);
              const spanHeight = Math.max(8, y2Natural - y);
              return (
                <div
                  key={`${item.entityId}-span`}
                  className={styles.spanItem}
                  style={{ top: y, left: AXIS_X }}
                >
                  <div
                    className={styles.spanBar}
                    style={{ height: spanHeight, background: item.entityColor }}
                  />
                  <button
                    className={styles.eventLabel}
                    onClick={() => handleItemClick(item.entityId)}
                  >
                    <DynamicIcon
                      name={item.entityIcon}
                      size={12}
                      color={item.entityColor}
                      weight="duotone"
                    />
                    <span style={{ color: item.entityColor }}>{item.entityTitle}</span>
                    <span className={styles.itemYear}>
                      {item.startYear} – {item.endYear}
                    </span>
                  </button>
                </div>
              );
            } else {
              return (
                <div
                  key={`${item.entityId}-${item.fieldLabel}`}
                  className={styles.pointItem}
                  style={{ top: y, left: AXIS_X }}
                >
                  <div
                    className={styles.pointDot}
                    style={{ background: item.entityColor }}
                  />
                  <button
                    className={styles.eventLabel}
                    onClick={() => handleItemClick(item.entityId)}
                  >
                    <DynamicIcon
                      name={item.entityIcon}
                      size={12}
                      color={item.entityColor}
                      weight="duotone"
                    />
                    <span>{item.entityTitle}</span>
                    {item.fieldLabel && (
                      <span className={styles.fieldTag}>· {item.fieldLabel}</span>
                    )}
                    <span className={styles.itemYear}>{item.year}</span>
                  </button>
                </div>
              );
            }
          })}
        </div>
      </div>
    </div>
  );
}
