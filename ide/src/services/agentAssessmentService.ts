import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { logger } from '../lib/logger';

export interface AgentAssessment {
  name: string;
  path: string;
  type: string;
  quality: { lintScore: number; typeSafety: number; structureScore: number; overall: string };
  skills: string[];
  integrationPotential: { pipelinePhase: string; score: number; reason: string }[];
  recommendedAssignment: string;
  confidence: number;
}

const SKILL_PATTERNS: Record<string, { skills: string[]; phase: string; type: string }> = {
  '.ts': { skills: ['TypeScript', 'Frontend'], phase: 'Static Analysis', type: 'TypeScript Project' },
  '.tsx': { skills: ['React', 'TypeScript', 'UI'], phase: 'Build & Compile', type: 'React Component' },
  '.py': { skills: ['Python', 'Backend', 'AI/ML'], phase: 'RAG Context Sync', type: 'Python Script' },
  '.css': { skills: ['CSS', 'Styling'], phase: 'Build & Compile', type: 'Stylesheet' },
  '.json': { skills: ['Configuration'], phase: 'Environment Setup', type: 'Config' },
  '.md': { skills: ['Documentation'], phase: 'RAG Context Sync', type: 'Documentation' },
  '.sql': { skills: ['Database', 'SQL'], phase: 'Dependency Resolution', type: 'Database Schema' },
  '.test.ts': { skills: ['Testing', 'Quality Assurance'], phase: 'E2E Testing', type: 'Test Suite' },
  '.spec.ts': { skills: ['Testing', 'Quality Assurance'], phase: 'E2E Testing', type: 'Test Suite' },
};

export function assessAgentFolder(folderPath: string): AgentAssessment {
  const name = path.basename(folderPath);
  const files = walkFiles(folderPath);

  if (files.length === 0) {
    return {
      name, path: folderPath, type: 'empty',
      quality: { lintScore: 0, typeSafety: 0, structureScore: 0, overall: 'F' },
      skills: [],
      integrationPotential: [],
      recommendedAssignment: 'none',
      confidence: 0,
    };
  }

  const extCounts: Record<string, number> = {};
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    extCounts[ext] = (extCounts[ext] || 0) + 1;
  }
  const topExt = Object.entries(extCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  const typeInfo = SKILL_PATTERNS[topExt] || { skills: ['General'], phase: 'Environment Setup', type: 'Unknown' };

  let structureScore = 10;
  let typeSafety = 10;

  const hasPackageJson = files.some(f => f.endsWith('package.json'));
  const hasTsconfig = files.some(f => f.endsWith('tsconfig.json'));
  const hasGitignore = files.some(f => f.endsWith('.gitignore'));
  const hasReadme = files.some(f => f.toLowerCase().includes('readme'));

  if (!hasPackageJson) structureScore -= 2;
  if (!hasTsconfig) structureScore -= 2;
  if (!hasGitignore) structureScore -= 1;
  if (!hasReadme) structureScore -= 1;

  const jsFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.jsx'));
  if (jsFiles.length > 0) typeSafety -= Math.min(5, jsFiles.length);

  const overall = structureScore >= 8 && typeSafety >= 7 ? 'A' : structureScore >= 5 ? 'B' : 'C';

  const skills = [...new Set([
    ...typeInfo.skills,
    ...(hasPackageJson ? ['npm', 'package management'] : []),
    ...(hasTsconfig ? ['TypeScript configuration'] : []),
    ...(files.some(f => f.includes('.test.') || f.includes('.spec.')) ? ['Testing'] : []),
  ])];

  const integrationPotential = [
    { pipelinePhase: typeInfo.phase, score: 8, reason: `Primary extension: ${topExt}` },
    { pipelinePhase: 'Static Analysis', score: hasTsconfig || jsFiles.length > 0 ? 7 : 3, reason: 'Code quality assessment' },
    { pipelinePhase: 'RAG Context Sync', score: hasReadme ? 7 : 2, reason: hasReadme ? 'Has documentation' : 'No documentation' },
    { pipelinePhase: 'E2E Testing', score: skills.includes('Testing') ? 9 : 1, reason: skills.includes('Testing') ? 'Has test files' : 'No tests found' },
    { pipelinePhase: 'Security Audit', score: typeSafety >= 7 ? 6 : 3, reason: 'Security assessment potential' },
  ].sort((a, b) => b.score - a.score);

  const best = integrationPotential[0];

  try {
    logger.info('AgentAssessment', `Assessed "${name}": type=${typeInfo.type} grade=${overall} assignment=${best?.pipelinePhase ?? 'Review'}`);
  } catch {}

  return {
    name,
    path: folderPath,
    type: typeInfo.type,
    quality: { lintScore: 0, typeSafety, structureScore, overall },
    skills,
    integrationPotential,
    recommendedAssignment: best?.score && best.score >= 5 ? best.pipelinePhase : 'Review',
    confidence: Math.min(0.9, files.length * 0.1),
  };
}

function walkFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) pushAll(results, walkFiles(full));
      else results.push(full);
    }
  } catch {}
  return results;
}

function pushAll<T>(target: T[], source: T[]) {
  target.push(...source);
}
