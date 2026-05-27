/* ─── Entity & Schema Types ───────────────────────────── */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'date'
  | 'custom-date'
  | 'custom-date-range'
  | 'tags'
  | 'select'
  | 'relation';

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];              // for 'select' fields with mode 'options'
  selectMode?: 'options' | 'entity'; // for 'select' fields
  targetType?: string;             // for 'select' fields with mode 'entity'
  relatesTo?: string[];            // for 'relation' fields — list of schema names
}

export interface SchemaDefinition {
  id: string;
  name: string;
  icon: string;              // Phosphor icon name
  color: string;             // hex color
  fields: FieldDefinition[];
  presetRelations?: PresetRelation[];
  description?: string;
  filePath: string;          // path to the .md schema file
}

export type RelationKind = 'parentOf' | 'childOf' | 'siblingOf' | 'relatedTo';

export interface PresetRelation {
  label: string;       // e.g. "Book"
  kind: RelationKind;  // e.g. "childOf"
  targetType: string;  // locked entity type, e.g. "Book"
}

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

export interface CalendarMonthDef {
  name: string;
  days: number;
}

export interface LeapYearRule {
  interval: number;   // add extra days every N years
  month: number;      // 1-based index of the month that receives extra days
  extraDays: number;  // how many extra days are added
}

export interface EraDef {
  name: string;
  startYear: number;
  endYear: number;    // 0 = open-ended / ongoing
  color?: string;     // hex color for the era band on the timeline
}

/** The vault's canonical calendar, stored in .writerkit/calendar.md */
export interface VaultCalendar {
  name: string;
  months: CalendarMonthDef[];
  leapYear?: LeapYearRule;
  eras: EraDef[];
  negativeLabel?: string; // suffix for negative years, e.g. "BR" → "60 BR". Defaults to "BR".
}

/** A date in a custom calendar: absolute year + month + day. */
export interface CustomDate {
  year: number;   // absolute year, may be negative (before year 1)
  month: number;  // 1-based month index
  day: number;    // 1-based day within the month
}

/** A date range in a custom calendar. end is absent when ongoing. */
export interface CustomDateRange {
  start: CustomDate;
  end?: CustomDate;
  ongoing: boolean;
}
