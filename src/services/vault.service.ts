import matter from 'gray-matter';
import {
  listVaultFiles,
  readTextFile,
  writeTextFile,
  ensureDir,
  fileExists,
  getFileStat,
  deleteFile,
} from './fs.service';
import type { Entity, SchemaDefinition, FieldDefinition, EntityFrontmatter } from '../types';

/* ─── Helpers ───────────────────────────────────────────── */

function joinPath(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/');
}

function basename(path: string, ext?: string): string {
  const name = path.split('/').pop() ?? path;
  if (ext && name.endsWith(ext)) return name.slice(0, -ext.length);
  return name;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function formatTimestamp(secs: number | null | undefined): string {
  if (!secs) return new Date().toISOString();
  return new Date(secs * 1000).toISOString();
}

/* ─── Schema parsing ────────────────────────────────────── */

function parseSchema(
  relativePath: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fm: Record<string, any>,
): SchemaDefinition {
  const id = basename(relativePath, '.md');
  return {
    id,
    name: fm.name ?? id,
    icon: fm.icon ?? 'File',
    color: fm.color ?? '#8A8A96',
    fields: (fm.fields ?? []) as FieldDefinition[],
    description: fm.description,
    filePath: relativePath,
  };
}

/* ─── Entity parsing ────────────────────────────────────── */

function parseEntity(
  _vaultPath: string,
  relativePath: string,
  content: string,
  stat: { size: number; modified: number | null; created: number | null },
): Entity {
  const { data: fm, content: body } = matter(content);
  const id = basename(relativePath, '.md');
  const wordCount = countWords(body);

  return {
    id,
    path: relativePath,
    title: (fm.title as string) ?? id,
    type: (fm.__type as string) ?? 'note',
    icon: fm.__icon as string | undefined,
    color: fm.__color as string | undefined,
    archived: (fm.__archived as boolean) ?? false,
    wordCount,
    charCount: body.length,
    fileSize: stat.size,
    createdAt: formatTimestamp(stat.created),
    modifiedAt: formatTimestamp(stat.modified),
    frontmatter: fm as EntityFrontmatter,
    body,
  };
}

/* ─── Vault scanning ────────────────────────────────────── */

export interface VaultScanResult {
  schemas: SchemaDefinition[];
  entities: Entity[];
}

export async function scanVault(vaultPath: string): Promise<VaultScanResult> {
  const relativePaths = await listVaultFiles(vaultPath);
  console.log('[vault] files found:', relativePaths);

  const schemas: SchemaDefinition[] = [];
  const entities: Entity[] = [];

  await Promise.all(
    relativePaths.map(async (relativePath) => {
      // Normalise separator — Rust may return backslashes on Windows
      const normPath = relativePath.replace(/\\/g, '/');
      const fullPath = joinPath(vaultPath, normPath);
      try {
        const content = await readTextFile(fullPath);
        const stat = await getFileStat(fullPath);
        const { data: fm } = matter(content);

        const isSchema =
          normPath.startsWith('.schemas/') || fm.__type === '_schema';

        if (isSchema) {
          console.log('[vault] schema:', normPath);
          schemas.push(parseSchema(normPath, fm));
        } else {
          entities.push(parseEntity(vaultPath, normPath, content, stat));
        }
      } catch (err) {
        console.error(`[vault] failed to parse ${relativePath}:`, err);
      }
    }),
  );

  console.log(`[vault] loaded ${schemas.length} schemas, ${entities.length} entities`);
  return { schemas, entities };
}

/* ─── Vault initialisation ──────────────────────────────── */

/** Creates .schemas/ and .writerkit/ for a vault. Safe to call on existing vaults. */
export async function initVault(vaultPath: string): Promise<void> {
  const schemasDir   = joinPath(vaultPath, '.schemas');
  const writerKitDir = joinPath(vaultPath, '.writerkit');

  await Promise.all([ensureDir(schemasDir), ensureDir(writerKitDir)]);

  // Ensure binary files are gitignored but .md files (e.g. calendar.md) are tracked
  const writerKitGitignore = joinPath(writerKitDir, '.gitignore');
  if (!(await fileExists(writerKitGitignore))) {
    await writeTextFile(writerKitGitignore, '*.db\n*.sqlite\n*.sqlite3\n');
  }
}

/* ─── Entity serialisation ──────────────────────────────── */

export function serialiseEntity(entity: Entity): string {
  const { body, frontmatter } = entity;
  return matter.stringify(body, frontmatter as Record<string, unknown>);
}

/* ─── Schema CRUD ───────────────────────────────────────── */

export async function saveSchema(
  vaultPath: string,
  schema: SchemaDefinition,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fm: Record<string, any> = {
    __type: '_schema',
    name: schema.name,
    icon: schema.icon,
    color: schema.color,
  };
  if (schema.description) fm.description = schema.description;
  if (schema.fields.length > 0) fm.fields = schema.fields;
  const content = matter.stringify('', fm);
  await writeTextFile(joinPath(vaultPath, schema.filePath), content);
}

export async function createSchemaFile(
  vaultPath: string,
  draft: Omit<SchemaDefinition, 'id' | 'filePath'>,
): Promise<SchemaDefinition> {
  const filename = `${draft.name}.md`;
  const filePath = `.schemas/${filename}`;
  const schema: SchemaDefinition = { ...draft, id: draft.name, filePath };
  await saveSchema(vaultPath, schema);
  return schema;
}

export async function deleteSchemaFile(
  vaultPath: string,
  schema: SchemaDefinition,
): Promise<void> {
  await deleteFile(joinPath(vaultPath, schema.filePath));
}

export async function deleteEntityFile(vaultPath: string, entity: Entity): Promise<void> {
  await deleteFile(joinPath(vaultPath, entity.path));
}

/* ─── Entity CRUD ───────────────────────────────────────── */

export async function createEntityFile(
  vaultPath: string,
  type: string,
  title: string,
): Promise<Entity> {
  const now  = new Date().toISOString();
  const slug = `${type.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
  const path = `${slug}.md`;

  const frontmatter: EntityFrontmatter = {
    __type:     type,
    title,
    __created:  now,
    __modified: now,
    __archived: false,
    _parentOf:  [],
    _childOf:   [],
    _siblingOf: [],
    _relatedTo: [],
  };

  const content = matter.stringify('', frontmatter as Record<string, unknown>);
  const fullPath = joinPath(vaultPath, path);
  await writeTextFile(fullPath, content);

  return {
    id:         slug,
    path,
    title,
    type,
    archived:   false,
    wordCount:  0,
    charCount:  0,
    fileSize:   content.length,
    createdAt:  now,
    modifiedAt: now,
    frontmatter,
    body:       '',
  };
}

export async function updateEntityFrontmatter(
  vaultPath: string,
  entity: Entity,
  updates: Partial<EntityFrontmatter>,
): Promise<Entity> {
  const now = new Date().toISOString();
  const merged = { ...entity.frontmatter, ...updates, __modified: now };
  // Filter out undefined values so callers can delete a frontmatter key by
  // passing { key: undefined } — without this, the key lingers in memory even
  // if js-yaml eventually skips it during serialisation.
  const updatedFm = Object.fromEntries(
    Object.entries(merged).filter(([, v]) => v !== undefined),
  ) as EntityFrontmatter;
  const content = matter.stringify(entity.body, updatedFm as Record<string, unknown>);
  await writeTextFile(joinPath(vaultPath, entity.path), content);
  return {
    ...entity,
    frontmatter: updatedFm,
    modifiedAt:  now,
    title: (updatedFm.title as string) ?? entity.title,
    type:  (updatedFm.__type as string) ?? entity.type,
    archived: (updatedFm.__archived as boolean) ?? entity.archived,
  };
}
