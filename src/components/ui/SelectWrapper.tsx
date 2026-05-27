import { useMemo } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
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
}

export default function SelectWrapper({
  items,
  children,
  showSearch,
  searchValue = '',
  searchPlaceholder = 'Search…',
  onSearchChange,
}: SelectWrapperProps) {
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
    <div className={styles.root}>
      {showSearch && (
        <div className={styles.searchContainer}>
          <Input
            leadingIcon={<MagnifyingGlass size={12} />}
            value={searchValue}
            placeholder={searchPlaceholder}
            onChange={(e) => onSearchChange?.(e.target.value)}
            autoFocus
          />
        </div>
      )}
      <ScrollArea.Root className={styles.listRoot} type="auto">
        <ScrollArea.Viewport className={styles.listViewport}>
          <div className={styles.list} role="listbox">
            {children ?? filteredItems.map((item, i) => {
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
