import { useEffect, useRef, useState } from 'react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import { Brain, X, Trash, PaperPlaneTilt, Key, Eye, EyeSlash } from '@phosphor-icons/react';
import { useChatStore } from '../../store/chat.store';
import { useUIStore } from '../../store/ui.store';
import { useShallow } from 'zustand/react/shallow';
import ReactMarkdown from 'react-markdown';
import styles from './ChatPanel.module.css';

function ApiKeySetup() {
  const { saveApiKey, apiKeyError } = useChatStore(
    useShallow((s) => ({ saveApiKey: s.saveApiKey, apiKeyError: s.apiKeyError })),
  );
  const [input, setInput] = useState('');
  const [show, setShow] = useState(false);

  return (
    <div className={styles.keySetup}>
      <Key size={28} weight="duotone" color="var(--accent-text)" />
      <p className={styles.keyTitle}>Anthropic API key required</p>
      <p className={styles.keyHint}>
        Your key is stored locally in <code>.writerkit/settings.json</code> and never committed to git.
      </p>
      <div className={styles.keyInputWrap}>
        <input
          className={styles.keyInput}
          type={show ? 'text' : 'password'}
          placeholder="sk-ant-…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && input.trim()) void saveApiKey(input.trim());
          }}
        />
        <button className={styles.keyShowBtn} onClick={() => setShow((s) => !s)} aria-label="Toggle visibility">
          {show ? <EyeSlash size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {apiKeyError && <p className={styles.keyError}>{apiKeyError}</p>}
      <button
        className={styles.keySaveBtn}
        onClick={() => { if (input.trim()) void saveApiKey(input.trim()); }}
        disabled={!input.trim()}
      >
        Save key
      </button>
    </div>
  );
}

function Message({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  return (
    <div className={styles.message} data-role={role}>
      <div className={styles.messageBubble}>
        {role === 'assistant' ? (
          <ReactMarkdown>{content}</ReactMarkdown>
        ) : (
          <p>{content}</p>
        )}
      </div>
    </div>
  );
}

export default function ChatPanel() {
  const { setPropertiesPanelOpen } = useUIStore(
    useShallow((s) => ({ setPropertiesPanelOpen: s.setPropertiesPanelOpen })),
  );
  const { messages, isLoading, apiKey, apiKeyError, loadApiKey, clearMessages, sendMessage } =
    useChatStore(
      useShallow((s) => ({
        messages:     s.messages,
        isLoading:    s.isLoading,
        apiKey:       s.apiKey,
        apiKeyError:  s.apiKeyError,
        loadApiKey:   s.loadApiKey,
        clearMessages: s.clearMessages,
        sendMessage:  s.sendMessage,
      })),
    );

  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { void loadApiKey(); }, [loadApiKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    void sendMessage(text);
  }

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>
          <Brain size={14} weight="duotone" color="var(--accent-text)" />
          Claude
        </span>
        <div className={styles.headerActions}>
          {messages.length > 0 && (
            <button className={styles.iconBtn} onClick={clearMessages} aria-label="Clear conversation" title="Clear">
              <Trash size={13} />
            </button>
          )}
          <button
            className={styles.iconBtn}
            onClick={() => setPropertiesPanelOpen(false)}
            aria-label="Close panel"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      {!apiKey || apiKeyError ? (
        <ApiKeySetup />
      ) : (
        <>
          <ScrollArea.Root className={styles.scrollRoot}>
            <ScrollArea.Viewport className={styles.scrollViewport}>
              {messages.length === 0 && (
                <div className={styles.empty}>
                  <Brain size={32} weight="thin" color="var(--text-tertiary)" />
                  <p>Ask anything about your writing project. Claude will search your vault for context.</p>
                </div>
              )}
              {messages.map((m) => (
                <Message key={m.id} role={m.role} content={m.content} />
              ))}
              {isLoading && (
                <div className={styles.message} data-role="assistant">
                  <div className={styles.messageBubble}>
                    <span className={styles.thinking}>Thinking…</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar className={styles.scrollbar} orientation="vertical">
              <ScrollArea.Thumb className={styles.scrollThumb} />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>

          {/* Input */}
          <div className={styles.inputWrap}>
            <textarea
              ref={textareaRef}
              className={styles.input}
              placeholder="Ask Claude…"
              value={input}
              rows={2}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              aria-label="Send"
            >
              <PaperPlaneTilt size={14} weight="fill" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
