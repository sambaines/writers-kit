import * as ScrollArea from '@radix-ui/react-scroll-area';
import { MagnifyingGlass, Plus, User } from '@phosphor-icons/react';
import { useUIStore } from '../../store/ui.store';
import { useShallow } from 'zustand/react/shallow';
import clsx from 'clsx';
import styles from './EntityList.module.css';

const MOCK_ENTITIES: Record<string, { id: string; title: string; modified: string }[]> = {
  world: [
    { id: 'w1', title: 'Middle-Earth', modified: '2 days ago' },
    { id: 'w2', title: 'Valinor', modified: '1 week ago' },
  ],
  character: [
    { id: 'c1',  title: 'Aragorn',         modified: '2 hours ago' },
    { id: 'c2',  title: 'Gandalf the Grey', modified: 'Yesterday'   },
    { id: 'c3',  title: 'Frodo Baggins',    modified: '3 days ago'  },
    { id: 'c4',  title: 'Samwise Gamgee',   modified: '3 days ago'  },
    { id: 'c5',  title: 'Legolas',          modified: 'Last week'   },
    { id: 'c6',  title: 'Gimli',            modified: 'Last week'   },
    { id: 'c7',  title: 'Boromir',          modified: '2 weeks ago' },
    { id: 'c8',  title: 'Saruman',          modified: '1 month ago' },
    { id: 'c9',  title: 'Arwen Undómiel',   modified: '1 month ago' },
    { id: 'c10', title: 'Éowyn',            modified: '1 month ago' },
  ],
  chapter: [
    { id: 'ch1', title: 'A Long-expected Party',     modified: '3 days ago'  },
    { id: 'ch2', title: 'The Shadow of the Past',    modified: '3 days ago'  },
    { id: 'ch3', title: 'Three is Company',          modified: '4 days ago'  },
    { id: 'ch4', title: 'A Short Cut to Mushrooms',  modified: '4 days ago'  },
    { id: 'ch5', title: 'A Conspiracy Unmasked',     modified: '5 days ago'  },
  ],
  lore: [
    { id: 'l1', title: 'The One Ring',       modified: 'Last week' },
    { id: 'l2', title: 'Elvish Languages',   modified: 'Last week' },
    { id: 'l3', title: 'The Valar',          modified: '2 weeks ago' },
    { id: 'l4', title: 'Dwarven Kingdoms',   modified: '2 weeks ago' },
    { id: 'l5', title: 'Palantíri',          modified: '3 weeks ago' },
  ],
  era: [
    { id: 'e1', title: 'First Age',  modified: '2 weeks ago' },
    { id: 'e2', title: 'Second Age', modified: '2 weeks ago' },
    { id: 'e3', title: 'Third Age',  modified: '2 weeks ago' },
  ],
  location: [
    { id: 'loc1', title: 'The Shire',     modified: 'Last week' },
    { id: 'loc2', title: 'Rivendell',     modified: 'Last week' },
    { id: 'loc3', title: 'Moria',         modified: '2 weeks ago' },
    { id: 'loc4', title: 'Lothlórien',    modified: '2 weeks ago' },
    { id: 'loc5', title: 'Gondor',        modified: '3 weeks ago' },
  ],
};

const TYPE_LABELS: Record<string, string> = {
  __all:      'All Files',
  __archive:  'Archive',
  world:      'World',
  character:  'Character',
  chapter:    'Chapter',
  lore:       'Lore',
  era:        'Era',
  location:   'Location',
};

export default function EntityList() {
  const { activeTypeId, activeEntityId, setActiveEntityId } = useUIStore(
    useShallow((s) => ({
      activeTypeId:      s.activeTypeId,
      activeEntityId:    s.activeEntityId,
      setActiveEntityId: s.setActiveEntityId,
    }))
  );

  if (!activeTypeId) {
    return (
      <div className={styles.list}>
        <div className={styles.empty}>
          <span className={styles.emptyText}>Select a type</span>
        </div>
      </div>
    );
  }

  const label = TYPE_LABELS[activeTypeId] ?? activeTypeId;
  const entities = MOCK_ENTITIES[activeTypeId] ?? [];

  return (
    <div className={styles.list}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.headerLabel}>{label}</span>
        <span className={styles.headerCount}>{entities.length}</span>
      </div>

      {/* Search */}
      <div className={styles.searchRow}>
        <MagnifyingGlass size={13} className={styles.searchIcon} />
        <input
          className={styles.searchInput}
          placeholder={`Search ${label.toLowerCase()}…`}
          type="text"
        />
      </div>

      {/* Entity list */}
      <ScrollArea.Root className={styles.scrollRoot}>
        <ScrollArea.Viewport className={styles.scrollViewport}>
          {entities.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyText}>No files yet</span>
            </div>
          ) : (
            <div className={styles.entityItems}>
              {entities.map((entity) => (
                <button
                  key={entity.id}
                  className={clsx(
                    styles.entityItem,
                    activeEntityId === entity.id && styles.active,
                  )}
                  onClick={() => setActiveEntityId(entity.id)}
                >
                  <span className={styles.entityIcon}>
                    <User size={13} weight="regular" />
                  </span>
                  <span className={styles.entityTitle}>{entity.title}</span>
                  <span className={styles.entityMeta}>{entity.modified}</span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar className={styles.scrollbar} orientation="vertical">
          <ScrollArea.Thumb className={styles.scrollThumb} />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>

      {/* New entity button */}
      <div className={styles.footer}>
        <button className={styles.newBtn}>
          <Plus size={13} />
          <span>New {label === 'All Files' ? 'File' : label}</span>
        </button>
      </div>
    </div>
  );
}
