import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'uploads', 'nexus');
const SUGGESTIONS_FILE = path.join(DATA_DIR, 'suggestions.json');

export interface Suggestion {
  id: string;
  benchmarkId: string;
  benchmarkName: string;
  message: string;
  actionable: string;
  applied: boolean;
  appliedAt?: string;
  scoreBefore: number;
  scoreAfter?: number;
  outcome: 'pending' | 'applied-improved' | 'applied-no-change' | 'applied-worsened' | 'dismissed';
  createdAt: string;
}

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadSuggestions(): Suggestion[] {
  ensureDir();
  if (!existsSync(SUGGESTIONS_FILE)) return [];
  try { return JSON.parse(readFileSync(SUGGESTIONS_FILE, 'utf-8')); }
  catch { return []; }
}

function saveSuggestions(suggestions: Suggestion[]) {
  ensureDir();
  writeFileSync(SUGGESTIONS_FILE, JSON.stringify(suggestions, null, 2), 'utf-8');
}

export function generateSuggestion(
  benchmarkId: string,
  benchmarkName: string,
  currentScore: number,
  targetScore: number,
  actionable: string,
): Suggestion | null {
  const suggestions = loadSuggestions();
  const existing = suggestions.find(
    s => s.benchmarkId === benchmarkId && s.outcome === 'pending',
  );
  if (existing) return null;

  const suggestion: Suggestion = {
    id: `sug_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    benchmarkId,
    benchmarkName,
    message: `${benchmarkName} score ${currentScore}/${targetScore} — ${actionable}`,
    actionable,
    applied: false,
    scoreBefore: currentScore,
    outcome: 'pending',
    createdAt: new Date().toISOString(),
  };

  suggestions.push(suggestion);
  if (suggestions.length > 50) suggestions.splice(0, suggestions.length - 50);
  saveSuggestions(suggestions);
  return suggestion;
}

export function applySuggestion(id: string): Suggestion | null {
  const suggestions = loadSuggestions();
  const suggestion = suggestions.find(s => s.id === id);
  if (!suggestion) return null;

  suggestion.applied = true;
  suggestion.appliedAt = new Date().toISOString();
  saveSuggestions(suggestions);
  return suggestion;
}

export function recordOutcome(id: string, scoreAfter: number): Suggestion | null {
  const suggestions = loadSuggestions();
  const suggestion = suggestions.find(s => s.id === id);
  if (!suggestion) return null;

  suggestion.scoreAfter = scoreAfter;
  if (scoreAfter > suggestion.scoreBefore) {
    suggestion.outcome = 'applied-improved';
  } else if (scoreAfter === suggestion.scoreBefore) {
    suggestion.outcome = 'applied-no-change';
  } else {
    suggestion.outcome = 'applied-worsened';
  }

  saveSuggestions(suggestions);
  return suggestion;
}

export function getActiveSuggestions(): Suggestion[] {
  return loadSuggestions().filter(s => s.outcome === 'pending');
}

export function getSuggestionHistory(): Suggestion[] {
  return loadSuggestions().filter(s => s.outcome !== 'pending');
}

export function getAllSuggestions(): Suggestion[] {
  return loadSuggestions();
}
