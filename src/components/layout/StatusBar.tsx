import { GitBranch, CheckCircle } from '@phosphor-icons/react';
import { useUIStore } from '../../store/ui.store';
import { useShallow } from 'zustand/react/shallow';
import styles from './StatusBar.module.css';

export default function StatusBar() {
  const activeEntityId = useUIStore((s) => s.activeEntityId);

  const hasFile = !!activeEntityId;

  return (
    <footer className={styles.bar}>
      {/* Left — breadcrumb */}
      <div className={styles.left}>
        {hasFile ? (
          <>
            <span className={styles.breadcrumb}>Aragorn</span>
            <span className={styles.sep}>·</span>
            <span className={styles.type}>Character</span>
          </>
        ) : (
          <span className={styles.muted}>No file open</span>
        )}
      </div>

      {/* Centre — document stats */}
      <div className={styles.centre}>
        {hasFile && (
          <>
            <span className={styles.stat}>
              <span className={styles.statLabel}>Words</span>
              <span className={styles.statValue}>1,234</span>
            </span>
            <span className={styles.statDivider} />
            <span className={styles.stat}>
              <span className={styles.statLabel}>Chars</span>
              <span className={styles.statValue}>6,789</span>
            </span>
            <span className={styles.statDivider} />
            <span className={styles.stat}>
              <span className={styles.statValue}>~5 min read</span>
            </span>
          </>
        )}
      </div>

      {/* Right — git + file size */}
      <div className={styles.right}>
        <span className={styles.gitStatus}>
          <GitBranch size={12} />
          <CheckCircle size={12} color="var(--color-success)" weight="fill" />
          <span className={styles.gitLabel}>Clean</span>
        </span>
        {hasFile && (
          <>
            <span className={styles.statDivider} />
            <span className={styles.muted}>12.3 KB</span>
          </>
        )}
      </div>
    </footer>
  );
}
