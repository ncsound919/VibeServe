import { existsSync, mkdirSync, readFileSync } from 'fs';
import { writeFile } from 'fs/promises';
import { mkdtemp, rm } from 'fs/promises';
import path from 'path';
import os from 'os';
import type { Suggestion, VerificationResult } from '../types/suggestions';

const DATA_DIR = path.resolve(process.cwd(), '.vibeserve');
const SUGGESTIONS_FILE = path.join(DATA_DIR, 'suggestions_store.json');

interface StoredSuggestion {
  id: string;
  type: string;
  title: string;
  description: string;
  repoName: string;
  filePath?: string;
  confidence: number;
  createdAt: string;
  goalId: string | null;
  goalTitle?: string;
  goalPriority?: number;
  verificationStatus: string;
  verificationLogRef?: string;
  appliedAt?: string;
  appliedBy?: string;
  status: 'accepted' | 'rejected' | 'ignored' | 'pending';
}

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadStore(): StoredSuggestion[] {
  ensureDir();
  if (!existsSync(SUGGESTIONS_FILE)) return [];
  try { return JSON.parse(readFileSync(SUGGESTIONS_FILE, 'utf-8')); }
  catch { return []; }
}

async function saveStore(items: StoredSuggestion[]) {
  ensureDir();
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'vs-sug-'));
  const tmpPath = path.join(tmpDir, 'suggestions.json');
  try {
    await writeFile(tmpPath, JSON.stringify(items, null, 2), 'utf-8');
    const { rename } = await import('fs/promises');
    await rename(tmpPath, SUGGESTIONS_FILE);
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function saveSuggestions(suggestions: Suggestion[]): Promise<void> {
  const store = loadStore();
  for (const s of suggestions) {
    const existingIdx = store.findIndex(x => x.id === s.id);
    const isNew = existingIdx < 0;
    const stored: StoredSuggestion = {
      ...s,
      verificationStatus: s.verificationStatus || 'not-run',
      status: isNew ? 'pending' : (store[existingIdx].status || 'pending'),
    };
    if (existingIdx >= 0) {
      store[existingIdx] = stored;
    } else {
      store.push(stored);
    }
  }
  if (store.length > 500) store.splice(0, store.length - 500);
  await saveStore(store);
}

export async function updateVerification(result: VerificationResult): Promise<void> {
  const store = loadStore();
  const item = store.find(s => s.id === result.suggestionId);
  if (item) {
    item.verificationStatus = result.status;
    item.verificationLogRef = JSON.stringify(result.logs);
    await saveStore(store);
  }
}

export async function markApplied(suggestionId: string, userId: string): Promise<void> {
  const store = loadStore();
  const item = store.find(s => s.id === suggestionId);
  if (item) {
    item.status = 'accepted';
    item.appliedAt = new Date().toISOString();
    item.appliedBy = userId;
    await saveStore(store);
  }
}

export function getPendingSuggestions(): Suggestion[] {
  return loadStore().filter(s => s.status === 'pending') as any;
}

export function getSuggestionHistory(): StoredSuggestion[] {
  return loadStore().filter(s => s.status !== 'pending');
}

export function getImpactSummary(days: number = 7): { totalApplied: number; byGoal: Record<string, number> } {
  const cutoff = Date.now() - (days * 86400000);
  const recent = loadStore().filter(s =>
    s.status === 'accepted' && s.appliedAt && new Date(s.appliedAt).getTime() > cutoff
  );
  const byGoal: Record<string, number> = {};
  for (const s of recent) {
    const gid = s.goalId || 'unaligned';
    byGoal[gid] = (byGoal[gid] || 0) + 1;
  }
  return { totalApplied: recent.length, byGoal };
}
