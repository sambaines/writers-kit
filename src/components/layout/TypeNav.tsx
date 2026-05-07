import * as ScrollArea from '@radix-ui/react-scroll-area';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  Feather,
  Files,
  Archive,
  Plus,
  Gear,
  Globe,
  User,
  BookOpen,
  Scroll,
  Timer,
  MapPin,
} from '@phosphor-icons/react';
import { useUIStore } from '../../store/ui.store';
import { useShallow } from 'zustand/react/shallow';
import clsx from 'clsx';
import styles from './TypeNav.module.css';

const MOCK_TYPES = [
  { id: 'world',     name: 'World',     Icon: Globe,    color: '#4A9EFF', count: 2  },
  { id: 'character', name: 'Character', Icon: User,     color: '#7A6DF4', count: 18 },
  { id: 'chapter',   name: 'Chapter',   Icon: BookOpen, color: '#4ED898', count: 12 },
  { id: 'lore',      name: 'Lore',      Icon: Scroll,   color: '#F0A429', count: 7  },
  { id: 'era',       name: 'Era',       Icon: Timer,    color: '#FF5370', count: 3  },
  { id: 'location',  name: 'Location',  Icon: MapPin,   color: '#FF9057', count: 5  },
];

export default function TypeNav() {
  const { activeTypeId, setActiveTypeId, setActiveEntityId } = useUIStore(
    useShallow((s) => ({
      activeTypeId: s.activeTypeId,
      setActiveTypeId: s.setActiveTypeId,
      setActiveEntityId: s.setActiveEntityId,
    }))
  );

  function handleNavClick(id: string | null) {
    setActiveTypeId(id);
    setActiveEntityId(null);
  }

  return (
    <Tooltip.Provider delayDuration={600}>
      <nav className={styles.nav}>
        {/* Logo */}
        <div className={styles.logo}>
          <Feather size={18} weight="duotone" color="var(--accent)" />
          <span className={styles.logoText}>Writers Kit</span>
        </div>

        <ScrollArea.Root className={styles.scrollRoot}>
          <ScrollArea.Viewport className={styles.scrollViewport}>
            {/* All Notes / Archive */}
            <div className={styles.section}>
              <button
                className={clsx(styles.navItem, activeTypeId === '__all' && styles.active)}
                onClick={() => handleNavClick('__all')}
              >
                <Files size={15} weight={activeTypeId === '__all' ? 'fill' : 'regular'} />
                <span>All Files</span>
                <span className={styles.count}>47</span>
              </button>
              <button
                className={clsx(styles.navItem, activeTypeId === '__archive' && styles.active)}
                onClick={() => handleNavClick('__archive')}
              >
                <Archive size={15} weight={activeTypeId === '__archive' ? 'fill' : 'regular'} />
                <span>Archive</span>
                <span className={styles.count}>3</span>
              </button>
            </div>

            <div className={styles.divider} />

            {/* Entity Types */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>Types</div>
              {MOCK_TYPES.map(({ id, name, Icon, color, count }) => (
                <button
                  key={id}
                  className={clsx(styles.navItem, activeTypeId === id && styles.active)}
                  onClick={() => handleNavClick(id)}
                >
                  <span className={styles.typeDot} style={{ background: color }} />
                  <Icon size={14} weight={activeTypeId === id ? 'fill' : 'regular'} color={activeTypeId === id ? color : undefined} />
                  <span>{name}</span>
                  <span className={styles.count}>{count}</span>
                </button>
              ))}
            </div>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar className={styles.scrollbar} orientation="vertical">
            <ScrollArea.Thumb className={styles.scrollThumb} />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>

        {/* Bottom actions */}
        <div className={styles.bottom}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button className={styles.navItem} onClick={() => {}}>
                <Plus size={14} />
                <span>New Type</span>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className={styles.tooltip} side="right" sideOffset={8}>
                Create a new entity type
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button className={clsx(styles.navItem, styles.settingsBtn)}>
                <Gear size={14} />
                <span>Settings</span>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className={styles.tooltip} side="right" sideOffset={8}>
                Open settings
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>
      </nav>
    </Tooltip.Provider>
  );
}
