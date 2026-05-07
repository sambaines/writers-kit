import { useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import DynamicIcon from '../ui/DynamicIcon';
import styles from './IconPicker.module.css';

// Curated icons relevant to writing and worldbuilding
export const ICON_LIST = [
  // Writing
  'Note', 'NotePencil', 'Notebook', 'Book', 'Books', 'BookOpen', 'BookBookmark',
  'Scroll', 'Feather', 'PencilLine', 'Article', 'FileText', 'Files', 'Archive',
  // People
  'User', 'Users', 'UserCircle', 'Crown', 'Skull', 'Robot', 'Alien', 'Ghost',
  'PersonSimple', 'Baby', 'Student', 'Sword', 'Shield', 'Detective',
  // Places
  'MapPin', 'Map', 'Globe', 'Compass', 'Buildings', 'Building', 'House',
  'Tree', 'Mountains', 'Drop', 'Island', 'Castle', 'Door', 'Flag',
  'Vault', 'Tent', 'Lighthouse', 'Bridge',
  // Time
  'Calendar', 'CalendarBlank', 'Clock', 'Timer', 'Hourglass', 'Lightning',
  'Fire', 'Snowflake', 'Sun', 'Moon', 'Star', 'Planet',
  // Objects
  'Key', 'Lock', 'Gem', 'Ring', 'Bag', 'Backpack', 'Package',
  'Chest', 'Potion', 'MagicWand', 'Sparkle', 'Flask', 'Atom',
  // Narrative
  'TreeStructure', 'GitBranch', 'Graph', 'ChartLine', 'Tag', 'Bookmark',
  'Link', 'Quotes', 'ChatCenteredText', 'Megaphone', 'Eye', 'Brain',
  'Binoculars', 'Camera', 'Music', 'Palette',
  // System
  'Folder', 'FolderOpen', 'Hash', 'List', 'Rows', 'SquaresFour',
  'Info', 'Warning', 'Question', 'CheckCircle',
];

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  color?: string;
}

export default function IconPicker({ value, onChange, color = 'var(--accent)' }: IconPickerProps) {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? ICON_LIST.filter((n) => n.toLowerCase().includes(search.toLowerCase()))
    : ICON_LIST;

  return (
    <div className={styles.picker}>
      <div className={styles.searchRow}>
        <MagnifyingGlass size={12} className={styles.searchIcon} />
        <input
          className={styles.searchInput}
          placeholder="Search icons…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className={styles.grid}>
        {filtered.map((name) => (
          <button
            key={name}
            type="button"
            className={`${styles.iconBtn} ${value === name ? styles.active : ''}`}
            onClick={() => onChange(name)}
            title={name}
          >
            <DynamicIcon
              name={name}
              size={16}
              weight={value === name ? 'fill' : 'regular'}
              color={value === name ? color : undefined}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
