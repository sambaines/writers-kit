import * as ScrollArea from '@radix-ui/react-scroll-area';
import {
  X, User, Hash, Calendar, ToggleLeft, Tag, TextT,
  ArrowUpRight, TreeStructure, ArrowsOut,
  FileText, Clock, PencilLine, Eye,
} from '@phosphor-icons/react';
import { useUIStore } from '../../store/ui.store';
import { useShallow } from 'zustand/react/shallow';
import styles from './PropertiesPanel.module.css';

const MOCK_FIELDS = [
  { key: 'species',     label: 'Species',     value: 'Human (Dúnedain)', type: 'text'    },
  { key: 'born',        label: 'Born',         value: '2931 TA',         type: 'date'    },
  { key: 'died',        label: 'Died',         value: '120 FO',          type: 'date'    },
  { key: 'alive',       label: 'Alive',        value: 'false',           type: 'boolean' },
  { key: 'affiliation', label: 'Affiliation',  value: 'Fellowship',      type: 'text'    },
  { key: 'tags',        label: 'Tags',         value: 'ranger, king, protagonist', type: 'tags' },
];

const MOCK_RELATIONS = [
  { kind: 'Child of',    title: 'Middle-Earth', type: 'World'     },
  { kind: 'Related to',  title: 'Gandalf',      type: 'Character' },
  { kind: 'Related to',  title: 'Arwen',        type: 'Character' },
];

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
    }))
  );

  const hasEntity = !!activeEntityId;

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerMeta}>
          {hasEntity ? (
            <>
              {/* Icon swatch — placeholder for Phase 4 icon picker */}
              <button className={styles.iconSwatch} aria-label="Change icon">
                <User size={16} weight="duotone" color="var(--accent-text)" />
              </button>
              {/* Color swatch — placeholder for Phase 4 color picker */}
              <button
                className={styles.colorSwatch}
                style={{ background: '#7A6DF4' }}
                aria-label="Change color"
              />
              <span className={styles.headerTitle}>Aragorn</span>
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

      {hasEntity && (
        <div className={styles.typeBadge}>
          <User size={11} />
          <span>Character</span>
        </div>
      )}

      <ScrollArea.Root className={styles.scrollRoot}>
        <ScrollArea.Viewport className={styles.scrollViewport}>
          {hasEntity ? (
            <>
              {/* Fields */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>Properties</div>
                <div className={styles.fields}>
                  {MOCK_FIELDS.map((field) => (
                    <div key={field.key} className={styles.field}>
                      <div className={styles.fieldLabel}>
                        <FieldIcon type={field.type} />
                        <span>{field.label}</span>
                      </div>
                      <div className={styles.fieldValue}>
                        {field.type === 'boolean' ? (
                          <span className={field.value === 'true' ? styles.boolTrue : styles.boolFalse}>
                            {field.value}
                          </span>
                        ) : field.type === 'tags' ? (
                          <div className={styles.tags}>
                            {field.value.split(', ').map((tag) => (
                              <span key={tag} className={styles.tag}>{tag}</span>
                            ))}
                          </div>
                        ) : (
                          <span>{field.value}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className={styles.divider} />

              {/* Relations */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>Relations</div>
                <div className={styles.relations}>
                  {MOCK_RELATIONS.map((rel, i) => (
                    <div key={i} className={styles.relation}>
                      <span className={styles.relKind}>{rel.kind}</span>
                      <button className={styles.relLink}>
                        <ArrowUpRight size={11} />
                        <span>{rel.title}</span>
                        <span className={styles.relType}>{rel.type}</span>
                      </button>
                    </div>
                  ))}
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
                    <span className={styles.statValue}>1,234</span>
                  </div>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}><Hash size={12} /> Characters</span>
                    <span className={styles.statValue}>6,789</span>
                  </div>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}><ArrowsOut size={12} /> File size</span>
                    <span className={styles.statValue}>12.3 KB</span>
                  </div>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}><Eye size={12} /> Read time</span>
                    <span className={styles.statValue}>~5 min</span>
                  </div>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}><PencilLine size={12} /> Created</span>
                    <span className={styles.statValue}>3 Jan 2025</span>
                  </div>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}><Clock size={12} /> Modified</span>
                    <span className={styles.statValue}>2 hours ago</span>
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
