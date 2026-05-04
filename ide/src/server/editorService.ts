import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import * as path from 'path';

const ROOT = path.resolve(process.cwd(), 'generated-apps');

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: FileNode[];
}

/** Guard: ensure a resolved path stays within ROOT and resolve symlinks */
function isUnderRoot(resolvedPath: string): boolean {
  try {
    const realPath = existsSync(resolvedPath) ? path.realpathSync(resolvedPath) : resolvedPath;
    return realPath.startsWith(ROOT + path.sep) || realPath === ROOT;
  } catch {
    return false;
  }
}

/** Check if the current user owns the application */
export function verifyAppOwnership(appId: string, userId: string): boolean {
  const metaPath = path.resolve(ROOT, appId, '.nexus_meta.json');
  if (!existsSync(metaPath)) {
    // Legacy support: if no meta, assume public or admin-only
    return false;
  }
  try {
    const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
    return meta.owner === userId;
  } catch {
    return false;
  }
}

/** Initialize app metadata */
export function initAppMetadata(appId: string, userId: string): void {
  const metaPath = path.resolve(ROOT, appId, '.nexus_meta.json');
  const meta = {
    appId,
    owner: userId,
    createdAt: new Date().toISOString()
  };
  writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
}

/**
 * List the file tree for a generated app.
 * @param appId - subdirectory name under ROOT (e.g. "gen-123-abc")
 * @returns FileNode[] tree or null if not found / out-of-bounds
 */
export function listAppFiles(appId: string, userId?: string): FileNode[] | null {
  const abs = path.resolve(ROOT, appId);
  if (!isUnderRoot(abs) || !existsSync(abs)) return null;
  if (userId && !verifyAppOwnership(appId, userId)) return null;
  return walkDir(abs, appId);
}

/** Walk a directory and build a FileNode tree */
function walkDir(dir: string, baseAppId: string): FileNode[] {
  return readdirSync(dir).map((entry) => {
    const full = path.join(dir, entry);
    const rel = `${baseAppId}/${entry}`;
    const st = statSync(full);
    if (st.isDirectory()) {
      return { name: entry, path: rel, type: 'dir' as const, children: walkDir(full, rel) };
    }
    return { name: entry, path: rel, type: 'file' as const };
  });
}

/**
 * Read a file from a generated app by its relative path from ROOT.
 * @param fileRelativePath - e.g. "gen-123/src/App.tsx"
 * @returns file content or null
 */
export function readAppFile(fileRelativePath: string, userId?: string): string | null {
  const abs = path.resolve(ROOT, fileRelativePath);
  if (!isUnderRoot(abs) || !existsSync(abs)) return null;
  
  const appId = fileRelativePath.split(/[/\\]/)[0];
  if (userId && !verifyAppOwnership(appId, userId)) return null;

  return readFileSync(abs, 'utf-8');
}

/**
 * Write content to a file in a generated app.
 * @param fileRelativePath - e.g. "gen-123/src/App.tsx"
 * @param content - file content
 * @param maxBytes - optional write cap (default 5 MB)
 */
export function writeAppFile(
  fileRelativePath: string,
  content: string,
  userId?: string,
  maxBytes = 5 * 1024 * 1024
): void {
  if (content.length > maxBytes) {
    throw new Error(`Content exceeds ${maxBytes} byte limit`);
  }
  const abs = path.resolve(ROOT, fileRelativePath);
  if (!isUnderRoot(abs)) throw new Error('Path traversal rejected');

  const appId = fileRelativePath.split(/[/\\]/)[0];
  if (userId && !verifyAppOwnership(appId, userId)) {
    throw new Error('Access denied: Unauthorized write operation');
  }

  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf-8');
}

/**
 * List all generated app IDs and their metadata (no deep scan).
 * @returns array of { id, path, createdAt }
 */
export function listGeneratedApps(userId?: string): Array<{ id: string; path: string; createdAt: string }> {
  if (!existsSync(ROOT)) return [];
  return readdirSync(ROOT)
    .filter((entry) => {
      const full = path.join(ROOT, entry);
      const isDir = statSync(full).isDirectory() && entry.startsWith('gen-');
      if (!isDir) return false;
      if (userId && !verifyAppOwnership(entry, userId)) return false;
      return true;
    })
    .map((entry) => {
      const full = path.join(ROOT, entry);
      const { mtime } = statSync(full);
      return { id: entry, path: full, createdAt: mtime.toISOString() };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}
