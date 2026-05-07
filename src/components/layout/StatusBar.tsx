import { useEffect } from 'react';
import {
  GitBranch, CheckCircle, FloppyDisk, Warning, Circle, GitCommit,
  DotOutline, Brain,
} from '@phosphor-icons/react';
import { useUIStore } from '../../store/ui.store';
import { useVaultData } from '../../store/vault.store';
import { useGitStore } from '../../store/git.store';
import { useChatStore } from '../../store/chat.store';
import { invoke } from '@tauri-apps/api/core';
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
  const { activeEntityId, saveStatus, askDrawerOpen, setAskDrawerOpen } = useUIStore(
    useShallow((s) => ({
      activeEntityId:   s.activeEntityId,
      saveStatus:       s.saveStatus,
      askDrawerOpen:    s.askDrawerOpen,
      setAskDrawerOpen: s.setAskDrawerOpen,
    })),
  );
  const { entities, schemas, vaultPath } = useVaultData();
  const { repoStatus, changedFiles, commitDrawerOpen, setCommitDrawerOpen, refresh } =
    useGitStore(
      useShallow((s) => ({
        repoStatus:          s.repoStatus,
        changedFiles:        s.changedFiles,
        commitDrawerOpen:    s.commitDrawerOpen,
        setCommitDrawerOpen: s.setCommitDrawerOpen,
        refresh:             s.refresh,
      })),
    );
  const loadApiKey = useChatStore((s) => s.loadApiKey);

  const entity = entities.find((e) => e.id === activeEntityId) ?? null;
  const schema = entity ? schemas.find((s) => s.name === entity.type) : null;

  // Poll git status every 30s when vault is open
  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  // Rebuild FTS index + load API key when vault opens
  useEffect(() => {
    if (!vaultPath) return;
    void invoke('fts_rebuild_index', { vaultPath });
    void loadApiKey();
  }, [vaultPath, loadApiKey]);

  // Rebuild FTS index after saves (debounced by the 'saved' state transition)
  useEffect(() => {
    if (saveStatus === 'saved') {
      void refresh();
      if (vaultPath) void invoke('fts_rebuild_index', { vaultPath });
    }
  }, [saveStatus, refresh, vaultPath]);

  const isDirty = repoStatus === 'dirty';
  const hasRepo = repoStatus !== 'no-repo';

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

        {/* Git status badge — clickable */}
        {hasRepo && (
          <button
            className={styles.gitStatus}
            onClick={() => setCommitDrawerOpen(!commitDrawerOpen)}
            aria-label="Toggle commit drawer"
            data-dirty={isDirty}
          >
            <GitBranch size={12} />
            {isDirty ? (
              <>
                <DotOutline size={14} weight="fill" className={styles.dirtyDot} />
                <span className={styles.gitLabel} data-dirty="true">
                  {changedFiles.length} {changedFiles.length === 1 ? 'change' : 'changes'}
                </span>
              </>
            ) : (
              <>
                <CheckCircle size={12} color="var(--color-success)" weight="fill" />
                <span className={styles.gitLabel}>Clean</span>
              </>
            )}
          </button>
        )}

        {!hasRepo && (
          <button
            className={styles.gitStatus}
            onClick={() => setCommitDrawerOpen(!commitDrawerOpen)}
            aria-label="Set up git repository"
          >
            <GitBranch size={12} />
            <span className={styles.gitLabelMuted}>No repo</span>
          </button>
        )}

        {/* Commit button — always visible when repo exists */}
        {hasRepo && (
          <>
            <span className={styles.statDivider} />
            <button
              className={styles.commitBtn}
              onClick={() => setCommitDrawerOpen(!commitDrawerOpen)}
              aria-label="Open commit drawer"
            >
              <GitCommit size={12} />
              <span>Commit</span>
            </button>
          </>
        )}

        {/* Ask button */}
        <span className={styles.statDivider} />
        <button
          className={styles.askBtn}
          onClick={() => setAskDrawerOpen(!askDrawerOpen)}
          aria-label="Quick ask Claude"
        >
          <Brain size={12} />
          <span>Ask</span>
        </button>

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
