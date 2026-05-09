import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ArrowCounterClockwise, CaretDown, CaretRight, Warning } from '@phosphor-icons/react';
import { useVaultData, useVaultStore } from '../../store/vault.store';
import { buildTimelineItems } from '../../services/timeline.service';
import DynamicIcon from '../ui/DynamicIcon';
import styles from './TimelineFilterPanel.module.css';

function pluralize(word: string): string {
  if (!word) return word;
  if (/(?:s|x|z|ch|sh)$/i.test(word)) return word + 'es';
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + 'ies';
  return word + 's';
}

export default function TimelineFilterPanel() {
  const { entities, schemas } = useVaultData();
  const calendar = useVaultStore((s) => s.calendar);
  const { hiddenTypes, hiddenEntities, toggleTimelineType, toggleTimelineEntity, resetTimelineFilters } =
    useVaultStore(
      useShallow((s) => ({
        hiddenTypes:           s.hiddenTypes,
        hiddenEntities:        s.hiddenEntities,
        toggleTimelineType:    s.toggleTimelineType,
        toggleTimelineEntity:  s.toggleTimelineEntity,
        resetTimelineFilters:  s.resetTimelineFilters,
      })),
    );

  // Track which groups are collapsed (all open by default)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggleCollapsed(name: string) {
    setCollapsed((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  // Build groups using the same logic as buildTimelineItems so we catch
  // both schema-level fields and per-entity __customFields.
  const groups = useMemo(() => {
    // Run over ALL entities (unfiltered) to find what types produce timeline items
    const allItems = buildTimelineItems(entities, schemas, calendar ?? undefined);
    const typesWithItems = new Set(allItems.map((i) => i.entityType));
    // Also include types whose schema explicitly declares timeline field types
    // (covers entity types where no entity has a date set yet)
    for (const s of schemas) {
      if (s.fields.some((f) => f.type === 'custom-date' || f.type === 'custom-date-range')) {
        typesWithItems.add(s.name);
      }
    }

    // Build a set of entity IDs that actually produce timeline items
    const itemEntityIds = new Set(allItems.map((i) => i.entityId));

    return [...typesWithItems]
      .sort()
      .map((typeName) => {
        const schema = schemas.find((s) => s.name === typeName);
        const members = entities
          .filter((e) => e.type === typeName && !e.archived)
          .map((entity) => ({ entity, hasDate: itemEntityIds.has(entity.id) }))
          .sort((a, b) => a.entity.title.localeCompare(b.entity.title));
        return { schema, typeName, members };
      })
      .filter((g) => g.members.length > 0);
  }, [schemas, entities, calendar]);

  const hasAnyFilter = hiddenTypes.length > 0 || hiddenEntities.length > 0;

  if (groups.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>Filters</span>
        </div>
        <div className={styles.empty}>
          <span className={styles.emptyText}>No timeline fields configured</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Filters</span>
        {hasAnyFilter && (
          <button
            className={styles.resetBtn}
            onClick={() => resetTimelineFilters()}
            aria-label="Reset filters"
            title="Reset all filters"
          >
            <ArrowCounterClockwise size={13} />
          </button>
        )}
      </div>

      <div className={styles.body}>
        {groups.map(({ schema, typeName, members }) => {
          const typeHidden  = hiddenTypes.includes(typeName);
          const isCollapsed = collapsed[typeName] ?? false;

          return (
            <div key={typeName} className={styles.group}>
              {/* Group header row */}
              <div className={styles.groupHeader}>
                <button
                  className={styles.collapseBtn}
                  onClick={() => toggleCollapsed(typeName)}
                  aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                >
                  {isCollapsed ? <CaretRight size={10} /> : <CaretDown size={10} />}
                </button>
                {schema && (
                  <DynamicIcon
                    name={schema.icon}
                    size={13}
                    color={schema.color}
                    weight="duotone"
                  />
                )}
                <span className={styles.groupName}>{pluralize(typeName)}</span>
                <span className={styles.groupCount}>{members.length}</span>
                <button
                  className={`${styles.checkbox} ${!typeHidden ? styles.checkboxChecked : ''}`}
                  onClick={() => toggleTimelineType(typeName)}
                  aria-label={typeHidden ? `Show all ${typeName}` : `Hide all ${typeName}`}
                  title={typeHidden ? 'Show type' : 'Hide type'}
                />
              </div>

              {/* Entity rows */}
              {!isCollapsed && (
                <div className={styles.groupBody}>
                  {members.map(({ entity, hasDate }) => {
                    const entityHidden = hiddenEntities.includes(entity.id);
                    const effectivelyHidden = typeHidden || entityHidden;

                    return (
                      <div
                        key={entity.id}
                        className={`${styles.entityRow} ${typeHidden ? styles.entityRowDisabled : ''}`}
                      >
                        <span
                          className={`${styles.entityTitle} ${!hasDate ? styles.entityNoDate : ''}`}
                        >
                          {entity.title}
                        </span>
                        {!hasDate && (
                          <span className={styles.noDateBadge} title="No date value set">
                            <Warning size={10} weight="fill" />
                          </span>
                        )}
                        <button
                          className={`${styles.checkbox} ${!effectivelyHidden ? styles.checkboxChecked : ''}`}
                          onClick={() => !typeHidden && toggleTimelineEntity(entity.id)}
                          disabled={typeHidden}
                          aria-label={effectivelyHidden ? `Show ${entity.title}` : `Hide ${entity.title}`}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
