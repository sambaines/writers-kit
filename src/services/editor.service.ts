import matter from 'gray-matter';
import { writeTextFile } from './fs.service';
import { useVaultStore } from '../store/vault.store';
import { useUIStore } from '../store/ui.store';
import type { Entity, EntityFrontmatter } from '../types';

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

let _rawSaveTimer: ReturnType<typeof setTimeout> | null = null;

/** Schedule a debounced save for raw (full-file) content. */
export function scheduleRawSave(entity: Entity, rawContent: string): void {
  if (_rawSaveTimer) clearTimeout(_rawSaveTimer);
  useUIStore.getState().setSaveStatus('unsaved');
  _rawSaveTimer = setTimeout(() => saveRawContent(entity, rawContent), 1000);
}

/** Save a full file string (frontmatter + body) as typed in raw mode. */
export async function saveRawContent(entity: Entity, rawContent: string): Promise<void> {
  if (_rawSaveTimer) { clearTimeout(_rawSaveTimer); _rawSaveTimer = null; }
  const { vaultPath, updateEntity } = useVaultStore.getState();
  if (!vaultPath) return;

  useUIStore.getState().setSaveStatus('saving');
  try {
    const fullPath = `${vaultPath}/${entity.path}`;
    await writeTextFile(fullPath, rawContent);

    // Re-parse so the store reflects any frontmatter edits the user made
    const { data: fm, content: body } = matter(rawContent);
    const trimmedBody = body.replace(/^\n/, ''); // gray-matter leaves a leading newline
    const words = trimmedBody.trim().split(/\s+/).filter(Boolean).length;
    const updated: Entity = {
      ...entity,
      title:      (fm.title      as string)  ?? entity.title,
      type:       (fm.__type     as string)  ?? entity.type,
      archived:   (fm.__archived as boolean) ?? entity.archived,
      frontmatter: fm as EntityFrontmatter,
      body:       trimmedBody,
      wordCount:  words,
      charCount:  trimmedBody.length,
      modifiedAt: new Date().toISOString(),
    };
    updateEntity(updated);
    useUIStore.getState().setSaveStatus('saved');
  } catch (err) {
    console.error('[editor] raw save failed:', err);
    useUIStore.getState().setSaveStatus('error');
  }
}

/** Build the full file string (frontmatter YAML + body) for display in raw mode. */
export function buildRawContent(entity: Entity, currentBody: string): string {
  return matter.stringify(currentBody, entity.frontmatter as Record<string, unknown>);
}

/** Preprocess markdown body so existing [[WikiLinks]] become parseable HTML spans. */
export function preprocessMarkdownForWikiLinks(markdown: string): string {
  return markdown.replace(/\[\[([^\]]+)\]\]/g, (_, title: string) =>
    `<span data-wiki-link="${title.replace(/"/g, '&quot;')}">[[${title}]]</span>`,
  );
}
