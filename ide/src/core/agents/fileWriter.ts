import { existsSync, mkdirSync, writeFileSync } from 'fs';
import * as path from 'path';
import type { FileSpec } from './types';
export interface WriteResult { success: boolean; filesWritten: number; errors: string[] }
export function writeFiles(files: FileSpec[], appRoot: string, opts: { overwrite?: boolean } = {}): WriteResult {
  const errors: string[] = []; let filesWritten = 0; const root = path.resolve(appRoot);
  for (const file of files) {
    if (file.skip) continue;
    const full = path.resolve(appRoot, file.path);
    if (!full.startsWith(root + path.sep)) { errors.push('Path traversal: ' + file.path); continue; }
    try { mkdirSync(path.dirname(full), { recursive: true }); if (existsSync(full) && !opts.overwrite) { filesWritten++; continue; } writeFileSync(full, file.content, 'utf8'); filesWritten++; } catch (e) { errors.push(String(e)); }
  }
  return { success: errors.length === 0, filesWritten, errors };
}
