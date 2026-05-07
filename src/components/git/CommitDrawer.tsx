import { useState, useEffect, useRef } from 'react';
import {
  X, GitCommit, GitBranch, CloudArrowUp, FileText,
  Plus, Minus, ArrowsClockwise, FolderSimplePlus,
} from '@phosphor-icons/react';
import { invoke } from '@tauri-apps/api/core';
import { useGitStore } from '../../store/git.store';
import { useVaultStore } from '../../store/vault.store';
import { useShallow } from 'zustand/react/shallow';
import type { GitFileStatus } from '../../types';
import styles from './CommitDrawer.module.css';

function generateMessage(files: GitFileStatus[]): string {
  if (!files.length) return '';
  if (files.length === 1) {
    const name = files[0].path.split('/').pop()?.replace(/\.md$/, '') ?? files[0].path;
    const verb = files[0].status === 'added' ? 'Add'
      : files[0].status === 'deleted' ? 'Remove'
      : 'Update';
    return `${verb} ${name}`;
  }
  const names = files.slice(0, 3).map(
    (f) => f.path.split('/').pop()?.replace(/\.md$/, '') ?? f.path,
  );
  const extra = files.length > 3 ? ` and ${files.length - 3} more` : '';
  return `Update ${names.join(', ')}${extra}`;
}

function StatusIcon({ status }: { status: GitFileStatus['status'] }) {
  switch (status) {
    case 'added':    return <Plus size={10} className={styles.iconAdded} />;
    case 'deleted':  return <Minus size={10} className={styles.iconDeleted} />;
    case 'renamed':  return <ArrowsClockwise size={10} className={styles.iconModified} />;
    default:         return <FileText size={10} className={styles.iconModified} />;
  }
}

export default function CommitDrawer() {
  const { repoStatus, commitDrawerOpen, changedFiles, isCommitting, isPushing, setCommitDrawerOpen, commit, push, refresh } =
    useGitStore(
      useShallow((s) => ({
        repoStatus:          s.repoStatus,
        commitDrawerOpen:    s.commitDrawerOpen,
        changedFiles:        s.changedFiles,
        isCommitting:        s.isCommitting,
        isPushing:           s.isPushing,
        setCommitDrawerOpen: s.setCommitDrawerOpen,
        commit:              s.commit,
        push:                s.push,
        refresh:             s.refresh,
      })),
    );
  const vaultPath = useVaultStore((s) => s.vaultPath);

  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-fill message when files change or drawer opens
  useEffect(() => {
    if (commitDrawerOpen && changedFiles.length > 0) {
      setMessage((prev) => prev || generateMessage(changedFiles));
    }
  }, [commitDrawerOpen, changedFiles]);

  // Focus textarea when drawer opens
  useEffect(() => {
    if (commitDrawerOpen) {
      setTimeout(() => textareaRef.current?.focus(), 50);
      setError(null);
    }
  }, [commitDrawerOpen]);

  async function handleCommit() {
    if (!message.trim()) return;
    setError(null);
    try {
      await commit(message.trim());
      setMessage('');
      setCommitDrawerOpen(false);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleInit() {
    if (!vaultPath) return;
    setIsInitializing(true);
    setError(null);
    try {
      await invoke('git_init', { vaultPath });
      if (remoteUrl.trim()) {
        await invoke('git_set_remote', { vaultPath, url: remoteUrl.trim() });
      }
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setIsInitializing(false);
    }
  }

  async function handleCommitAndPush() {
    if (!message.trim()) return;
    setError(null);
    try {
      await commit(message.trim());
      await push();
      setMessage('');
      setCommitDrawerOpen(false);
    } catch (e) {
      setError(String(e));
    }
  }

  if (!commitDrawerOpen) return null;

  const busy = isCommitting || isPushing || isInitializing;

  // ── No repo — show setup panel ──────────────────────────
  if (repoStatus === 'no-repo') {
    return (
      <div className={styles.overlay} onClick={() => setCommitDrawerOpen(false)}>
        <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
          <div className={styles.header}>
            <span className={styles.title}>
              <GitBranch size={14} />
              Set up Git
            </span>
            <button className={styles.closeBtn} onClick={() => setCommitDrawerOpen(false)} aria-label="Close">
              <X size={14} />
            </button>
          </div>
          <div className={styles.setupBody}>
            <p className={styles.setupHint}>
              Initialize a git repository in your vault to track changes and push to GitHub.
            </p>
            <label className={styles.setupLabel}>GitHub remote URL (optional)</label>
            <input
              className={styles.setupInput}
              type="text"
              placeholder="https://github.com/you/your-vault.git"
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
            />
            {error && <div className={styles.error}>{error}</div>}
          </div>
          <div className={styles.actions}>
            <button
              className={styles.pushBtn}
              onClick={() => void handleInit()}
              disabled={busy}
            >
              <FolderSimplePlus size={13} />
              {isInitializing ? 'Initializing…' : 'Initialize repository'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={() => setCommitDrawerOpen(false)}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>
            <GitBranch size={14} />
            Commit changes
          </span>
          <div className={styles.headerRight}>
            <button
              className={styles.refreshBtn}
              onClick={() => void refresh()}
              aria-label="Refresh status"
              disabled={busy}
            >
              <ArrowsClockwise size={13} />
            </button>
            <button
              className={styles.closeBtn}
              onClick={() => setCommitDrawerOpen(false)}
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Changed files */}
        <div className={styles.files}>
          {changedFiles.length === 0 ? (
            <span className={styles.empty}>Nothing to commit</span>
          ) : (
            changedFiles.map((f) => (
              <div key={f.path} className={styles.fileRow}>
                <StatusIcon status={f.status} />
                <span className={styles.filePath}>{f.path}</span>
                <span className={styles.fileStatus} data-status={f.status}>{f.status}</span>
              </div>
            ))
          )}
        </div>

        {/* Commit message */}
        <div className={styles.messageWrap}>
          <textarea
            ref={textareaRef}
            className={styles.message}
            placeholder="Commit message…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                void handleCommit();
              }
            }}
          />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {/* Actions */}
        <div className={styles.actions}>
          <button
            className={styles.commitBtn}
            onClick={() => void handleCommit()}
            disabled={busy || !message.trim() || changedFiles.length === 0}
          >
            <GitCommit size={13} />
            {isCommitting ? 'Committing…' : 'Commit'}
          </button>
          <button
            className={styles.pushBtn}
            onClick={() => void handleCommitAndPush()}
            disabled={busy || !message.trim() || changedFiles.length === 0}
          >
            <CloudArrowUp size={13} />
            {isPushing ? 'Pushing…' : 'Commit & Push'}
          </button>
        </div>
      </div>
    </div>
  );
}
