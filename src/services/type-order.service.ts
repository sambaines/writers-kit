import { readTextFile, writeTextFile, fileExists } from './fs.service';

const TYPE_ORDER_PATH = '.writerkit/type-order.json';

function joinPath(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/');
}

export async function loadTypeOrder(vaultPath: string): Promise<string[]> {
  const path = joinPath(vaultPath, TYPE_ORDER_PATH);
  if (!(await fileExists(path))) return [];
  try {
    const content = await readTextFile(path);
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function saveTypeOrder(vaultPath: string, order: string[]): Promise<void> {
  const path = joinPath(vaultPath, TYPE_ORDER_PATH);
  await writeTextFile(path, JSON.stringify(order, null, 2));
}
