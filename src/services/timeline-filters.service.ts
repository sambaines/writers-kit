import { readTextFile, writeTextFile, fileExists } from './fs.service';

export interface TimelineFilters {
  hiddenTypes: string[];
  hiddenEntities: string[];
}

const FILTERS_PATH = '.writerkit/timeline-filters.json';

function joinPath(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/');
}

export async function loadTimelineFilters(vaultPath: string): Promise<TimelineFilters> {
  const path = joinPath(vaultPath, FILTERS_PATH);
  if (!(await fileExists(path))) return { hiddenTypes: [], hiddenEntities: [] };
  try {
    const content = await readTextFile(path);
    const data = JSON.parse(content);
    return {
      hiddenTypes:    Array.isArray(data.hiddenTypes)    ? data.hiddenTypes    : [],
      hiddenEntities: Array.isArray(data.hiddenEntities) ? data.hiddenEntities : [],
    };
  } catch {
    return { hiddenTypes: [], hiddenEntities: [] };
  }
}

export async function saveTimelineFilters(vaultPath: string, filters: TimelineFilters): Promise<void> {
  const path = joinPath(vaultPath, FILTERS_PATH);
  await writeTextFile(path, JSON.stringify(filters, null, 2));
}
