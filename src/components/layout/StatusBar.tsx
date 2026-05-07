import { GitBranch, CheckCircle, FloppyDisk, Warning, Circle } from '@phosphor-icons/react';
import { useUIStore } from '../../store/ui.store';
import { useVaultData } from '../../store/vault.store';
import { useShallow } from 'zustand/react/shallow';
import styles from './StatusBar.module.css';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readTime(words: number): string {
  const mins = Math.max(1, Math.round(words / 200));
  return `~${mins} min read`;
}

export default function StatusBar() {
  const { activeEntityId, saveStatus } = useUIStore(
    useShallow((s) => ({
      activeEntityId: s.activeEntityId,
      saveStatus:     s.saveStatus,
    })),
  );
  const { entities, schemas } = useVaultData();

  const entity = entities.find((e) => e.id === activeEntityId) ?? null;
  const schema = entity ? schemas.find((s) => s.name === entity.type) : null;

  return (
    <footer className={styles.bar}>
      {/* Left — breadcrumb */}
      <div className={styles.left}>
        {entity ? (
          <>
            <span className={styles.breadcrumb}>{entity.title}</span>
            <span className={styles.sep}>·</span>
            <span className={styles.type} style={{ color: schema?.color }}>
              {entity.type}
            </span>
          </>
        ) : (
          <span className={styles.muted}>No file open</span>
        )}
      </div>

      {/* Centre — document stats */}
      <div className={styles.centre}>
        {entity && (
          <>
            <span className={styles.stat}>
              <span className={styles.statLabel}>Words</span>
              <span className={styles.statValue}>
                {entity.wordCount.toLocaleString()}
              </span>
            </span>
            <span className={styles.statDivider} />
            <span className={styles.stat}>
              <span className={styles.statLabel}>Chars</span>
              <span className={styles.statValue}>
                {entity.charCount.toLocaleString()}
              </span>
            </span>
            <span className={styles.statDivider} />
            <span className={styles.stat}>
              <span className={styles.statValue}>{readTime(entity.wordCount)}</span>
            </span>
          </>
        )}
      </div>

      {/* Right — save status + git */}
      <div className={styles.right}>
        {/* Save status */}
        {entity && saveStatus !== 'idle' && (
          <>
            <span className={styles.saveStatus} data-status={saveStatus}>
              {saveStatus === 'saving' && (
                <><Circle size={8} weight="fill" className={styles.saveDot} />Saving…</>
              )}
              {saveStatus === 'saved' && (
                <><FloppyDisk size={11} />Saved</>
              )}
              {saveStatus === 'unsaved' && (
                <><Circle size={8} weight="fill" className={styles.saveDotUnsaved} />Unsaved</>
              )}
              {saveStatus === 'error' && (
                <><Warning size={11} />Save error</>
              )}
            </span>
            <span className={styles.statDivider} />
          </>
        )}

        <span className={styles.gitStatus}>
          <GitBranch size={12} />
          <CheckCircle size={12} color="var(--color-success)" weight="fill" />
          <span className={styles.gitLabel}>Clean</span>
        </span>

        {entity && (
          <>
            <span className={styles.statDivider} />
            <span className={styles.muted}>{formatFileSize(entity.fileSize)}</span>
          </>
        )}
      </div>
    </footer>
  );
}
