import { Node, mergeAttributes, nodeInputRule } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import type { SuggestionOptions } from '@tiptap/suggestion';

export type WikiLinkOptions = {
  suggestion: Omit<SuggestionOptions, 'editor'>;
};

export const WikiLink = Node.create<WikiLinkOptions>({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return {
      suggestion: {
        char: '[[',
        allowSpaces: false,
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContentAt(range.from, {
              type: 'wikiLink',
              attrs: { title: props.title, id: props.id ?? null },
            })
            .run();
        },
        allow: ({ editor, range }) => {
          return editor.can().insertContentAt(range.from, {
            type: 'wikiLink',
            attrs: { title: '' },
          });
        },
      },
    };
  },

  addAttributes() {
    return {
      title: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-wiki-link'),
        renderHTML: (attrs) => ({ 'data-wiki-link': attrs.title }),
      },
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-wiki-id') ?? null,
        renderHTML: (attrs) =>
          attrs.id ? { 'data-wiki-id': attrs.id } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-wiki-link]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes({ class: 'wiki-link' }, HTMLAttributes),
      `[[${node.attrs.title}]]`,
    ];
  },

  renderText({ node }) {
    return `[[${node.attrs.title}]]`;
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /\[\[([^\]]+)\]\]$/,
        type: this.type,
        getAttributes: (match) => ({ title: match[1], id: null }),
      }),
    ];
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },

  // tiptap-markdown serializer
  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (text: string) => void },
          node: { attrs: { title: string } },
        ) {
          state.write(`[[${node.attrs.title}]]`);
        },
      },
    };
  },
});
