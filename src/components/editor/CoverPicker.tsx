import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import { X, MagnifyingGlass, Image, Warning } from '@phosphor-icons/react';
import { useSettingsStore } from '../../store/settings.store';
import { useVaultData } from '../../store/vault.store';
import {
  pickAndSaveLocalCover,
  unsplashSearch,
  triggerUnsplashDownload,
  type CoverData,
  type UnsplashPhoto,
} from '../../services/cover.service';
import styles from './CoverPicker.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (cover: CoverData) => void;
}

function UploadTab({ onSelect }: { onSelect: (cover: CoverData) => void }) {
  const { vaultPath } = useVaultData();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePick() {
    if (!vaultPath) return;
    setLoading(true);
    setError(null);
    try {
      const cover = await pickAndSaveLocalCover(vaultPath);
      if (cover) onSelect(cover);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.uploadTab}>
      <button className={styles.uploadBtn} onClick={() => void handlePick()} disabled={loading}>
        <Image size={24} weight="thin" />
        <span>{loading ? 'Copying…' : 'Choose image from device'}</span>
        <span className={styles.uploadHint}>JPG, PNG, GIF, WebP, AVIF</span>
      </button>
      {error && <p className={styles.errorMsg}>{error}</p>}
    </div>
  );
}

function UnsplashTab({ onSelect }: { onSelect: (cover: CoverData) => void }) {
  const { unsplashKey } = useSettingsStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UnsplashPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    if (!query.trim() || !unsplashKey) return;
    setLoading(true);
    setError(null);
    try {
      const photos = await unsplashSearch(query.trim(), unsplashKey);
      setResults(photos);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(photo: UnsplashPhoto) {
    if (unsplashKey) {
      void triggerUnsplashDownload(photo.links.download_location, unsplashKey);
    }
    onSelect({
      type: 'unsplash',
      src: photo.urls.regular,
      attribution: {
        name: photo.user.name,
        username: photo.user.username,
        url: `https://unsplash.com/@${photo.user.username}`,
      },
    });
  }

  if (!unsplashKey) {
    return (
      <div className={styles.noKey}>
        <Warning size={28} weight="thin" color="var(--text-tertiary)" />
        <p className={styles.noKeyTitle}>No Unsplash API key</p>
        <p className={styles.noKeyHint}>Add your Unsplash Access Key in Settings → Unsplash.</p>
      </div>
    );
  }

  return (
    <div className={styles.unsplashTab}>
      <div className={styles.searchRow}>
        <input
          className={styles.searchInput}
          placeholder="Search Unsplash…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch(); }}
          autoFocus
        />
        <button className={styles.searchBtn} onClick={() => void handleSearch()} disabled={loading || !query.trim()}>
          <MagnifyingGlass size={14} />
        </button>
      </div>
      {error && <p className={styles.errorMsg}>{error}</p>}
      {loading && <p className={styles.loadingMsg}>Searching…</p>}
      {results.length > 0 && (
        <div className={styles.grid}>
          {results.map((photo) => (
            <button
              key={photo.id}
              className={styles.gridItem}
              onClick={() => void handleSelect(photo)}
              title={photo.alt_description ?? photo.user.name}
            >
              <img src={photo.urls.thumb} alt={photo.alt_description ?? ''} className={styles.gridImg} />
            </button>
          ))}
        </div>
      )}
      {results.length === 0 && !loading && query && (
        <p className={styles.emptyMsg}>No results. Try a different search.</p>
      )}
    </div>
  );
}

export default function CoverPicker({ open, onClose, onSelect }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <div className={styles.header}>
            <Dialog.Title className={styles.title}>Cover image</Dialog.Title>
            <Dialog.Close asChild>
              <button className={styles.closeBtn} aria-label="Close">
                <X size={15} />
              </button>
            </Dialog.Close>
          </div>

          <Tabs.Root defaultValue="upload" className={styles.tabs}>
            <Tabs.List className={styles.tabList}>
              <Tabs.Trigger className={styles.tabTrigger} value="upload">Upload</Tabs.Trigger>
              <Tabs.Trigger className={styles.tabTrigger} value="unsplash">Unsplash</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="upload" className={styles.tabContent}>
              <UploadTab onSelect={onSelect} />
            </Tabs.Content>
            <Tabs.Content value="unsplash" className={styles.tabContent}>
              <UnsplashTab onSelect={onSelect} />
            </Tabs.Content>
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
