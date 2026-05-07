import matter from 'gray-matter';
import {
  listVaultFiles,
  readTextFile,
  writeTextFile,
  ensureDir,
  fileExists,
  getFileStat,
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

/* ─── Default schema templates ──────────────────────────── */

const DEFAULT_SCHEMAS: Record<string, string> = {
  'Note.md': `---
__type: _schema
name: Note
icon: Note
color: "#8A8A96"
fields: []
---
`,
  'World.md': `---
__type: _schema
name: World
icon: Globe
color: "#4A9EFF"
fields:
  - key: description
    label: Description
    type: textarea
  - key: tags
    label: Tags
    type: tags
---
`,
  'Character.md': `---
__type: _schema
name: Character
icon: User
color: "#7A6DF4"
fields:
  - key: species
    label: Species
    type: text
  - key: born
    label: Born
    type: date
    dateKind: single
    timelineVisible: true
  - key: died
    label: Died
    type: date
    dateKind: single
    timelineVisible: true
  - key: alive
    label: Alive
    type: boolean
  - key: affiliation
    label: Affiliation
    type: text
  - key: tags
    label: Tags
    type: tags
---
`,
  'Chapter.md': `---
__type: _schema
name: Chapter
icon: BookOpen
color: "#4ED898"
fields:
  - key: number
    label: Chapter No.
    type: number
  - key: pov
    label: POV Character
    type: relation
    relatesTo: [Character]
  - key: tags
    label: Tags
    type: tags
---
`,
  'Lore.md': `---
__type: _schema
name: Lore
icon: Scroll
color: "#F0A429"
fields:
  - key: tags
    label: Tags
    type: tags
---
`,
  'Era.md': `---
__type: _schema
name: Era
icon: Timer
color: "#FF5370"
fields:
  - key: start
    label: Start
    type: date
    dateKind: single
    timelineVisible: true
  - key: end
    label: End
    type: date
    dateKind: single
    timelineVisible: true
  - key: tags
    label: Tags
    type: tags
---
`,
  'Location.md': `---
__type: _schema
name: Location
icon: MapPin
color: "#FF9057"
fields:
  - key: region
    label: Region
    type: text
  - key: tags
    label: Tags
    type: tags
---
`,
  'Calendar.md': `---
__type: _schema
name: Calendar
icon: CalendarBlank
color: "#50E3A4"
fields:
  - key: epoch
    label: Epoch Name
    type: text
  - key: months
    label: Months (YAML list)
    type: textarea
  - key: weekdays
    label: Days per Week
    type: number
---
`,
};

/* ─── Vault initialisation ──────────────────────────────── */

/** Creates .schemas/ and .writerkit/ for a vault.
 *  seedDefaults: write default schema files for any that don't exist yet.
 *  Safe to call on existing vaults. */
export async function initVault(vaultPath: string, seedDefaults = false): Promise<void> {
  const schemasDir   = joinPath(vaultPath, '.schemas');
  const writerKitDir = joinPath(vaultPath, '.writerkit');

  await Promise.all([ensureDir(schemasDir), ensureDir(writerKitDir)]);

  if (seedDefaults) {
    await Promise.all(
      Object.entries(DEFAULT_SCHEMAS).map(async ([filename, content]) => {
        const filePath = joinPath(schemasDir, filename);
        const exists = await fileExists(filePath);
        if (!exists) {
          console.log('[vault] seeding schema:', filename);
          await writeTextFile(filePath, content);
        }
      }),
    );
  }
}

/* ─── Entity serialisation ──────────────────────────────── */

export function serialiseEntity(entity: Entity): string {
  const { body, frontmatter } = entity;
  // gray-matter stringify
  return matter.stringify(body, frontmatter as Record<string, unknown>);
}
