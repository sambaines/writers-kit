import { useState, useEffect, useRef } from 'react';
import { X, Brain, PaperPlaneTilt, ArrowRight } from '@phosphor-icons/react';
import { invoke } from '@tauri-apps/api/core';
import { useUIStore } from '../../store/ui.store';
import { useVaultStore } from '../../store/vault.store';
import { useChatStore } from '../../store/chat.store';
import { useShallow } from 'zustand/react/shallow';
import ReactMarkdown from 'react-markdown';
import styles from './AskDrawer.module.css';

export default function AskDrawer() {
  const { askDrawerOpen, setAskDrawerOpen, setActiveRightPanel, setPropertiesPanelOpen } =
    useUIStore(
      useShallow((s) => ({
        askDrawerOpen:         s.askDrawerOpen,
        setAskDrawerOpen:      s.setAskDrawerOpen,
        setActiveRightPanel:   s.setActiveRightPanel,
        setPropertiesPanelOpen: s.setPropertiesPanelOpen,
      })),
    );
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const apiKey = useChatStore((s) => s.apiKey);
  const sendMessage = useChatStore((s) => s.sendMessage);

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (askDrawerOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setAnswer(null);
      setError(null);
    }
  }, [askDrawerOpen]);

  async function handleAsk() {
    const q = question.trim();
    if (!q || isLoading || !apiKey || !vaultPath) return;
    setIsLoading(true);
    setAnswer(null);
    setError(null);
    try {
      const result = await invoke<string>('claude_chat', {
        vaultPath,
        apiKey,
        messages: [{ role: 'user', content: q }],
      });
      setAnswer(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  }

  function handleOpenInPanel() {
    // Send to full chat panel with context
    if (question.trim() && answer) {
      void sendMessage(question.trim());
    }
    setActiveRightPanel('chat');
    setPropertiesPanelOpen(true);
    setAskDrawerOpen(false);
  }

  if (!askDrawerOpen) return null;

  return (
    <div className={styles.overlay} onClick={() => setAskDrawerOpen(false)}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>
            <Brain size={14} weight="duotone" color="var(--accent-text)" />
            Quick Ask
          </span>
          <button className={styles.closeBtn} onClick={() => setAskDrawerOpen(false)} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        {/* Answer area */}
        {(answer || isLoading || error) && (
          <div className={styles.answerWrap}>
            {isLoading && <span className={styles.thinking}>Thinking…</span>}
            {error && <span className={styles.error}>{error}</span>}
            {answer && (
              <>
                <div className={styles.answer}>
                  <ReactMarkdown>{answer}</ReactMarkdown>
                </div>
                <button className={styles.openPanelBtn} onClick={handleOpenInPanel}>
                  <ArrowRight size={12} />
                  Continue in Chat panel
                </button>
              </>
            )}
          </div>
        )}

        {/* Input */}
        <div className={styles.inputWrap}>
          <textarea
            ref={inputRef}
            className={styles.input}
            placeholder={apiKey ? 'Ask anything about your project…' : 'Set up your API key in the Chat panel first'}
            value={question}
            rows={2}
            disabled={!apiKey}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                void handleAsk();
              }
            }}
          />
          <button
            className={styles.sendBtn}
            onClick={() => void handleAsk()}
            disabled={!question.trim() || isLoading || !apiKey}
            aria-label="Ask"
          >
            <PaperPlaneTilt size={14} weight="fill" />
          </button>
        </div>
      </div>
    </div>
  );
}
