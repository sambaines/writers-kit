import matter from 'gray-matter';
import { writeTextFile } from './fs.service';
import { useVaultStore } from '../store/vault.store';
import { useUIStore } from '../store/ui.store';
import type { Entity } from '../types';

let _saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Schedule a debounced save (1 second after last change). */
export function scheduleSave(entity: Entity, newTitle: string, newBody: string): void {
  if (_saveTimer) clearTimeout(_saveTimer);
  useUIStore.getState().setSaveStatus('unsaved');
  _saveTimer = setTimeout(() => saveEntity(entity, newTitle, newBody), 1000);
}

/** Cancel any pending scheduled save. */
export function cancelScheduledSave(): void {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
}

/** Immediately flush any pending save. */
export async function flushSave(entity: Entity, newTitle: string, newBody: string): Promise<void> {
  cancelScheduledSave();
  await saveEntity(entity, newTitle, newBody);
}

export async function saveEntity(entity: Entity, newTitle: string, newBody: string): Promise<void> {
  const { vaultPath, updateEntity } = useVaultStore.getState();
  if (!vaultPath) return;

  useUIStore.getState().setSaveStatus('saving');

  try {
    const updatedFm = {
      ...entity.frontmatter,
      title: newTitle,
      __modified: new Date().toISOString(),
    };

    const content = matter.stringify(newBody, updatedFm as Record<string, unknown>);
    const fullPath = `${vaultPath}/${entity.path}`;
    await writeTextFile(fullPath, content);

    const words = newBody.trim().split(/\s+/).filter(Boolean).length;
    const updated: Entity = {
      ...entity,
      title: newTitle,
      body: newBody,
      frontmatter: updatedFm as typeof entity.frontmatter,
      modifiedAt: updatedFm.__modified,
      wordCount: words,
      charCount: newBody.length,
    };
    updateEntity(updated);
    useUIStore.getState().setSaveStatus('saved');
  } catch (err) {
    console.error('[editor] save failed:', err);
    useUIStore.getState().setSaveStatus('error');
  }
}

/** Preprocess markdown body so existing [[WikiLinks]] become parseable HTML spans. */
export function preprocessMarkdownForWikiLinks(markdown: string): string {
  return markdown.replace(/\[\[([^\]]+)\]\]/g, (_, title: string) =>
    `<span data-wiki-link="${title.replace(/"/g, '&quot;')}">[[${title}]]</span>`,
  );
}
