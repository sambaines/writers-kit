import { useEffect, useRef, useState, useCallback } from 'react';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { invoke } from '@tauri-apps/api/core';
import { useUIStore } from '../../store/ui.store';
import { useVaultData } from '../../store/vault.store';
import { useShallow } from 'zustand/react/shallow';
import DynamicIcon from '../ui/DynamicIcon';
import styles from './CommandPalette.module.css';

interface SearchResult {
  path: string;
  title: string;
  excerpt: string;
}

export default function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, setActiveEntityId } = useUIStore(
    useShallow((s) => ({
      commandPaletteOpen:    s.commandPaletteOpen,
      setCommandPaletteOpen: s.setCommandPaletteOpen,
      setActiveEntityId:     s.setActiveEntityId,
    })),
  );
  const { entities, schemas, vaultPath } = useVaultData();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setResults([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [commandPaletteOpen]);

  // Search — title filter (instant) merged with FTS results (debounced)
  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    // Instant: title filter from in-memory entities
    const lower = q.toLowerCase();
    const titleMatches: SearchResult[] = entities
      .filter((e) => !e.archived && e.title.toLowerCase().includes(lower))
      .slice(0, 8)
      .map((e) => ({ path: e.path, title: e.title, excerpt: '' }));
    setResults(titleMatches);
    setActiveIndex(0);

    // Also run FTS for content matches
    if (vaultPath) {
      try {
        const fts = await invoke<SearchResult[]>('fts_search', { vaultPath, query: q, limit: 8 });
        // Merge: deduplicate by path, FTS results fill in excerpts
        const merged = new Map<string, SearchResult>();
        for (const r of titleMatches) merged.set(r.path, r);
        for (const r of fts) {
          if (!merged.has(r.path)) merged.set(r.path, r);
          else merged.set(r.path, { ...merged.get(r.path)!, excerpt: r.excerpt });
        }
        setResults(Array.from(merged.values()).slice(0, 10));
      } catch { /* FTS not yet indexed — title results are fine */ }
    }
  }, [entities, vaultPath]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSearch(query), 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, runSearch]);

  function openResult(result: SearchResult) {
    // Find entity by path
    const entity = entities.find((e) => e.path === result.path);
    if (entity) {
      setActiveEntityId(entity.id);
      useUIStore.getState().setActiveView('editor');
    }
    setCommandPaletteOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setCommandPaletteOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[activeIndex]) openResult(results[activeIndex]);
  }

  if (!commandPaletteOpen) return null;

  return (
    <div className={styles.overlay} onClick={() => setCommandPaletteOpen(false)}>
      <div className={styles.palette} onClick={(e) => e.stopPropagation()}>
        {/* Search input */}
        <div className={styles.inputWrap}>
          <MagnifyingGlass size={16} className={styles.searchIcon} />
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Search files…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button className={styles.clearBtn} onClick={() => setQuery('')} aria-label="Clear">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className={styles.results}>
            {results.map((result, i) => {
              const entity = entities.find((e) => e.path === result.path);
              const schema = entity ? schemas.find((s) => s.name === entity.type) : null;
              const icon   = entity?.icon  ?? schema?.icon  ?? 'File';
              const color  = entity?.color ?? schema?.color ?? 'var(--text-tertiary)';
              return (
                <button
                  key={result.path}
                  className={styles.result}
                  data-active={i === activeIndex}
                  onClick={() => openResult(result)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <span className={styles.resultIcon}>
                    <DynamicIcon name={icon} size={14} color={color} weight="duotone" />
                  </span>
                  <span className={styles.resultBody}>
                    <span className={styles.resultTitle}>{result.title}</span>
                    {result.excerpt && (
                      <span className={styles.resultExcerpt}>{result.excerpt}</span>
                    )}
                  </span>
                  {schema && (
                    <span className={styles.resultType} style={{ color: schema.color }}>
                      {schema.name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {query && results.length === 0 && (
          <div className={styles.empty}>No results for "{query}"</div>
        )}

        <div className={styles.footer}>
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
