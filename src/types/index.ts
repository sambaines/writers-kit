/* ─── Entity & Schema Types ───────────────────────────── */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'date'
  | 'tags'
  | 'select'
  | 'relation'
  | 'months';

export type DateKind = 'single' | 'range' | 'fantasy';

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

/* ─── Chat Types ────────────────────────────────────────── */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/* ─── Git Types ─────────────────────────────────────────── */

export type GitFileStatusKind = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
export type GitRepoStatus = 'no-repo' | 'clean' | 'dirty';

export interface GitFileStatus {
  path: string;
  status: GitFileStatusKind;
}

export interface GitCommit {
  hash: string;
  short_hash: string;
  message: string;
  author: string;
  timestamp: number; // unix seconds
}

/* ─── Calendar Types ────────────────────────────────────── */

export interface CalendarMonth {
  name: string;
  days: number;
}

export interface CalendarDefinition {
  id: string;
  name: string;
  months: CalendarMonth[];
  weekdays: number;
}

/** A date in a fantasy calendar: era entity ID + year/month/day within that era. */
export interface FantasyDate {
  era: string;   // entity ID of the Era entity
  year: number;  // 1-based year within the era
  month: number; // 1-based month index
  day: number;   // 1-based day within the month
}

/** An Era entity with its cumulative absolute start position on the linear axis. */
export interface EraWithOffset {
  id: string;
  title: string;
  order: number;
  duration: number;        // total years in this era (= value of 'end' field)
  cumulativeStart: number; // absolute linear position where this era begins
}
