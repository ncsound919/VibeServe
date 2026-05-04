import fs from 'fs/promises';
import path from 'path';
import { runShellCommand } from '../server/realTools';

const PR_DIR = path.resolve(process.cwd(), 'user-data/pull-requests');

export async function initPrAgent() {
  await fs.mkdir(PR_DIR, { recursive: true });
}

export interface PRHunk {
  id: string;
  file: string;
  diff: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface PRResult {
  id: string;
  repo: string;
  branch: string;
  diffPath: string;
  title: string;
  description: string;
  status: 'draft' | 'open' | 'merged';
  hunks: PRHunk[];
  timestamp: string;
}

export async function generatePrDiff(repoPath: string, branchName: string): Promise<string> {
  // In a real scenario, this would use git diff
  // For now, we simulate by running git diff or using a mock if not a git repo
  const result = await runShellCommand(`git diff main..${branchName}`, repoPath);
  return result.stdout || 'No changes detected or not a git repository.';
}

export async function openPullRequest(
  repoName: string,
  branch: string,
  title: string,
  description: string,
  diff: string
): Promise<PRResult> {
  const prId = `pr-${Date.now()}`;
  const diffFilename = `${prId}.diff`;
  const diffPath = path.join(PR_DIR, diffFilename);
  
  await fs.writeFile(diffPath, diff);
  
  // Basic Hunk Parser
  const hunks: PRHunk[] = [];
  const lines = diff.split('\n');
  let currentFile = '';
  let currentHunk: string[] = [];
  
  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      if (currentHunk.length > 0) {
        hunks.push({
          id: `hunk-${hunks.length}`,
          file: currentFile,
          diff: currentHunk.join('\n'),
          status: 'pending'
        });
      }
      currentFile = line.split(' b/')[1] || 'unknown';
      currentHunk = [line];
    } else {
      currentHunk.push(line);
    }
  }
  if (currentHunk.length > 0) {
    hunks.push({
      id: `hunk-${hunks.length}`,
      file: currentFile,
      diff: currentHunk.join('\n'),
      status: 'pending'
    });
  }

  const pr: PRResult = {
    id: prId,
    repo: repoName,
    branch,
    diffPath: diffFilename,
    title,
    description,
    status: 'open',
    hunks,
    timestamp: new Date().toISOString()
  };
  
  const prMetadataPath = path.join(PR_DIR, `${prId}.json`);
  await fs.writeFile(prMetadataPath, JSON.stringify(pr, null, 2));
  
  return pr;
}

export async function updateHunkStatus(prId: string, hunkId: string, status: 'approved' | 'rejected'): Promise<PRResult | null> {
  const prMetadataPath = path.join(PR_DIR, `${prId}.json`);
  try {
    const content = await fs.readFile(prMetadataPath, 'utf-8');
    const pr: PRResult = JSON.parse(content);
    const hunk = pr.hunks.find(h => h.id === hunkId);
    if (hunk) {
      hunk.status = status;
      await fs.writeFile(prMetadataPath, JSON.stringify(pr, null, 2));
      return pr;
    }
    return null;
  } catch {
    return null;
  }
}

export async function listPullRequests(): Promise<PRResult[]> {
  try {
    const files = await fs.readdir(PR_DIR);
    const prFiles = files.filter(f => f.endsWith('.json'));
    const prs: PRResult[] = [];
    
    for (const f of prFiles) {
      const content = await fs.readFile(path.join(PR_DIR, f), 'utf-8');
      prs.push(JSON.parse(content));
    }
    
    return prs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch {
    return [];
  }
}
