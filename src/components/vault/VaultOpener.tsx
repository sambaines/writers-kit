import { useState } from 'react';
import { Feather, FolderOpen, ArrowClockwise } from '@phosphor-icons/react';
import { pickFolder } from '../../services/fs.service';
import { useVaultStore } from '../../store/vault.store';
import styles from './VaultOpener.module.css';

export default function VaultOpener() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const openVault = useVaultStore((s) => s.openVault);

  async function handleOpen() {
    setError(null);
    const path = await pickFolder();
    if (!path) return;
    setLoading(true);
    try {
      await openVault(path);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <Feather size={36} weight="duotone" color="var(--accent)" />
        </div>

        <h1 className={styles.title}>Writers Kit</h1>
        <p className={styles.subtitle}>
          Open a folder to use as your writing vault. All your markdown files
          will live there — fully portable, always yours.
        </p>

        <button className={styles.openBtn} onClick={handleOpen} disabled={loading}>
          {loading ? (
            <>
              <ArrowClockwise size={16} className={styles.spinner} />
              <span>Opening vault…</span>
            </>
          ) : (
            <>
              <FolderOpen size={16} weight="duotone" />
              <span>Open Vault Folder</span>
            </>
          )}
        </button>

        {error && <p className={styles.error}>{error}</p>}

        <p className={styles.hint}>
          New vault? Just pick an empty folder — Writers Kit will set it up for you.
        </p>
      </div>
    </div>
  );
}
