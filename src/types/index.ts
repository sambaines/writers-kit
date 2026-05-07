/* ─── Entity & Schema Types ───────────────────────────── */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'date'
  | 'tags'
  | 'select'
  | 'relation';

export type DateKind = 'single' | 'range';

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  dateKind?: DateKind;
  timelineVisible?: boolean;
  options?: string[];        // for 'select' fields
  relatesTo?: string[];      // for 'relation' fields — list of schema names
}

export interface SchemaDefinition {
  id: string;
  name: string;
  icon: string;              // Phosphor icon name
  color: string;             // hex color
  fields: FieldDefinition[];
  description?: string;
  filePath: string;          // path to the .md schema file
}

export type RelationKind = 'parentOf' | 'childOf' | 'siblingOf' | 'relatedTo';

export interface EntityRelation {
  kind: RelationKind;
  targetId: string;          // slug/filename of target entity
  targetTitle?: string;
}

export interface EntityFrontmatter {
  __type: string;
  __created: string;
  __modified: string;
  __archived: boolean;
  __icon?: string;           // per-file icon override
  __color?: string;          // per-file color override
  _parentOf: string[];
  _childOf: string[];
  _siblingOf: string[];
  _relatedTo: string[];
  title?: string;
  [key: string]: unknown;   // user-defined fields
}

export interface Entity {
  id: string;                // slug derived from filename
  path: string;              // relative path from vault root
  title: string;
  type: string;              // __type value
  icon?: string;
  color?: string;
  archived: boolean;
  wordCount: number;
  charCount: number;
  fileSize: number;
  createdAt: string;
  modifiedAt: string;
  frontmatter: EntityFrontmatter;
  body: string;              // raw markdown body (no frontmatter)
}

/* ─── UI Types ─────────────────────────────────────────── */

export type ViewMode = 'editor' | 'timeline';
export type EditorView = 'rich' | 'raw';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  count?: number;
}

/* ─── Vault / Config Types ──────────────────────────────── */

export interface VaultConfig {
  vaultPath: string;
  gitRemote?: string;
  claudeApiKey?: string;
  activeCalendarId?: string;
}

/* ─── Calendar Types ────────────────────────────────────── */

export interface CalendarMonth {
  name: string;
  days: number;
}

export interface CalendarDefinition {
  id: string;
  name: string;
  epoch: string;
  months: CalendarMonth[];
  weekdays: number;
  seasons?: { name: string; months: string[] }[];
}
