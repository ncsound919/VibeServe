import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, readdirSync, writeFileSync, statSync, createWriteStream } from 'fs';
import path from 'path';
import https from 'https';
import { pipeline } from 'stream';
import { logger } from '../lib/logger';

const execAsync = promisify(exec);
const pipelineAsync = promisify(pipeline);
const CLONE_DIR = path.resolve(process.cwd(), 'uploads', 'cloned');

export interface ClonedRepo {
  name: string;
  owner: string;
  repo: string;
  path: string;
  fileCount: number;
  totalSizeKB: number;
  languages: string[];
  files: Array<{ path: string; relativePath: string; size: number; extension: string }>;
}

function ensureDir() {
  if (!existsSync(CLONE_DIR)) mkdirSync(CLONE_DIR, { recursive: true });
}

function walkDir(dir: string, baseDir: string): Array<{ path: string; relativePath: string; size: number; extension: string }> {
  const results: Array<{ path: string; relativePath: string; size: number; extension: string }> = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === '__pycache__') continue;
      results.push(...walkDir(fullPath, baseDir));
    } else if (entry.isFile()) {
      try {
        const stat = statSync(fullPath);
        results.push({
          path: fullPath,
          relativePath: path.relative(baseDir, fullPath),
          size: stat.size,
          extension: path.extname(entry.name).toLowerCase(),
        });
      } catch { /* skip */ }
    }
  }
  return results;
}

export async function cloneRepo(githubUrl: string): Promise<ClonedRepo> {
  ensureDir();
  
  const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/\s.#?]+)/);
  if (!match) throw new Error(`Invalid GitHub URL: ${githubUrl}`);
  
  const owner = match[1];
  const repo = match[2].replace('.git', '');
  const name = `${owner}/${repo}`;
  const targetDir = path.join(CLONE_DIR, `${owner}_${repo}_${Date.now()}`);
  
  if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });

  const zipUrl = `https://api.github.com/repos/${owner}/${repo}/zipball/HEAD`;
  
  try {
    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = { 'User-Agent': 'Nexus-Alpha' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const zipPath = path.join(CLONE_DIR, `${name.replace('/', '_')}.zip`);
    
    await new Promise<void>((resolve, reject) => {
      const parsed = new URL(zipUrl);
      const req = https.get({
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers,
      }, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          https.get(res.headers.location!, (rr) => {
            const file = createWriteStream(zipPath);
            pipelineAsync(rr, file).then(resolve, reject);
          }).on('error', reject);
          return;
        }
        const file = createWriteStream(zipPath);
        pipelineAsync(res, file).then(resolve, reject);
      });
      req.on('error', reject);
      req.end();
    });
    
    if (process.platform === 'win32') {
      await execAsync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${targetDir}' -Force"`, { timeout: 60000, cwd: CLONE_DIR });
    } else {
      await execAsync(`unzip -o "${zipPath}" -d "${targetDir}"`, { timeout: 60000, cwd: CLONE_DIR });
    }
    
    try { require('fs').unlinkSync(zipPath); } catch {}
    
    const entries = readdirSync(targetDir, { withFileTypes: true }).filter(e => e.isDirectory());
    const sourceDir = entries.length > 0 ? path.join(targetDir, entries[0].name) : targetDir;
    
    const files = walkDir(sourceDir, sourceDir);
    const totalSizeKB = Math.round(files.reduce((s, f) => s + f.size, 0) / 1024);
    const extensions = [...new Set(files.map(f => f.extension))];
    
    const langMap: Record<string, string> = {
      '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript',
      '.py': 'Python', '.rs': 'Rust', '.go': 'Go', '.java': 'Java',
      '.css': 'CSS', '.html': 'HTML', '.json': 'JSON', '.md': 'Markdown',
      '.yml': 'YAML', '.yaml': 'YAML', '.sql': 'SQL',
    };
    const languages = [...new Set(extensions.map(e => langMap[e] || e))];
    
    logger.info('RepoLoader', `Cloned ${name}: ${files.length} files, ${totalSizeKB} KB, ${languages.length} languages`);
    
    return {
      name, owner, repo, path: sourceDir, fileCount: files.length, totalSizeKB, languages, files,
    };
  } catch (e: any) {
    throw new Error(`Failed to clone ${name}: ${e.message}`);
  }
}

export function getRepoPath(owner: string, repoName: string): string | null {
  const dir = CLONE_DIR;
  if (!existsSync(dir)) return null;
  const entries = readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory());
  for (const entry of entries) {
    if (entry.name.startsWith(`${owner}_${repoName}_`)) {
      const subdirs = readdirSync(path.join(dir, entry.name), { withFileTypes: true }).filter(e => e.isDirectory());
      if (subdirs.length > 0) return path.join(dir, entry.name, subdirs[0].name);
      return path.join(dir, entry.name);
    }
  }
  return null;
}
