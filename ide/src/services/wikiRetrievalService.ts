import { existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';
import { logger } from '../lib/logger';

const WIKI_DIR = path.resolve(process.cwd(), 'uploads', 'wiki', 'pages');
const RAW_DIR = path.resolve(process.cwd(), 'uploads', 'wiki', 'raw');

export interface WikiContext {
  relevantPages: string[];
  keyLearnings: string[];
  commonErrors: string[];
  suggestedPatterns: string[];
  lastUpdated: string;
}

export function searchWikiForPhase(phase: string, query?: string): WikiContext {
  const pages = getWikiPageFiles();
  const rawFiles = getRawFiles();
  const relevantPages: string[] = [];
  const keyLearnings: string[] = [];
  const commonErrors: string[] = [];
  const suggestedPatterns: string[] = [];

  const phaseKeywords: Record<string, string[]> = {
    'Static Analysis': ['lint', 'static', 'eslint', 'biome', 'type', 'quality'],
    'Security Audit': ['security', 'vulnerability', 'CVE', 'audit', 'secret'],
    'Build & Compile': ['build', 'compile', 'bundle', 'vite', 'esbuild'],
    'Dependency Resolution': ['dependency', 'package', 'module', 'install', 'npm'],
    'E2E Testing': ['test', 'e2e', 'playwright', 'browser', 'coverage'],
    'RAG Context Sync': ['rag', 'context', 'vector', 'embedding', 'knowledge'],
  };

  const keywords = phaseKeywords[phase] || [];

  for (const page of pages) {
    try {
      const content = readFileSync(page.path, 'utf-8').toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (content.includes(kw)) score++;
      }
      if (query && content.includes(query.toLowerCase())) score += 3;
      if (score >= 2) {
        relevantPages.push(page.name);
        const lines = content.split('\n');
        for (const line of lines) {
          if (line.startsWith('##') && keywords.some(k => line.toLowerCase().includes(k))) {
            keyLearnings.push(line.replace('## ', '').trim());
          }
        }
      }
    } catch { /* skip */ }
  }

  for (const raw of rawFiles) {
    try {
      const content = readFileSync(raw.path, 'utf-8').toLowerCase();
      if (content.includes('error') || content.includes('fail') || content.includes('bug')) {
        const lines = content.split('\n').filter(l => l.includes('error') || l.includes('fail'));
        for (const line of lines.slice(0, 3)) {
          commonErrors.push(line.trim().substring(0, 120));
        }
      }
    } catch { /* skip */ }
  }

  return {
    relevantPages,
    keyLearnings: keyLearnings.slice(0, 5),
    commonErrors: commonErrors.slice(0, 3),
    suggestedPatterns: suggestedPatterns.slice(0, 3),
    lastUpdated: new Date().toISOString(),
  };
}

function getWikiPageFiles(): Array<{ name: string; path: string }> {
  if (!existsSync(WIKI_DIR)) return [];
  return readdirSync(WIKI_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => ({ name: f.replace('.md', ''), path: path.join(WIKI_DIR, f) }));
}

function getRawFiles(): Array<{ name: string; path: string }> {
  if (!existsSync(RAW_DIR)) return [];
  return readdirSync(RAW_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => ({ name: f, path: path.join(RAW_DIR, f) }));
}

export function ingestWikiLearning(context: string, phase: string, tags: string[]): void {
  try {
    const { ingestRaw } = require('./llmWikiService');
    const entry = [
      `# Pipeline Learning: ${phase}`,
      `**Phase:** ${phase}`,
      `**Tags:** ${tags.join(', ')}`,
      `**Timestamp:** ${new Date().toISOString()}`,
      ``,
      context,
    ].join('\n');
    ingestRaw(`learning-${phase}-${Date.now()}`, entry, { phase, tags });
  } catch { /* wiki unavailable */ }
}
