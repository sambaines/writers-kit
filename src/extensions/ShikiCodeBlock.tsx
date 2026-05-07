import { useEffect, useState, useRef } from 'react';
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import CodeBlock from '@tiptap/extension-code-block';
import * as Select from '@radix-ui/react-select';
import { CaretDown, Check } from '@phosphor-icons/react';
import clsx from 'clsx';
import { highlightCode, BUNDLED_LANGUAGES } from '../services/shiki.service';
import styles from './ShikiCodeBlock.module.css';

// ─── NodeView component ───────────────────────────────────

function ShikiCodeBlockView({
  node,
  updateAttributes,
  editor,
  getPos,
  selected,
}: NodeViewProps) {
  const [highlightedHtml, setHighlightedHtml] = useState('');
  const [cursorInside, setCursorInside] = useState(false);
  const code = node.textContent;
  const lang = (node.attrs.language as string | null) ?? 'text';
  const labelText = BUNDLED_LANGUAGES.find((l) => l.value === lang)?.label ?? lang;
  // Used to debounce highlight updates
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track whether the editor cursor is inside this node
  useEffect(() => {
    function check() {
      const pos = getPos();
      if (pos === undefined) { setCursorInside(false); return; }
      const { from, to } = editor.state.selection;
      const nodeEnd = pos + node.nodeSize;
      setCursorInside(from > pos && to <= nodeEnd);
    }

    editor.on('selectionUpdate', check);
    editor.on('focus', check);
    // When editor loses focus entirely, we're no longer "inside"
    const handleBlur = () => setCursorInside(false);
    editor.on('blur', handleBlur);

    return () => {
      editor.off('selectionUpdate', check);
      editor.off('focus', check);
      editor.off('blur', handleBlur);
    };
  }, [editor, getPos, node.nodeSize]);

  // Re-highlight when code or lang changes (debounced 150ms)
  useEffect(() => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => {
      highlightCode(code, lang).then(setHighlightedHtml);
    }, 150);
    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, [code, lang]);

  const isActive = selected || cursorInside;

  function handleOverlayClick() {
    const pos = getPos();
    if (pos === undefined) return;
    editor.chain().focus().setTextSelection(pos + 1).run();
  }

  return (
    <NodeViewWrapper>
      <div className={clsx(styles.codeBlock, isActive && styles.focused)}>
        {/* Header with language selector */}
        <div className={styles.header} contentEditable={false}>
          <Select.Root
            value={lang}
            onValueChange={(val) => updateAttributes({ language: val })}
          >
            <Select.Trigger asChild>
              <button className={styles.langTrigger}>
                <span>{labelText}</span>
                <CaretDown size={9} />
              </button>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className={styles.langContent} position="popper" sideOffset={4}>
                <Select.Viewport className={styles.langViewport}>
                  {BUNDLED_LANGUAGES.map((l) => (
                    <Select.Item key={l.value} value={l.value} className={styles.langItem}>
                      <Select.ItemIndicator className={styles.langItemIndicator}>
                        <Check size={10} />
                      </Select.ItemIndicator>
                      <Select.ItemText>{l.label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

        {/* Code body */}
        <div className={styles.codeBody}>
          {/* Shiki highlighted overlay — visible when not focused */}
          {!isActive && highlightedHtml && (
            <div
              className={styles.shikiOverlay}
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              onClick={handleOverlayClick}
            />
          )}
          {/* TipTap editable content — visible when focused, hidden (but present) when not */}
          <div className={clsx(styles.codeEditable, !isActive && styles.codeHidden)}>
            <NodeViewContent />
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// ─── Extension ───────────────────────────────────────────

export const ShikiCodeBlock = CodeBlock.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      language: {
        default: null,
        parseHTML: (el) =>
          el.getAttribute('data-language') ??
          el.getAttribute('class')
            ?.split(' ')
            .find((c) => c.startsWith('language-'))
            ?.replace('language-', '') ??
          null,
        renderHTML: (attrs) =>
          attrs.language ? { 'data-language': attrs.language } : {},
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ShikiCodeBlockView);
  },
});
