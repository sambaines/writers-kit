import { useEffect, useRef, useCallback } from 'react';
import matter from 'gray-matter';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import LinkExtension from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { Markdown } from 'tiptap-markdown';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  TextB, TextItalic, TextUnderline, TextStrikethrough,
  ListBullets, ListNumbers, Quotes, Code, Terminal, Link,
  ArrowCounterClockwise, ArrowClockwise,
  Eye, PencilLine, SidebarSimple, Feather, Brain,
} from '@phosphor-icons/react';
import { useUIStore } from '../../store/ui.store';
import { useVaultData, useVaultStore } from '../../store/vault.store';
import { useShallow } from 'zustand/react/shallow';
import {
  scheduleSave,
  cancelScheduledSave,
  saveEntity,
  scheduleRawSave,
  saveRawContent,
  buildRawContent,
  preprocessMarkdownForWikiLinks,
} from '../../services/editor.service';
import { WikiLink } from '../../extensions/WikiLink';
import { buildWikiLinkSuggestion } from '../../extensions/WikiLinkSuggestion';
import { ShikiCodeBlock } from '../../extensions/ShikiCodeBlock';
import clsx from 'clsx';
import styles from './EditorPane.module.css';

// ─── Toolbar button ───────────────────────────────────────

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

function ToolbarButton({ icon, label, active, disabled, onClick }: ToolbarButtonProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          className={clsx(styles.toolbarBtn, active && styles.toolbarBtnActive)}
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
        >
          {icon}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className={styles.tooltip} sideOffset={6}>
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

// ─── Editor pane ─────────────────────────────────────────

export default function EditorPane() {
  const {
    activeEntityId, editorView, setEditorView,
    propertiesPanelOpen, togglePropertiesPanel,
    activeRightPanel, setActiveRightPanel, setPropertiesPanelOpen,
  } = useUIStore(
    useShallow((s) => ({
      activeEntityId:         s.activeEntityId,
      editorView:             s.editorView,
      setEditorView:          s.setEditorView,
      propertiesPanelOpen:    s.propertiesPanelOpen,
      togglePropertiesPanel:  s.togglePropertiesPanel,
      activeRightPanel:       s.activeRightPanel,
      setActiveRightPanel:    s.setActiveRightPanel,
      setPropertiesPanelOpen: s.setPropertiesPanelOpen,
    })),
  );

  const { entities, schemas } = useVaultData();
  const activeEntity = entities.find((e) => e.id === activeEntityId) ?? null;

  // Keep a stable ref to entities/schemas for the suggestion plugin
  const entitiesRef    = useRef(entities);
  const schemasRef     = useRef(schemas);
  const activeEntityRef = useRef(activeEntity);
  useEffect(() => { entitiesRef.current    = entities;     }, [entities]);
  useEffect(() => { schemasRef.current     = schemas;      }, [schemas]);
  useEffect(() => { activeEntityRef.current = activeEntity; }, [activeEntity]);

  // Title field state — synced to entity
  const titleRef = useRef<HTMLInputElement>(null);
  const prevEntityIdRef  = useRef<string | null>(null);
  // Prevents the onUpdate handler from firing during programmatic content loads
  const isLoadingRef = useRef(false);
  // Stable ref so the entity-switch flush can read current view mode
  const editorViewRef = useRef(editorView);
  useEffect(() => { editorViewRef.current = editorView; }, [editorView]);

  // ─── TipTap editor ─────────────────────────────────────

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // replaced by ShikiCodeBlock
      }),
      Underline,
      LinkExtension.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CharacterCount,
      Placeholder.configure({
        placeholder: 'Start writing…',
        emptyNodeClass: styles.editorEmpty,
      }),
      Markdown.configure({
        html: true,
        tightLists: true,
        bulletListMarker: '-',
        linkify: false,
        breaks: false,
      }),
      ShikiCodeBlock,
      WikiLink.configure({
        suggestion: buildWikiLinkSuggestion(
          () => entitiesRef.current,
          () => schemasRef.current,
        ),
      }),
    ],
    editorProps: {
      attributes: {
        class: styles.proseMirror,
      },
    },
    onUpdate: ({ editor: e }) => {
      const entity = activeEntityRef.current;
      if (isLoadingRef.current || !entity) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const markdown = (e.storage as any).markdown?.getMarkdown?.() ?? '';
      const title = titleRef.current?.value ?? entity.title;
      scheduleSave(entity, title, markdown);
    },
    content: '',
    autofocus: false,
  });

  // ─── Load entity content when activeEntityId changes ───

  useEffect(() => {
    if (!editor || !activeEntity) {
      if (editor) editor.commands.setContent('');
      prevEntityIdRef.current = null;
      return;
    }

    if (activeEntity.id === prevEntityIdRef.current) return;

    // ── Flush any pending save for the entity we're switching AWAY from ──
    // cancelScheduledSave alone would discard unsaved changes (e.g. language
    // set via dropdown). Instead, read the current editor state and save
    // immediately before loading the next entity.
    const prevId = prevEntityIdRef.current;
    if (prevId) {
      const prevEntity = useVaultStore.getState().entities.find((e) => e.id === prevId);
      if (prevEntity) {
        cancelScheduledSave();
        if (editorViewRef.current === 'raw' && rawRef.current) {
          // Flush raw content as-is
          void saveRawContent(prevEntity, rawRef.current.value);
        } else {
          const title    = titleRef.current?.value ?? prevEntity.title;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const markdown = (editor.storage as any).markdown?.getMarkdown?.() ?? '';
          void saveEntity(prevEntity, title, markdown);
        }
      } else {
        cancelScheduledSave();
      }
    }

    prevEntityIdRef.current = activeEntity.id;

    // Preprocess body to convert [[WikiLinks]] to parseable HTML
    const preprocessed = preprocessMarkdownForWikiLinks(activeEntity.body);

    isLoadingRef.current = true;
    editor.commands.setContent(preprocessed);
    isLoadingRef.current = false;

    // Sync title input
    if (titleRef.current) {
      titleRef.current.value = activeEntity.title;
    }

    // Reset save status
    useUIStore.getState().setSaveStatus('idle');
  }, [editor, activeEntity?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Raw editor content (synced with TipTap) ───────────

  const rawRef = useRef<HTMLTextAreaElement>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function editorMarkdown(): string {
    return (editor?.storage as any)?.markdown?.getMarkdown?.() ?? '';
  }

  useEffect(() => {
    if (editorView === 'raw' && rawRef.current && activeEntity && editor) {
      rawRef.current.value = buildRawContent(activeEntity, editorMarkdown() || activeEntity.body);
    }
  }, [editorView, activeEntity?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleRawChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    if (!activeEntity) return;
    scheduleRawSave(activeEntity, e.target.value);
  }

  function handleSwitchToRaw() {
    if (editor && rawRef.current && activeEntity) {
      rawRef.current.value = buildRawContent(activeEntity, editorMarkdown());
    }
    setEditorView('raw');
  }

  function handleSwitchToRich() {
    if (rawRef.current && editor && activeEntity) {
      // Flush any pending raw save immediately so entity in store is up-to-date
      void saveRawContent(activeEntity, rawRef.current.value);

      // Re-parse body from the raw content and load it into the rich editor
      const { content: body } = matter(rawRef.current.value);
      const trimmedBody = body.replace(/^\n/, '');
      const preprocessed = preprocessMarkdownForWikiLinks(trimmedBody);
      isLoadingRef.current = true;
      editor.commands.setContent(preprocessed);
      isLoadingRef.current = false;

      // Sync the title input from the store's updated entity
      if (titleRef.current) {
        const updated = useVaultStore.getState().entities.find((e) => e.id === activeEntity.id);
        titleRef.current.value = updated?.title ?? activeEntity.title;
      }
    }
    setEditorView('rich');
  }

  // ─── Title change ───────────────────────────────────────

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const entity = activeEntityRef.current;
      if (!entity || !editor) return;
      const markdown = editorMarkdown();
      scheduleSave(entity, e.target.value, markdown);
    },
    [editor], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Flush save on unmount
  useEffect(() => {
    return () => { cancelScheduledSave(); };
  }, []);

  // ─── Render ─────────────────────────────────────────────

  return (
    <Tooltip.Provider delayDuration={600}>
      <div className={styles.pane}>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          {activeEntity ? (
            <>
              <div className={styles.toolbarGroup}>
                <ToolbarButton
                  icon={<TextB size={15} />}
                  label="Bold"
                  active={editor?.isActive('bold')}
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                />
                <ToolbarButton
                  icon={<TextItalic size={15} />}
                  label="Italic"
                  active={editor?.isActive('italic')}
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                />
                <ToolbarButton
                  icon={<TextUnderline size={15} />}
                  label="Underline"
                  active={editor?.isActive('underline')}
                  onClick={() => editor?.chain().focus().toggleUnderline().run()}
                />
                <ToolbarButton
                  icon={<TextStrikethrough size={15} />}
                  label="Strikethrough"
                  active={editor?.isActive('strike')}
                  onClick={() => editor?.chain().focus().toggleStrike().run()}
                />
              </div>

              <div className={styles.toolbarSep} />

              <div className={styles.toolbarGroup}>
                <ToolbarButton
                  icon={<ListBullets size={15} />}
                  label="Bullet list"
                  active={editor?.isActive('bulletList')}
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                />
                <ToolbarButton
                  icon={<ListNumbers size={15} />}
                  label="Numbered list"
                  active={editor?.isActive('orderedList')}
                  onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                />
                <ToolbarButton
                  icon={<Quotes size={15} />}
                  label="Blockquote"
                  active={editor?.isActive('blockquote')}
                  onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                />
                <ToolbarButton
                  icon={<Code size={15} />}
                  label="Inline code"
                  active={editor?.isActive('code')}
                  onClick={() => editor?.chain().focus().toggleCode().run()}
                />
                <ToolbarButton
                  icon={<Terminal size={15} />}
                  label="Code block"
                  active={editor?.isActive('codeBlock')}
                  onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
                />
                <ToolbarButton
                  icon={<Link size={15} />}
                  label="Link"
                  active={editor?.isActive('link')}
                  onClick={() => {
                    const url = window.prompt('URL');
                    if (url) editor?.chain().focus().setLink({ href: url }).run();
                  }}
                />
              </div>

              <div className={styles.toolbarSep} />

              <div className={styles.toolbarGroup}>
                <ToolbarButton
                  icon={<ArrowCounterClockwise size={15} />}
                  label="Undo"
                  disabled={!editor?.can().undo()}
                  onClick={() => editor?.chain().focus().undo().run()}
                />
                <ToolbarButton
                  icon={<ArrowClockwise size={15} />}
                  label="Redo"
                  disabled={!editor?.can().redo()}
                  onClick={() => editor?.chain().focus().redo().run()}
                />
              </div>
            </>
          ) : (
            <div className={styles.toolbarGroup} />
          )}

          {/* Right side */}
          <div className={styles.toolbarRight}>
            {activeEntity && (
              <div className={clsx(styles.toolbarGroup, styles.viewToggle)}>
                <button
                  className={clsx(styles.viewBtn, editorView === 'rich' && styles.viewBtnActive)}
                  onClick={handleSwitchToRich}
                >
                  <PencilLine size={14} />
                  <span>Editor</span>
                </button>
                <button
                  className={clsx(styles.viewBtn, editorView === 'raw' && styles.viewBtnActive)}
                  onClick={handleSwitchToRaw}
                >
                  <Eye size={14} />
                  <span>Raw</span>
                </button>
              </div>
            )}
            <div className={styles.toolbarSep} />
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  className={clsx(styles.toolbarBtn, propertiesPanelOpen && activeRightPanel === 'chat' && styles.toolbarBtnActive)}
                  onClick={() => {
                    if (propertiesPanelOpen && activeRightPanel === 'chat') {
                      setPropertiesPanelOpen(false);
                    } else {
                      setActiveRightPanel('chat');
                    }
                  }}
                  aria-label="Toggle chat panel"
                >
                  <Brain size={15} />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className={styles.tooltip} sideOffset={6}>
                  {propertiesPanelOpen && activeRightPanel === 'chat' ? 'Hide Claude' : 'Ask Claude'}
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  className={clsx(styles.toolbarBtn, propertiesPanelOpen && activeRightPanel === 'properties' && styles.toolbarBtnActive)}
                  onClick={() => {
                    if (propertiesPanelOpen && activeRightPanel === 'properties') {
                      togglePropertiesPanel();
                    } else {
                      setActiveRightPanel('properties');
                    }
                  }}
                  aria-label="Toggle properties panel"
                >
                  <SidebarSimple size={15} mirrored />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className={styles.tooltip} sideOffset={6}>
                  {propertiesPanelOpen && activeRightPanel === 'properties' ? 'Hide properties' : 'Show properties'}
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </div>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {!activeEntity ? (
            <div className={styles.welcome}>
              <Feather size={40} weight="thin" color="var(--text-tertiary)" />
              <p className={styles.welcomeTitle}>Select a file to start writing</p>
              <p className={styles.welcomeSub}>
                Choose an entity from the list, or create a new one.
              </p>
            </div>
          ) : (
            <div className={styles.editorContent}>
              {/* Editable title */}
              <div className={styles.titleWrapper}>
                <input
                  ref={titleRef}
                  className={styles.titleInput}
                  defaultValue={activeEntity.title}
                  placeholder="Untitled"
                  onChange={handleTitleChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      editor?.commands.focus();
                    }
                  }}
                />
              </div>

              {/* Rich editor */}
              {editorView === 'rich' && (
                <EditorContent editor={editor} className={styles.editorWrap} />
              )}

              {/* Raw textarea */}
              {editorView === 'raw' && (
                <div className={styles.rawEditor}>
                  <textarea
                    ref={rawRef}
                    className={styles.rawTextarea}
                    spellCheck={false}
                    onChange={handleRawChange}
                  />
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </Tooltip.Provider>
  );
}
