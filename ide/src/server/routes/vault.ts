import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

interface Snippet { id: string; title: string; language: string; content: string; tags: string; created_at: string; }

const DATA_DIR = path.resolve(process.cwd(), '.vibeserve');
const SNIPPETS_FILE = path.join(DATA_DIR, 'vault_snippets.json');

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadSnippets(): Snippet[] {
  ensureDir();
  if (!existsSync(SNIPPETS_FILE)) return [];
  try { return JSON.parse(readFileSync(SNIPPETS_FILE, 'utf-8')); }
  catch { return []; }
}

function saveSnippets(items: Snippet[]) {
  ensureDir();
  writeFileSync(SNIPPETS_FILE, JSON.stringify(items, null, 2), 'utf-8');
}

let snippets: Snippet[] = loadSnippets();

export function registerVaultRoutes(app: any) {
  app.get('/api/vault/snippets', (c: any) => c.json(snippets));

  app.post('/api/vault/snippets', async (c: any) => {
    const { title, language, content, tags } = await c.req.json();
    snippets.unshift({
      id: `snip_${Date.now()}`,
      title, language, content, tags,
      created_at: new Date().toISOString(),
    });
    if (snippets.length > 100) snippets.splice(100);
    saveSnippets(snippets);
    return c.json({ ok: true });
  });

  app.delete('/api/vault/snippets/:id', (c: any) => {
    snippets = snippets.filter(s => s.id !== c.req.param('id'));
    saveSnippets(snippets);
    return c.json({ ok: true });
  });

  app.post('/api/vault/secrets', async (c: any) => {
    const { key } = await c.req.json();
    try {
      const { secretsManager } = await import('../secretsManager');
      await secretsManager.set('system', key as any, (await c.req.json()).value);
      return c.json({ ok: true });
    } catch {
      return c.json({ error: 'Secrets storage unavailable' }, 503);
    }
  });
}
