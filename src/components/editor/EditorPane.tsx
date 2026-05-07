import type { ReactNode } from 'react';
import {
  TextB, TextItalic, TextUnderline, TextStrikethrough,
  ListBullets, ListNumbers, Quotes, Code, Terminal, Link,
  ArrowCounterClockwise, ArrowClockwise,
  Eye, PencilLine,
  SidebarSimple,
  Feather,
} from '@phosphor-icons/react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useUIStore } from '../../store/ui.store';
import { useShallow } from 'zustand/react/shallow';
import clsx from 'clsx';
import styles from './EditorPane.module.css';

interface ToolbarButtonProps {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function ToolbarButton({ icon, label, active, onClick }: ToolbarButtonProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          className={clsx(styles.toolbarBtn, active && styles.toolbarBtnActive)}
          onClick={onClick}
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

export default function EditorPane() {
  const { activeEntityId, editorView, setEditorView, propertiesPanelOpen, togglePropertiesPanel } =
    useUIStore(
      useShallow((s) => ({
        activeEntityId:        s.activeEntityId,
        editorView:            s.editorView,
        setEditorView:         s.setEditorView,
        propertiesPanelOpen:   s.propertiesPanelOpen,
        togglePropertiesPanel: s.togglePropertiesPanel,
      }))
    );

  return (
    <Tooltip.Provider delayDuration={600}>
      <div className={styles.pane}>
        {/* Toolbar */}
        <div className={styles.toolbar}>
          {activeEntityId ? (
            <>
              {/* Formatting group */}
              <div className={styles.toolbarGroup}>
                <ToolbarButton icon={<TextB size={15} />}              label="Bold" />
                <ToolbarButton icon={<TextItalic size={15} />}         label="Italic" />
                <ToolbarButton icon={<TextUnderline size={15} />}      label="Underline" />
                <ToolbarButton icon={<TextStrikethrough size={15} />}  label="Strikethrough" />
              </div>

              <div className={styles.toolbarSep} />

              <div className={styles.toolbarGroup}>
                <ToolbarButton icon={<ListBullets size={15} />}  label="Bullet list" />
                <ToolbarButton icon={<ListNumbers size={15} />}  label="Numbered list" />
                <ToolbarButton icon={<Quotes size={15} />}       label="Blockquote" />
                <ToolbarButton icon={<Code size={15} />}       label="Inline code" />
                <ToolbarButton icon={<Terminal size={15} />}   label="Code block" />
                <ToolbarButton icon={<Link size={15} />}         label="Link" />
              </div>

              <div className={styles.toolbarSep} />

              <div className={styles.toolbarGroup}>
                <ToolbarButton icon={<ArrowCounterClockwise size={15} />} label="Undo" />
                <ToolbarButton icon={<ArrowClockwise size={15} />}        label="Redo" />
              </div>
            </>
          ) : (
            <div className={styles.toolbarGroup} />
          )}

          {/* Right side — view + props toggle */}
          <div className={styles.toolbarRight}>
            {activeEntityId && (
              <div className={clsx(styles.toolbarGroup, styles.viewToggle)}>
                <button
                  className={clsx(styles.viewBtn, editorView === 'rich' && styles.viewBtnActive)}
                  onClick={() => setEditorView('rich')}
                >
                  <PencilLine size={14} />
                  <span>Editor</span>
                </button>
                <button
                  className={clsx(styles.viewBtn, editorView === 'raw' && styles.viewBtnActive)}
                  onClick={() => setEditorView('raw')}
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
                  className={clsx(styles.toolbarBtn, propertiesPanelOpen && styles.toolbarBtnActive)}
                  onClick={togglePropertiesPanel}
                  aria-label="Toggle properties panel"
                >
                  <SidebarSimple size={15} mirrored />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className={styles.tooltip} sideOffset={6}>
                  {propertiesPanelOpen ? 'Hide properties' : 'Show properties'}
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </div>
        </div>

        {/* Editor body */}
        <div className={styles.body}>
          {!activeEntityId ? (
            <div className={styles.welcome}>
              <Feather size={40} weight="thin" color="var(--text-tertiary)" />
              <p className={styles.welcomeTitle}>Select a file to start writing</p>
              <p className={styles.welcomeSub}>
                Choose an entity from the list, or create a new one.
              </p>
            </div>
          ) : (
            <div className={styles.editorContent}>
              {editorView === 'rich' ? (
                <div className={styles.richEditor}>
                  {/* TipTap editor mounts here in Phase 3 */}
                  <div className={styles.editorPlaceholder}>
                    <p className={styles.placeholderText}>TipTap editor — coming in Phase 3</p>
                  </div>
                </div>
              ) : (
                <div className={styles.rawEditor}>
                  <textarea
                    className={styles.rawTextarea}
                    defaultValue={`---\n__type: Character\ntitle: Aragorn\nspecies: Human (Dúnedain)\nborn: "2931 TA"\nalive: true\n---\n\nAragorn II, son of Arathorn, also known as Strider, is the main protagonist of *The Lord of the Rings*.`}
                    spellCheck={false}
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
