import { useMemo, useRef, useState, useEffect, useId } from 'react';
import { MagnifyingGlass, CirclesFour } from '@phosphor-icons/react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import Input from './Input';
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
  // Pass items for simple use cases (SelectWrapper handles filtering internally)
  items?: SelectItem[];
  // Pass children for complex use cases (e.g. animated options — caller pre-builds list)
  children?: React.ReactNode;
  // Controlled search
  showSearch?: boolean;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  emptyMessage?: string;
}

export default function SelectWrapper({
  items,
  children,
  showSearch,
  searchValue = '',
  searchPlaceholder = 'Search…',
  onSearchChange,
  emptyMessage,
}: SelectWrapperProps) {
  const listboxId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  // After every render: assign IDs and sync data-keyboard-active on options
  useEffect(() => {
    const options = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])') ?? []
    );
    options.forEach((el, i) => {
      el.id = `${listboxId}-${i}`;
      el.toggleAttribute('data-keyboard-active', i === activeIndex);
    });
    if (activeIndex >= 0) {
      options[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  });

  function handleKeyDown(e: React.KeyboardEvent) {
    const options = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])') ?? []
    );
    if (!options.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i < options.length - 1 ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i > 0 ? i - 1 : options.length - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      options[activeIndex]?.click();
    }
  }

  function handleSearchChange(value: string) {
    setActiveIndex(-1);
    onSearchChange?.(value);
  }

  // When using items prop, filter internally by searchValue
  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (!searchValue.trim()) return items;
    const q = searchValue.toLowerCase();
    const result: SelectItem[] = [];
    let pending: SelectItem[] = [];
    for (const item of items) {
      if (item.type === 'option') {
        if (item.label.toLowerCase().includes(q)) {
          result.push(...pending, item);
          pending = [];
        }
      } else {
        pending.push(item);
      }
    }
    return result;
  }, [items, searchValue]);

  return (
    <div className={styles.root} onKeyDown={handleKeyDown}>
      {showSearch && (
        <div className={styles.searchContainer}>
          <Input
            leadingIcon={<MagnifyingGlass size={12} />}
            value={searchValue}
            placeholder={searchPlaceholder}
            onChange={(e) => handleSearchChange(e.target.value)}
            autoFocus
          />
        </div>
      )}
      <ScrollArea.Root className={styles.listRoot} type="auto">
        <ScrollArea.Viewport className={styles.listViewport}>
          <div
            ref={listRef}
            className={styles.list}
            role="listbox"
            aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
          >
            {children ?? (
              filteredItems.length === 0 && searchValue.trim()
                ? (
                  <div className={styles.emptyState}>
                    <CirclesFour size={12} className={styles.emptyStateIcon} />
                    <span>{emptyMessage ?? 'No results match that search query'}</span>
                  </div>
                )
                : filteredItems.map((item, i) => {
                    if (item.type === 'divider') return <DividerOption key={`d-${i}`} />;
                    if (item.type === 'header') return <HeaderRowOption key={`h-${i}`} label={item.label} />;
                    return (
                      <SelectOption
                        key={`${item.label}-${i}`}
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
                  })
            )}
          </div>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar className={styles.scrollbar} orientation="vertical">
          <ScrollArea.Thumb className={styles.scrollThumb} />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  );
}
