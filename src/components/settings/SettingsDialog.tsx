import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Sun, Moon, GitBranch, Brain, Key, Eye, EyeSlash, Check, Image } from '@phosphor-icons/react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../../store/settings.store';
import { useChatStore } from '../../store/chat.store';
import { useVaultData } from '../../store/vault.store';
import styles from './SettingsDialog.module.css';

// ─── Section wrapper ──────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowLabel}>
        <span>{label}</span>
        {hint && <span className={styles.rowHint}>{hint}</span>}
      </div>
      <div className={styles.rowControl}>{children}</div>
    </div>
  );
}

// ─── Appearance section ───────────────────────────────────

function AppearanceSection() {
  const { theme, setTheme } = useSettingsStore();
  return (
    <Section title="Appearance">
      <Row label="Theme">
        <div className={styles.segmented}>
          <button
            className={styles.segBtn}
            data-active={theme === 'dark'}
            onClick={() => setTheme('dark')}
          >
            <Moon size={13} />
            Dark
          </button>
          <button
            className={styles.segBtn}
            data-active={theme === 'light'}
            onClick={() => setTheme('light')}
          >
            <Sun size={13} />
            Light
          </button>
        </div>
      </Row>
    </Section>
  );
}

// ─── Git section ──────────────────────────────────────────

function GitSection() {
  const { vaultPath } = useVaultData();
  const [remote, setRemote] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vaultPath) return;
    invoke<string | null>('git_get_remote', { vaultPath })
      .then((r) => setRemote(r ?? ''))
      .catch(() => {});
  }, [vaultPath]);

  async function handleSave() {
    if (!vaultPath) return;
    setError(null);
    try {
      await invoke('git_set_remote', { vaultPath, url: remote.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <Section title="Git">
      <Row label="Remote URL" hint="GitHub or other remote for push/pull">
        <div className={styles.inputRow}>
          <input
            className={styles.input}
            type="text"
            placeholder="https://github.com/you/vault.git"
            value={remote}
            onChange={(e) => { setRemote(e.target.value); setSaved(false); }}
          />
          <button className={styles.saveBtn} onClick={() => void handleSave()} disabled={!remote.trim()}>
            {saved ? <Check size={13} /> : <GitBranch size={13} />}
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
        {error && <p className={styles.errorMsg}>{error}</p>}
      </Row>
    </Section>
  );
}

// ─── Claude section ───────────────────────────────────────

function ClaudeSection() {
  const { vaultPath } = useVaultData();
  const { apiKey, loadApiKey, saveApiKey } = useChatStore();
  const [input, setInput] = useState('');
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!input.trim()) return;
    await saveApiKey(input.trim());
    setInput('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleClear() {
    if (!vaultPath) return;
    await invoke('save_api_key', { vaultPath, key: '' });
    await loadApiKey();
  }

  const keySource = apiKey
    ? `Key loaded — ${apiKey.slice(0, 8)}${'•'.repeat(12)}`
    : 'No key set';

  return (
    <Section title="Claude">
      <Row label="API Key" hint="Stored locally in .writerkit/settings.json, never committed">
        <div className={styles.keyStatus}>
          <Brain size={13} color={apiKey ? 'var(--color-success)' : 'var(--text-tertiary)'} />
          <span className={styles.keyStatusText}>{keySource}</span>
          {apiKey && (
            <button className={styles.clearBtn} onClick={() => void handleClear()}>
              Clear
            </button>
          )}
        </div>
        <div className={styles.inputRow}>
          <div className={styles.passwordWrap}>
            <input
              className={styles.input}
              type={show ? 'text' : 'password'}
              placeholder={apiKey ? 'Enter new key to replace…' : 'sk-ant-…'}
              value={input}
              onChange={(e) => { setInput(e.target.value); setSaved(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); }}
            />
            <button className={styles.showBtn} onClick={() => setShow((s) => !s)} aria-label="Toggle visibility">
              {show ? <EyeSlash size={13} /> : <Eye size={13} />}
            </button>
          </div>
          <button className={styles.saveBtn} onClick={() => void handleSave()} disabled={!input.trim()}>
            {saved ? <Check size={13} /> : <Key size={13} />}
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </Row>
    </Section>
  );
}

// ─── Unsplash section ─────────────────────────────────────

function UnsplashSection() {
  const { unsplashKey, setUnsplashKey } = useSettingsStore();
  const [input, setInput] = useState('');
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setUnsplashKey(input.trim());
    setInput('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleClear() {
    setUnsplashKey('');
    setSaved(false);
  }

  const keySource = unsplashKey
    ? `Key set — ${unsplashKey.slice(0, 8)}${'•'.repeat(12)}`
    : 'No key set';

  return (
    <Section title="Unsplash">
      <Row label="Access Key" hint="Required to search Unsplash for cover images">
        <div className={styles.keyStatus}>
          <Image size={13} color={unsplashKey ? 'var(--color-success)' : 'var(--text-tertiary)'} />
          <span className={styles.keyStatusText}>{keySource}</span>
          {unsplashKey && (
            <button className={styles.clearBtn} onClick={handleClear}>
              Clear
            </button>
          )}
        </div>
        <div className={styles.inputRow}>
          <div className={styles.passwordWrap}>
            <input
              className={styles.input}
              type={show ? 'text' : 'password'}
              placeholder={unsplashKey ? 'Enter new key to replace…' : 'Your Unsplash Access Key…'}
              value={input}
              onChange={(e) => { setInput(e.target.value); setSaved(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            />
            <button className={styles.showBtn} onClick={() => setShow((s) => !s)} aria-label="Toggle visibility">
              {show ? <EyeSlash size={13} /> : <Eye size={13} />}
            </button>
          </div>
          <button className={styles.saveBtn} onClick={handleSave} disabled={!input.trim()}>
            {saved ? <Check size={13} /> : <Key size={13} />}
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </Row>
    </Section>
  );
}

// ─── Dialog ───────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ open, onClose }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <div className={styles.header}>
            <Dialog.Title className={styles.title}>Settings</Dialog.Title>
            <Dialog.Close asChild>
              <button className={styles.closeBtn} aria-label="Close settings">
                <X size={15} />
              </button>
            </Dialog.Close>
          </div>

          <div className={styles.body}>
            <AppearanceSection />
            <div className={styles.divider} />
            <GitSection />
            <div className={styles.divider} />
            <ClaudeSection />
            <div className={styles.divider} />
            <UnsplashSection />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
