import { promises as fs } from 'fs';
import path from 'path';

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd();

export function registerLaunchRoutes(app: any) {
  app.get('/api/launch', async (c: any) => {
    try {
      const configPath = path.join(WORKSPACE_ROOT, '.vibeserve', 'launch.json');
      const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      return c.json(config);
    } catch {
      return c.json({ version: '0.2.0', configurations: [] });
    }
  });

  app.post('/api/launch', async (c: any) => {
    const config = await c.req.json();
    const dir = path.join(WORKSPACE_ROOT, '.vibeserve');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'launch.json'), JSON.stringify(config, null, 2));
    return c.json({ ok: true });
  });
}
