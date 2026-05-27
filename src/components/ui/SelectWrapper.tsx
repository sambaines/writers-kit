import React, { useState, useMemo } from 'react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import SelectOption from './SelectOption';
import DividerOption from './DividerOption';
import HeaderRowOption from './HeaderRowOption';
import styles from './SelectWrapper.module.css';

export type SelectItem =
  | {
      type: 'option';
      label: string;
      icon?: React.ReactNode;
      trailingIcon?: React.ReactNode;
      selected?: boolean;
      disabled?: boolean;
      iconColor?: string;
      labelColor?: string;
      onClick?: () => void;
    }
  | { type: 'divider' }
  | { type: 'header'; label: string };

interface SelectWrapperProps {
  items: SelectItem[];
  showSearch?: boolean;
  searchPlaceholder?: string;
  searchIcon?: React.ReactNode;
}

export default function SelectWrapper({
  items,
  showSearch,
  searchPlaceholder = 'Search…',
  searchIcon,
}: SelectWrapperProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    // Keep non-option items only if they are adjacent to matching options
    // Simple approach: filter options by query, remove orphaned headers/dividers
    const result: SelectItem[] = [];
    let pendingNonOptions: SelectItem[] = [];

    for (const item of items) {
      if (item.type === 'option') {
        if (item.label.toLowerCase().includes(q)) {
          result.push(...pendingNonOptions, item);
          pendingNonOptions = [];
        }
      } else {
        pendingNonOptions.push(item);
      }
    }
    return result;
  }, [items, query]);

  return (
    <div className={styles.root}>
      {showSearch && (
        <div className={styles.searchRow}>
          {searchIcon && <span className={styles.searchIcon}>{searchIcon}</span>}
          <input
            className={styles.searchInput}
            value={query}
            placeholder={searchPlaceholder}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      )}
      <ScrollArea.Root className={styles.listRoot} type="auto">
        <ScrollArea.Viewport className={styles.listViewport}>
          <div className={styles.list} role="listbox">
            {filtered.map((item, i) => {
              if (item.type === 'divider') {
                return <DividerOption key={`divider-${i}`} />;
              }
              if (item.type === 'header') {
                return <HeaderRowOption key={`header-${i}-${item.label}`} label={item.label} />;
              }
              return (
                <SelectOption
                  key={`option-${i}-${item.label}`}
                  label={item.label}
                  icon={item.icon}
                  trailingIcon={item.trailingIcon}
                  selected={item.selected}
                  disabled={item.disabled}
                  iconColor={item.iconColor}
                  labelColor={item.labelColor}
                  onClick={item.onClick}
                />
              );
            })}
          </div>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar className={styles.scrollbar} orientation="vertical">
          <ScrollArea.Thumb className={styles.scrollThumb} />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  );
}
