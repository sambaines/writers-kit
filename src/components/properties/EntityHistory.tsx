import { useEffect, useState } from 'react';
import { GitBranch } from '@phosphor-icons/react';
import SubHeader from '../ui/SubHeader';
import { useGitStore } from '../../store/git.store';
import type { GitCommit } from '../../types';
import styles from './EntityHistory.module.css';

function formatTs(ts: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(ts * 1000));
}

interface Props {
  entityPath: string;
}

export default function EntityHistory({ entityPath }: Props) {
  const [open, setOpen] = useState(false);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const getFileHistory = useGitStore((s) => s.getFileHistory);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setCommits([]);
    getFileHistory(entityPath)
      .then(setCommits)
      .finally(() => setLoading(false));
  }, [open, entityPath, getFileHistory]);

  return (
    <section className={styles.section}>
      <SubHeader
        title="History"
        open={open}
        onToggle={() => setOpen((o) => !o)}
        action={<GitBranch size={12} />}
      />

      {open && (
        <div className={styles.list}>
          {loading && <span className={styles.empty}>Loading…</span>}
          {!loading && commits.length === 0 && (
            <span className={styles.empty}>No commits for this file</span>
          )}
          {commits.map((c) => (
            <div key={c.hash} className={styles.commit}>
              <span className={styles.hash}>{c.short_hash}</span>
              <span className={styles.msg}>{c.message}</span>
              <span className={styles.date}>{formatTs(c.timestamp)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
