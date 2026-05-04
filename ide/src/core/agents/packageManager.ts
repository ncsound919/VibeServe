import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync } from 'fs';
import * as path from 'path';
const execP = promisify(exec);
export function writePackageJson(root: string, deps: string[], devDeps: string[], scripts: Record<string,string>, name: string): void {
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name, version: '0.1.0', private: true, scripts, dependencies: Object.fromEntries(deps.map(d => [d.split('@').pop() || d, 'latest'])), devDependencies: Object.fromEntries(devDeps.map(d => [d.split('@').pop() || d, 'latest'])) }, null, 2), 'utf8');
}
export async function installDependencies(root: string): Promise<{ success: boolean; stderr: string }> {
  for (const cmd of ['npm install', 'pnpm install', 'cnpm install']) {
    try { await execP(cmd, { cwd: root, timeout: 90000 }); return { success: true, stderr: '' }; } catch (e) { if (cmd === 'cnpm install') return { success: false, stderr: String(e) }; }
  }
  return { success: false, stderr: '' };
}
