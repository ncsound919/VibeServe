import { promises as fs } from 'fs';
import path from 'path';
import Fuse from 'fuse.js';

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd();

const textExts = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.css', '.html', '.py',
  '.rb', '.go', '.rs', '.yaml', '.yml', '.toml', '.env', '.gitignore', '.c', '.h',
  '.cpp', '.java', '.kt', '.swift', '.sql', '.graphql',
]);

export function registerSearchRoutes(app: any) {
  app.get('/api/search/files', async (c: any) => {
    const q = (c.req.query('q') as string || '').toLowerCase();
    if (!q) return c.json([]);

    const files = await walkDir(WORKSPACE_ROOT);
    const fuse = new Fuse(files, { keys: ['name', 'path'], threshold: 0.4 });
    const results = fuse.search(q).slice(0, 20).map(r => r.item);
    return c.json(results);
  });

  app.get('/api/search/content', async (c: any) => {
    const q = (c.req.query('q') as string || '').toLowerCase();
    if (!q) return c.json([]);

    const results: { file: string; line: number; column: number; content: string }[] = [];
    const files = await walkDir(WORKSPACE_ROOT);
    const textFiles = files.filter(f => textExts.has(path.extname(f.path)));

    for (const file of textFiles.slice(0, 100)) {
      try {
        const content = await fs.readFile(path.resolve(WORKSPACE_ROOT, file.path), 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const col = lines[i].toLowerCase().indexOf(q);
          if (col !== -1) {
            results.push({
              file: file.path,
              line: i + 1,
              column: col + 1,
              content: lines[i].slice(Math.max(0, col - 20), col + q.length + 30),
            });
          }
        }
      } catch {}
    }
    return c.json(results.slice(0, 50));
  });
}

async function walkDir(
  dir: string,
  base: string = ''
): Promise<{ name: string; path: string; type: string }[]> {
  const results: { name: string; path: string; type: string }[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.git') continue;
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
      const relPath = base ? `${base}/${e.name}` : e.name;
      if (e.isDirectory()) {
        results.push({ name: e.name, path: relPath, type: 'directory' });
        const children = await walkDir(path.join(dir, e.name), relPath);
        results.push(...children);
      } else {
        results.push({ name: e.name, path: relPath, type: 'file' });
      }
    }
  } catch {}
  return results;
}
