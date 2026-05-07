import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
} from 'react';
import { createRoot } from 'react-dom/client';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import type { Entity, SchemaDefinition } from '../types';

export interface WikiLinkItem {
  id: string;
  title: string;
  type: string;
  color: string;
}

interface ListProps {
  items: WikiLinkItem[];
  command: (item: WikiLinkItem) => void;
}

interface ListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

const WikiLinkList = forwardRef<ListRef, ListProps>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => setSelectedIndex(0), [items]);

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) command(item);
    },
    [items, command],
  );

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div style={popupStyles.popup}>
        <div style={popupStyles.empty}>No matches</div>
      </div>
    );
  }

  return (
    <div style={popupStyles.popup}>
      {items.map((item, i) => (
        <button
          key={item.id}
          style={{
            ...popupStyles.item,
            ...(i === selectedIndex ? popupStyles.itemActive : {}),
          }}
          onMouseEnter={() => setSelectedIndex(i)}
          onClick={() => selectItem(i)}
        >
          <span
            style={{
              ...popupStyles.dot,
              background: item.color || 'var(--text-tertiary)',
            }}
          />
          <span style={popupStyles.title}>{item.title}</span>
          <span style={popupStyles.type}>{item.type}</span>
        </button>
      ))}
    </div>
  );
});

WikiLinkList.displayName = 'WikiLinkList';

// ─── Inline styles (popup is outside CSS module scope) ─────

const popupStyles: Record<string, React.CSSProperties> = {
  popup: {
    background: '#1C1C1E',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    minWidth: '220px',
    maxWidth: '320px',
    maxHeight: '280px',
    overflowY: 'auto',
    padding: '4px',
    zIndex: 9999,
  },
  empty: {
    padding: '8px 12px',
    fontSize: '12px',
    color: '#666',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '6px 10px',
    borderRadius: '6px',
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    textAlign: 'left' as const,
    transition: 'background 0.1s',
  },
  itemActive: {
    background: 'rgba(122, 109, 244, 0.15)',
  },
  dot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  title: {
    flex: 1,
    fontSize: '13px',
    color: '#E8E8F0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    fontFamily: 'inherit',
  },
  type: {
    fontSize: '11px',
    color: '#666',
    flexShrink: 0,
    fontFamily: 'inherit',
  },
};

// ─── Suggestion config factory ──────────────────────────────

export function buildWikiLinkSuggestion(
  getEntities: () => Entity[],
  getSchemas: () => SchemaDefinition[],
) {
  return {
    char: '[[',
    allowSpaces: false,

    items({ query }: { query: string }): WikiLinkItem[] {
      const schemas = getSchemas();
      const colorMap = new Map(schemas.map((s) => [s.name, s.color]));
      const q = query.toLowerCase();
      return getEntities()
        .filter((e) => !e.archived && e.title.toLowerCase().includes(q))
        .slice(0, 12)
        .map((e) => ({
          id:    e.id,
          title: e.title,
          type:  e.type,
          color: colorMap.get(e.type) ?? '#8A8A96',
        }));
    },

    render() {
      let container: HTMLDivElement | null = null;
      let root: ReturnType<typeof createRoot> | null = null;
      const listRef = { current: null as ListRef | null };

      function position(
        el: HTMLElement,
        rectFn: (() => DOMRect | null) | null | undefined,
      ) {
        const rect = rectFn?.();
        if (!rect) return;
        el.style.position = 'fixed';
        el.style.left = `${rect.left}px`;
        el.style.top = `${rect.bottom + 6}px`;
        el.style.zIndex = '9999';
      }

      function renderList(props: SuggestionProps) {
        root?.render(
          <WikiLinkList
            ref={(r) => { listRef.current = r; }}
            items={props.items as WikiLinkItem[]}
            command={props.command as (item: WikiLinkItem) => void}
          />,
        );
      }

      return {
        onStart(props: SuggestionProps) {
          container = document.createElement('div');
          document.body.appendChild(container);
          root = createRoot(container);
          renderList(props);
          position(container, props.clientRect);
        },
        onUpdate(props: SuggestionProps) {
          renderList(props);
          if (container) position(container, props.clientRect);
        },
        onExit() {
          root?.unmount();
          container?.remove();
          root = null;
          container = null;
        },
        onKeyDown(props: SuggestionKeyDownProps): boolean {
          if (props.event.key === 'Escape') return true;
          return listRef.current?.onKeyDown(props) ?? false;
        },
      };
    },
  };
}
