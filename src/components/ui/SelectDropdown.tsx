import { useState, useMemo } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { CirclesFour, CaretUpDown, Check, Plus, X } from '@phosphor-icons/react';
import SelectWrapper from './SelectWrapper';
import SelectOption from './SelectOption';
import IconWrapper from './IconWrapper';
import DynamicIcon from './DynamicIcon';
import type { Entity, SchemaDefinition } from '../../types';
import styles from './SelectDropdown.module.css';

interface SelectDropdownProps {
  fieldKey: string;
  value?: string;
  onSave: (key: string, value: string | undefined) => void;
  // Options mode
  options?: string[];
  onCreateOption?: (option: string) => void;
  // Mode
  mode?: 'options' | 'entity';
  entities?: Entity[];
  targetType?: string;
  schemas?: SchemaDefinition[];
}

export default function SelectDropdown({
  fieldKey,
  value,
  onSave,
  options = [],
  onCreateOption,
  mode = 'options',
  entities = [],
  targetType,
  schemas = [],
}: SelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  function close() { setOpen(false); setQuery(''); }

  function handleSelect(val: string | undefined) {
    onSave(fieldKey, val);
    close();
  }

  // Resolve display label for current value
  const triggerLabel = useMemo(() => {
    if (!value) return null;
    if (mode === 'entity') {
      return entities.find((e) => e.id === value)?.title ?? value;
    }
    return value;
  }, [value, mode, entities]);

  // Resolve trigger icon for entity mode
  const triggerIcon = useMemo(() => {
    if (mode === 'entity' && value) {
      const entity = entities.find((e) => e.id === value);
      const schema = entity ? schemas.find((s) => s.name === entity.type) : null;
      const icon = entity?.icon ?? schema?.icon;
      const color = entity?.color ?? schema?.color;
      if (icon) return <DynamicIcon name={icon} size={12} color={color} />;
    }
    return <CirclesFour size={12} />;
  }, [mode, value, entities, schemas]);

  const qRaw = query.trim();
  const q = qRaw.toLowerCase();

  const listContent = useMemo(() => {
    const nodes: React.ReactNode[] = [];

    if (mode === 'entity') {
      const candidates = entities
        .filter((e) => e.type === targetType && !e.archived)
        .filter((e) => !q || e.title.toLowerCase().includes(q))
        .sort((a, b) => a.title.localeCompare(b.title));

      // None option
      nodes.push(
        <SelectOption
          key="__none__"
          label="None"
          selected={!value}
          onClick={() => handleSelect(undefined)}
        />,
      );

      candidates.forEach((e) => {
        const schema = schemas.find((s) => s.name === e.type);
        const icon = e.icon ?? schema?.icon;
        const color = e.color ?? schema?.color;
        nodes.push(
          <SelectOption
            key={e.id}
            label={e.title}
            icon={icon ? <DynamicIcon name={icon} size={12} /> : undefined}
            iconColor={color}
            selected={value === e.id}
            onClick={() => handleSelect(e.id)}
          />,
        );
      });
    } else {
      // Options mode
      const filtered = options.filter((o) => !q || o.toLowerCase().includes(q));
      const exactExists = options.some((o) => o.toLowerCase() === q);

      filtered.forEach((opt) => {
        nodes.push(
          <SelectOption
            key={opt}
            label={opt}
            icon={<CirclesFour size={12} />}
            selected={value === opt}
            onClick={() => handleSelect(opt)}
          />,
        );
      });

      if (qRaw && !exactExists && onCreateOption) {
        nodes.push(
          <SelectOption
            key={`create-${q}`}
            label={qRaw}
            icon={<CirclesFour size={12} />}
            preText="Create"
            onClick={() => {
              onCreateOption(qRaw);
              handleSelect(qRaw);
            }}
          />,
        );
      }
    }

    return nodes;
  }, [mode, q, qRaw, options, value, entities, targetType, schemas, onCreateOption]);

  return (
    <Popover.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(''); }}>
      <Popover.Trigger asChild>
        <button className={styles.trigger} type="button">
          <div className={styles.innerRing} />
          <div className={styles.content}>
            <span className={styles.icon}>{triggerIcon}</span>
            <span className={styles.label}>
              {triggerLabel ?? <span className={styles.placeholder}>None</span>}
            </span>
            <CaretUpDown size={12} className={styles.caret} />
          </div>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={styles.popover}
          side="bottom"
          sideOffset={4}
          align="end"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SelectWrapper
            showSearch
            searchValue={query}
            searchPlaceholder={mode === 'entity' ? 'Search entities…' : 'Search options…'}
            onSearchChange={setQuery}
          >
            {listContent}
          </SelectWrapper>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
