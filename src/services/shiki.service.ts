import { createHighlighter } from 'shiki';
import type { Highlighter } from 'shiki';

let _highlighter: Highlighter | null = null;
let _initPromise: Promise<Highlighter> | null = null;

// Plain Text kept at top; remainder sorted alphabetically by label
export const BUNDLED_LANGUAGES: { value: string; label: string }[] = [
  { value: 'text',       label: 'Plain Text'  },
  { value: 'bash',       label: 'Bash'        },
  { value: 'c',          label: 'C'           },
  { value: 'cpp',        label: 'C++'         },
  { value: 'csharp',     label: 'C#'          },
  { value: 'css',        label: 'CSS'         },
  { value: 'diff',       label: 'Diff'        },
  { value: 'gdresource', label: 'GDResource'  },
  { value: 'gdscript',   label: 'GDScript'    },
  { value: 'gdshader',   label: 'GDShader'    },
  { value: 'glsl',       label: 'GLSL'        },
  { value: 'go',         label: 'Go'          },
  { value: 'html',       label: 'HTML'        },
  { value: 'java',       label: 'Java'        },
  { value: 'javascript', label: 'JavaScript'  },
  { value: 'json',       label: 'JSON'        },
  { value: 'markdown',   label: 'Markdown'    },
  { value: 'php',        label: 'PHP'         },
  { value: 'python',     label: 'Python'      },
  { value: 'regex',      label: 'Regex'       },
  { value: 'ruby',       label: 'Ruby'        },
  { value: 'rust',       label: 'Rust'        },
  { value: 'scss',       label: 'SCSS'        },
  { value: 'sql',        label: 'SQL'         },
  { value: 'toml',       label: 'TOML'        },
  { value: 'tsx',        label: 'TSX'         },
  { value: 'typescript', label: 'TypeScript'  },
  { value: 'xml',        label: 'XML'         },
  { value: 'yaml',       label: 'YAML'        },
];

const SHIKI_LANG_IDS = BUNDLED_LANGUAGES
  .filter((l) => l.value !== 'text')
  .map((l) => l.value);

function getHighlighter(): Promise<Highlighter> {
  if (_highlighter) return Promise.resolve(_highlighter);
  if (_initPromise) return _initPromise;

  _initPromise = createHighlighter({
    themes: ['synthwave-84'],
    langs: SHIKI_LANG_IDS,
  }).then((h) => {
    _highlighter = h;
    return h;
  });

  return _initPromise;
}

/** Pre-warm Shiki — call this when the vault opens so the first code block is instant. */
export function preloadShiki(): void {
  getHighlighter().catch(() => {});
}

export async function highlightCode(code: string, lang: string): Promise<string> {
  const escapedPlain = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  if (lang === 'text' || !SHIKI_LANG_IDS.includes(lang)) {
    return `<pre class="shiki synthwave-84" style="background-color:#2a2139;color:#f92aad"><code>${escapedPlain}</code></pre>`;
  }

  const h = await getHighlighter();
  try {
    return h.codeToHtml(code, { lang, theme: 'synthwave-84' });
  } catch {
    return `<pre class="shiki synthwave-84" style="background-color:#2a2139;color:#f92aad"><code>${escapedPlain}</code></pre>`;
  }
}
