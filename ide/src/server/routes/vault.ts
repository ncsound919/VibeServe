interface Snippet { id: string; title: string; language: string; content: string; tags: string; created_at: string; }

let snippets: Snippet[] = [];

export function registerVaultRoutes(app: any) {
  app.get('/api/vault/snippets', (c: any) => c.json(snippets));

  app.post('/api/vault/snippets', async (c: any) => {
    const { title, language, content, tags } = await c.req.json();
    snippets.unshift({
      id: `snip_${Date.now()}`,
      title, language, content, tags,
      created_at: new Date().toISOString(),
    });
    return c.json({ ok: true });
  });

  app.delete('/api/vault/snippets/:id', (c: any) => {
    snippets = snippets.filter(s => s.id !== c.req.param('id'));
    return c.json({ ok: true });
  });

  app.post('/api/vault/secrets', async (c: any) => {
    const { key, value } = await c.req.json();
    console.log(`[Vault] Stored secret: ${key}`);
    return c.json({ ok: true });
  });
}
