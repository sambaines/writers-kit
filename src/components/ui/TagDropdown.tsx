import { useState, useMemo, useRef, useCallback } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Plus, Tag } from '@phosphor-icons/react';
import ActionRow from './ActionRow';
import TertiaryButton from './TertiaryButton';
import SelectWrapper from './SelectWrapper';
import SelectOption, { AnimPhase } from './SelectOption';
import DividerOption from './DividerOption';
import type { Entity } from '../../types';
import styles from './TagDropdown.module.css';

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) return (value as string[]).filter((t) => typeof t === 'string' && !!t);
  if (typeof value === 'string' && value.trim()) return value.split(',').map((t) => t.trim()).filter(Boolean);
  return [];
}

interface AnimState {
  tag: string;
  phase: AnimPhase;
  type: 'add' | 'create';
}

interface TagDropdownProps {
  fieldKey: string;
  currentTags: string[];
  entities: Entity[];
  onSave: (key: string, tags: string[]) => void;
}

export default function TagDropdown({ fieldKey, currentTags, entities, onSave }: TagDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [anim, setAnim] = useState<AnimState | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const vaultTags = useMemo(() => {
    const set = new Set<string>();
    for (const e of entities) parseTags(e.frontmatter[fieldKey]).forEach((t) => set.add(t));
    return [...set].sort();
  }, [entities, fieldKey]);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  const runAnim = useCallback((tag: string, type: 'add' | 'create', onComplete: () => void) => {
    clearTimers();
    setAnim({ tag, phase: 'transitioning', type });
    timers.current.push(setTimeout(() => {
      setAnim({ tag, phase: 'check-white', type });
      timers.current.push(setTimeout(() => {
        onComplete();
        setAnim(null);
      }, 450));
    }, 600));
  }, []);

  function handleAdd(tag: string) {
    runAnim(tag, 'add', () => {
      onSave(fieldKey, [...currentTags, tag]);
    });
  }

  function handleCreate(tag: string) {
    runAnim(tag, 'create', () => {
      onSave(fieldKey, [...currentTags, tag]);
      setQuery('');
    });
  }

  const qRaw = query.trim();
  const q = qRaw.toLowerCase();

  const listContent = useMemo(() => {
    const nodes: React.ReactNode[] = [];

    if (!q) {
      const unselected = vaultTags.filter((t) => !currentTags.includes(t));
      unselected.forEach((tag) => {
        nodes.push(
          <SelectOption
            key={`vault-${tag}`}
            label={tag}
            icon={<Tag size={12} />}
            onClick={() => handleAdd(tag)}
          />,
        );
      });
      if (unselected.length > 0 && currentTags.length > 0) {
        nodes.push(<DividerOption key="div" />);
      }
      // Selected tags last
      currentTags.forEach((tag) => {
        nodes.push(
          <SelectOption key={`sel-${tag}`} label={tag} icon={<Tag size={12} />} selected />,
        );
      });
    } else {
      const matchingSelected = currentTags.filter((t) => t.includes(q));
      const matchingUnselected = vaultTags.filter((t) => !currentTags.includes(t) && t.includes(q));
      const exactExists = vaultTags.includes(q) || currentTags.includes(q);

      matchingSelected.forEach((tag) => {
        nodes.push(
          <SelectOption key={`msel-${tag}`} label={tag} icon={<Tag size={12} />} selected />,
        );
      });

      matchingUnselected.forEach((tag) => {
        const isAnim = anim?.tag === tag;
        const checkColor = isAnim
          ? anim!.phase === 'check-white' ? 'var(--color-paperwhite-50)' : 'var(--color-primary-pink-100)'
          : 'var(--color-primary-pink-100)';
        nodes.push(
          <SelectOption
            key={`mv-${tag}`}
            label={tag}
            icon={<Tag size={12} />}
            showAnimatedTrailing
            animPhase={isAnim ? anim!.phase : undefined}
            animCheckColor={isAnim ? checkColor : undefined}
            onClick={() => !isAnim && handleAdd(tag)}
          />,
        );
      });

      if (!exactExists) {
        const isAnim = anim?.tag === qRaw && anim?.type === 'create';
        const checkColor = isAnim
          ? anim!.phase === 'check-white' ? 'var(--color-paperwhite-50)' : 'var(--color-primary-blue-100)'
          : 'var(--color-primary-blue-100)';
        nodes.push(
          <SelectOption
            key={`create-${q}`}
            label={qRaw}
            icon={<Tag size={12} />}
            preText="Create"
            preTextFaded={isAnim && anim!.phase === 'check-white'}
            showAnimatedTrailing
            animPhase={isAnim ? anim!.phase : undefined}
            animCheckColor={isAnim ? checkColor : undefined}
            onClick={() => !isAnim && handleCreate(qRaw)}
          />,
        );
      }
    }

    return nodes;
  }, [q, currentTags, vaultTags, anim]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <ActionRow>
        <Popover.Trigger asChild>
          <TertiaryButton icon={<Plus size={12} />} label="Add tag" />
        </Popover.Trigger>
      </ActionRow>
      <Popover.Portal>
        <Popover.Content
          className={styles.content}
          side="bottom"
          sideOffset={4}
          align="center"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SelectWrapper
            showSearch
            searchValue={query}
            searchPlaceholder="Type a tag…"
            onSearchChange={setQuery}
          >
            {listContent}
          </SelectWrapper>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
