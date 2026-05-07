import { createHighlighter } from 'shiki';
import type { Highlighter } from 'shiki';

let _highlighter: Highlighter | null = null;
let _initPromise: Promise<Highlighter> | null = null;

export const BUNDLED_LANGUAGES: { value: string; label: string }[] = [
  { value: 'text',       label: 'Plain Text'  },
  { value: 'bash',       label: 'Bash'        },
  { value: 'javascript', label: 'JavaScript'  },
  { value: 'typescript', label: 'TypeScript'  },
  { value: 'tsx',        label: 'TSX'         },
  { value: 'html',       label: 'HTML'        },
  { value: 'css',        label: 'CSS'         },
  { value: 'scss',       label: 'SCSS'        },
  { value: 'json',       label: 'JSON'        },
  { value: 'yaml',       label: 'YAML'        },
  { value: 'toml',       label: 'TOML'        },
  { value: 'markdown',   label: 'Markdown'    },
  { value: 'python',     label: 'Python'      },
  { value: 'rust',       label: 'Rust'        },
  { value: 'go',         label: 'Go'          },
  { value: 'java',       label: 'Java'        },
  { value: 'c',          label: 'C'           },
  { value: 'cpp',        label: 'C++'         },
  { value: 'csharp',     label: 'C#'          },
  { value: 'ruby',       label: 'Ruby'        },
  { value: 'php',        label: 'PHP'         },
  { value: 'sql',        label: 'SQL'         },
  { value: 'xml',        label: 'XML'         },
  { value: 'diff',       label: 'Diff'        },
  { value: 'regex',      label: 'Regex'       },
  { value: 'glsl',       label: 'GLSL'        },
  { value: 'gdscript',   label: 'GDScript'    },
];

const SHIKI_LANG_IDS = BUNDLED_LANGUAGES
  .filter((l) => l.value !== 'text')
  .map((l) => l.value);

function getHighlighter(): Promise<Highlighter> {
  if (_highlighter) return Promise.resolve(_highlighter);
  if (_initPromise) return _initPromise;

  _initPromise = createHighlighter({
    themes: ['vitesse-dark'],
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
    return `<pre class="shiki vitesse-dark" style="background-color:#121212;color:#dbd7ca"><code>${escapedPlain}</code></pre>`;
  }

  const h = await getHighlighter();
  try {
    return h.codeToHtml(code, { lang, theme: 'vitesse-dark' });
  } catch {
    return `<pre class="shiki vitesse-dark" style="background-color:#121212;color:#dbd7ca"><code>${escapedPlain}</code></pre>`;
  }
}
