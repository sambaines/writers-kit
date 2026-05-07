import * as ScrollArea from '@radix-ui/react-scroll-area';
import {
  X, Hash, Calendar, ToggleLeft, Tag, TextT,
  ArrowUpRight, TreeStructure, ArrowsOut,
  FileText, Clock, PencilLine, Eye,
} from '@phosphor-icons/react';
import { useUIStore } from '../../store/ui.store';
import { useVaultData } from '../../store/vault.store';
import { useShallow } from 'zustand/react/shallow';
import DynamicIcon from '../ui/DynamicIcon';
import styles from './PropertiesPanel.module.css';

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function relativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1)   return 'just now';
    if (mins < 60)  return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return iso;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FieldIcon({ type }: { type: string }) {
  const size = 12;
  switch (type) {
    case 'date':    return <Calendar size={size} />;
    case 'boolean': return <ToggleLeft size={size} />;
    case 'tags':    return <Tag size={size} />;
    case 'number':  return <Hash size={size} />;
    default:        return <TextT size={size} />;
  }
}

export default function PropertiesPanel() {
  const { activeEntityId, setPropertiesPanelOpen } = useUIStore(
    useShallow((s) => ({
      activeEntityId:         s.activeEntityId,
      setPropertiesPanelOpen: s.setPropertiesPanelOpen,
    })),
  );
  const { entities, schemas } = useVaultData();

  const entity = entities.find((e) => e.id === activeEntityId) ?? null;
  const schema = entity ? schemas.find((s) => s.name === entity.type) : null;

  // User-defined field values from frontmatter (excluding system __ fields and _ relation fields)
  const userFields = schema?.fields.map((field) => ({
    ...field,
    value: entity?.frontmatter[field.key],
  })) ?? [];

  // Relation fields from frontmatter
  const relations = entity
    ? [
        ...((entity.frontmatter._parentOf  as string[] | undefined) ?? []).map((t) => ({ kind: 'Parent of',  target: t })),
        ...((entity.frontmatter._childOf   as string[] | undefined) ?? []).map((t) => ({ kind: 'Child of',   target: t })),
        ...((entity.frontmatter._siblingOf as string[] | undefined) ?? []).map((t) => ({ kind: 'Sibling of', target: t })),
        ...((entity.frontmatter._relatedTo as string[] | undefined) ?? []).map((t) => ({ kind: 'Related to', target: t })),
      ]
    : [];

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerMeta}>
          {entity ? (
            <>
              <button
                className={styles.iconSwatch}
                aria-label="Change icon"
                style={{ background: schema ? `${schema.color}20` : undefined }}
              >
                <DynamicIcon
                  name={entity.icon ?? schema?.icon ?? 'File'}
                  size={15}
                  weight="duotone"
                  color={entity.color ?? schema?.color ?? 'var(--accent-text)'}
                />
              </button>
              <button
                className={styles.colorSwatch}
                style={{ background: entity.color ?? schema?.color ?? 'var(--accent)' }}
                aria-label="Change color"
              />
              <span className={styles.headerTitle}>{entity.title}</span>
            </>
          ) : (
            <span className={styles.headerEmpty}>Properties</span>
          )}
        </div>
        <button
          className={styles.closeBtn}
          onClick={() => setPropertiesPanelOpen(false)}
          aria-label="Close properties"
        >
          <X size={14} />
        </button>
      </div>

      {entity && schema && (
        <div className={styles.typeBadge}>
          <DynamicIcon name={schema.icon} size={11} color={schema.color} />
          <span style={{ color: schema.color }}>{entity.type}</span>
        </div>
      )}

      <ScrollArea.Root className={styles.scrollRoot}>
        <ScrollArea.Viewport className={styles.scrollViewport}>
          {entity ? (
            <>
              {/* Schema-defined fields */}
              {userFields.length > 0 && (
                <section className={styles.section}>
                  <div className={styles.sectionHeader}>Properties</div>
                  <div className={styles.fields}>
                    {userFields.map((field) => {
                      const rawVal = field.value;
                      const isEmpty = rawVal === undefined || rawVal === null || rawVal === '';
                      return (
                        <div key={field.key} className={styles.field}>
                          <div className={styles.fieldLabel}>
                            <FieldIcon type={field.type} />
                            <span>{field.label}</span>
                          </div>
                          <div className={styles.fieldValue}>
                            {isEmpty ? (
                              <span className={styles.fieldEmpty}>—</span>
                            ) : field.type === 'boolean' ? (
                              <span className={rawVal ? styles.boolTrue : styles.boolFalse}>
                                {String(rawVal)}
                              </span>
                            ) : field.type === 'tags' ? (
                              <div className={styles.tags}>
                                {String(rawVal).split(/,\s*/).map((tag) => (
                                  <span key={tag} className={styles.tag}>{tag}</span>
                                ))}
                              </div>
                            ) : (
                              <span>{String(rawVal)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Relations */}
              <div className={styles.divider} />
              <section className={styles.section}>
                <div className={styles.sectionHeader}>Relations</div>
                <div className={styles.relations}>
                  {relations.length === 0 ? (
                    <span className={styles.emptyHint}>No relations</span>
                  ) : (
                    relations.map((rel, i) => {
                      const target = entities.find((e) => e.id === rel.target);
                      return (
                        <div key={i} className={styles.relation}>
                          <span className={styles.relKind}>{rel.kind}</span>
                          <button className={styles.relLink}>
                            <ArrowUpRight size={11} />
                            <span>{target?.title ?? rel.target}</span>
                            {target && (
                              <span className={styles.relType}>{target.type}</span>
                            )}
                          </button>
                        </div>
                      );
                    })
                  )}
                  <button className={styles.addRelation}>
                    <TreeStructure size={12} />
                    <span>Add relation</span>
                  </button>
                </div>
              </section>

              <div className={styles.divider} />

              {/* Stats */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>Stats</div>
                <div className={styles.stats}>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}><TextT size={12} /> Words</span>
                    <span className={styles.statValue}>{entity.wordCount.toLocaleString()}</span>
                  </div>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}><Hash size={12} /> Characters</span>
                    <span className={styles.statValue}>{entity.charCount.toLocaleString()}</span>
                  </div>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}><ArrowsOut size={12} /> File size</span>
                    <span className={styles.statValue}>{formatFileSize(entity.fileSize)}</span>
                  </div>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}><Eye size={12} /> Read time</span>
                    <span className={styles.statValue}>
                      ~{Math.max(1, Math.round(entity.wordCount / 200))} min
                    </span>
                  </div>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}><PencilLine size={12} /> Created</span>
                    <span className={styles.statValue}>{formatDate(entity.createdAt)}</span>
                  </div>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}><Clock size={12} /> Modified</span>
                    <span className={styles.statValue}>{relativeTime(entity.modifiedAt)}</span>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <div className={styles.emptyState}>
              <FileText size={32} weight="thin" color="var(--text-tertiary)" />
              <p>Select a file to view its properties</p>
            </div>
          )}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar className={styles.scrollbar} orientation="vertical">
          <ScrollArea.Thumb className={styles.scrollThumb} />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  );
}
