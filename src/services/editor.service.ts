import matter from 'gray-matter';
import { writeTextFile } from './fs.service';
import { useVaultStore } from '../store/vault.store';
import { useUIStore } from '../store/ui.store';
import { annotateRelationsInYaml } from './vault.service';
import type { Entity, EntityFrontmatter } from '../types';

function buildTitleMap(): Map<string, string> {
  return new Map(useVaultStore.getState().entities.map((e) => [e.id, e.title]));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function customRelationKeys(fm: Record<string, any>): Set<string> {
  return new Set<string>(
    (Array.isArray(fm.__customFields) ? fm.__customFields : [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((f: any) => f?.type === 'relation')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((f: any) => f?.key as string)
      .filter(Boolean),
  );
}

function annotated(yaml: string, fm: Record<string, unknown>): string {
  return annotateRelationsInYaml(yaml, buildTitleMap(), customRelationKeys(fm));
}

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
    // Merge WikiLink-derived targets into _relatedTo before writing
    const wikiTargetIds = resolveWikiLinks(newBody, entity.id);
    const existingRelatedTo = (entity.frontmatter._relatedTo as string[] | undefined) ?? [];
    const mergedRelatedTo = unique([...existingRelatedTo, ...wikiTargetIds]);

    const updatedFm = {
      ...entity.frontmatter,
      title: newTitle,
      __modified: new Date().toISOString(),
      _relatedTo: mergedRelatedTo,
    };

    const content = annotated(matter.stringify(newBody, updatedFm as Record<string, unknown>), updatedFm);
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

    // Bidirectionally link any newly discovered WikiLink targets (fire-and-forget)
    const newTargetIds = wikiTargetIds.filter((id) => !existingRelatedTo.includes(id));
    if (newTargetIds.length > 0) {
      void addBidirectionalWikiLinks(entity.id, newTargetIds, vaultPath);
    }
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
    // Re-parse to get frontmatter + body so we can merge WikiLinks
    const { data: fm, content: body } = matter(rawContent);
    const trimmedBody = body.replace(/^\n/, '');

    const wikiTargetIds = resolveWikiLinks(trimmedBody, entity.id);
    const existingRelatedTo = (fm._relatedTo as string[] | undefined) ?? [];
    const mergedRelatedTo = unique([...existingRelatedTo, ...wikiTargetIds]);
    fm._relatedTo = mergedRelatedTo;

    // Re-stringify with merged relatedTo and write
    const mergedContent = annotated(matter.stringify(trimmedBody, fm as Record<string, unknown>), fm);
    const fullPath = `${vaultPath}/${entity.path}`;
    await writeTextFile(fullPath, mergedContent);

    const words = trimmedBody.trim().split(/\s+/).filter(Boolean).length;
    const updated: Entity = {
      ...entity,
      title:       (fm.title      as string)  ?? entity.title,
      type:        (fm.__type     as string)  ?? entity.type,
      archived:    (fm.__archived as boolean) ?? entity.archived,
      frontmatter: fm as EntityFrontmatter,
      body:        trimmedBody,
      wordCount:   words,
      charCount:   trimmedBody.length,
      modifiedAt:  new Date().toISOString(),
    };
    updateEntity(updated);
    useUIStore.getState().setSaveStatus('saved');

    const newTargetIds = wikiTargetIds.filter((id) => !existingRelatedTo.includes(id));
    if (newTargetIds.length > 0) {
      void addBidirectionalWikiLinks(entity.id, newTargetIds, vaultPath);
    }
  } catch (err) {
    console.error('[editor] raw save failed:', err);
    useUIStore.getState().setSaveStatus('error');
  }
}

/** Build the full file string (frontmatter YAML + body) for display in raw mode. */
export function buildRawContent(entity: Entity, currentBody: string): string {
  const fm = entity.frontmatter as Record<string, unknown>;
  return annotated(matter.stringify(currentBody, fm), fm);
}

/**
 * Preprocess markdown body so [[WikiLinks]] become parseable HTML spans that
 * TipTap can parse into WikiLink nodes.
 * Handles both [[Title]] (legacy) and [[Title|id]] (stable) formats.
 * For legacy links, resolves the title to an entity ID so the next save
 * upgrades them to the stable format.
 * Note: title display healing is handled live by the WikiLinkView NodeView,
 * so we only need to pass through the correct attributes here.
 */
export function preprocessMarkdownForWikiLinks(markdown: string, entities: Entity[] = []): string {
  const esc = (s: string) => s.replace(/"/g, '&quot;');
  return markdown.replace(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g, (_, rawTitle: string, rawId: string | undefined) => {
    const title = rawTitle.trim();
    // Use embedded ID if present, otherwise try to resolve by title
    const id = rawId?.trim() ?? entities.find((e) => e.title === title)?.id ?? null;
    const idAttr = id ? ` data-wiki-id="${esc(id)}"` : '';
    return `<span data-wiki-link="${esc(title)}"${idAttr}>[[${title}]]</span>`;
  });
}

/* ─── WikiLink relation sync helpers ────────────────────── */

/** Extract entity IDs referenced by [[Title]] or [[Title|id]] links in a body string. */
function resolveWikiLinks(body: string, sourceId: string): string[] {
  const { entities } = useVaultStore.getState();
  const matches = [...body.matchAll(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g)];
  return unique(
    matches
      .map(([, title, id]) => {
        const trimId = id?.trim();
        const trimTitle = title.trim();
        // Prefer ID lookup (stable across renames), fall back to title
        const entity = trimId
          ? entities.find((e) => e.id === trimId && e.id !== sourceId)
          : entities.find((e) => e.title === trimTitle && e.id !== sourceId);
        return entity?.id ?? null;
      })
      .filter((id): id is string => id !== null),
  );
}

/**
 * After saving the source entity, update each target entity's _relatedTo to
 * include the source. Runs asynchronously so it doesn't block the editor.
 */
async function addBidirectionalWikiLinks(
  sourceId: string,
  newTargetIds: string[],
  vaultPath: string,
): Promise<void> {
  const { entities, updateEntity } = useVaultStore.getState();
  for (const targetId of newTargetIds) {
    const target = entities.find((e) => e.id === targetId);
    if (!target) continue;
    const existing = (target.frontmatter._relatedTo as string[] | undefined) ?? [];
    if (existing.includes(sourceId)) continue;
    const merged = unique([...existing, sourceId]);
    const updatedFm = {
      ...target.frontmatter,
      _relatedTo: merged,
      __modified: new Date().toISOString(),
    };
    try {
      const content = annotated(matter.stringify(target.body, updatedFm as Record<string, unknown>), updatedFm);
      await writeTextFile(`${vaultPath}/${target.path}`, content);
      updateEntity({ ...target, frontmatter: updatedFm as EntityFrontmatter, modifiedAt: updatedFm.__modified });
    } catch (err) {
      console.error(`[editor] wikilink backlink failed for ${targetId}:`, err);
    }
  }
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
