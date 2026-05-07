import { useEffect, useState, useRef } from 'react';
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import CodeBlock from '@tiptap/extension-code-block';
import * as Select from '@radix-ui/react-select';
import { CaretDown, Check } from '@phosphor-icons/react';
import { highlightCode, BUNDLED_LANGUAGES } from '../services/shiki.service';
import styles from './ShikiCodeBlock.module.css';

// ─── NodeView component ───────────────────────────────────
//
// Strategy: NodeViewContent is always rendered (so TipTap manages the cursor
// and editing normally). Its text is made transparent via CSS so it doesn't
// visually double with the Shiki overlay. The Shiki overlay sits on top
// with pointer-events:none so all clicks/cursor events pass straight through
// to the editable content. Highlighting is always visible while editing.

function ShikiCodeBlockView({ node, updateAttributes }: NodeViewProps) {
  const [highlightedHtml, setHighlightedHtml] = useState('');
  const code = node.textContent;
  const lang = (node.attrs.language as string | null) ?? 'text';
  const labelText = BUNDLED_LANGUAGES.find((l) => l.value === lang)?.label ?? lang;

  // Debounce highlight updates so rapid typing doesn't flood Shiki
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => {
      highlightCode(code, lang).then(setHighlightedHtml);
    }, 120);
    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, [code, lang]);

  return (
    <NodeViewWrapper>
      <div className={styles.codeBlock}>

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
          {/* Shiki overlay — always on top, pointer-events:none so editing works normally */}
          {highlightedHtml && (
            <div
              className={styles.shikiOverlay}
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              aria-hidden="true"
            />
          )}
          {/* TipTap editable content — text is transparent so Shiki colors show through */}
          <div className={styles.codeEditable}>
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
        parseHTML: (el) => {
          // 1. Explicit data attribute (set by renderHTML below)
          const fromAttr = el.getAttribute('data-language');
          if (fromAttr) return fromAttr;
          // 2. Standard markdown-it output: <pre><code class="language-*">
          //    The class lives on the inner <code>, not on <pre>.
          const classSource =
            el.firstElementChild?.className ?? // <code> inside <pre>
            el.className ??
            '';
          return (
            classSource
              .split(' ')
              .find((c) => c.startsWith('language-'))
              ?.replace('language-', '') ?? null
          );
        },
        renderHTML: (attrs) =>
          attrs.language ? { 'data-language': attrs.language } : {},
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ShikiCodeBlockView);
  },
});
