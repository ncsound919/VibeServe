import { runDeterministicBrain } from '../server/brainToolService';
import { logger } from '../lib/logger';
import { searchWikiForPhase, ingestWikiLearning } from './wikiRetrievalService';

type BrainLane = 'coding' | 'business_logic' | 'agent_brain' | 'tool_calling' | 'cross_domain';

const PHASE_BRAIN_QUERIES: Record<string, { query: string; lane: BrainLane }[]> = {
  'Environment Setup': [
    { query: 'Check system environment requirements for TypeScript project builds. What prerequisites should be validated?', lane: 'tool_calling' },
  ],
  'Dependency Resolution': [
    { query: 'Analyze the dependency tree for potential conflicts, deprecated packages, and security concerns. What patterns indicate risky dependencies?', lane: 'coding' },
  ],
  'RAG Context Sync': [
    { query: 'Synthesize knowledge across all codebase documentation. What are the key architectural patterns, cross-cutting concerns, and integration points?', lane: 'cross_domain' },
  ],
  'Static Analysis': [
    { query: 'Review code quality patterns. What code smells, anti-patterns, or maintainability issues are common in TypeScript/React projects?', lane: 'coding' },
  ],
  'Build & Compile': [
    { query: 'Analyze build output and compilation strategy. What webpack/vite/esbuild optimizations would improve bundle performance?', lane: 'tool_calling' },
  ],
  'Security Audit': [
    { query: 'Assess the security posture. What vulnerability patterns are most common in full-stack TypeScript applications? What remediation strategies have the highest ROI?', lane: 'business_logic' },
  ],
  'E2E Testing': [
    { query: 'Generate E2E testing strategy. What critical paths should be tested? What browser automation patterns are most effective for React applications?', lane: 'agent_brain' },
  ],
  'Optimization': [
    { query: 'Based on pipeline metrics and benchmarks, what optimizations would yield the biggest improvement? Consider build time, bundle size, test coverage, and code quality.', lane: 'cross_domain' },
  ],
  'Finalizing': [
    { query: 'Synthesize the complete pipeline run. What are the key takeaways, recommendations, and learnings that should be persisted for future builds?', lane: 'business_logic' },
  ],
};

export interface BrainConsultation {
  phase: string;
  lane: string;
  query: string;
  response: string;
  confidence: number;
  timestamp: string;
}

let sessionId: string | null = null;

export async function startBrainSession(): Promise<string> {
  try {
    const result = await runDeterministicBrain({
      query: 'Initialize pipeline orchestration session. Prepare for multi-phase build analysis.',
      lane: 'cross_domain',
      verbose: false,
    });
    sessionId = Date.now().toString(36);
    return sessionId;
  } catch {
    return 'offline-session';
  }
}

export async function consultBrainForPhase(phase: string, sourceRepos?: string[]): Promise<BrainConsultation[]> {
  const queries = PHASE_BRAIN_QUERIES[phase] || [];
  const results: BrainConsultation[] = [];

  for (const q of queries.slice(0, 2)) {
    const enrichedQuery = sourceRepos?.length
      ? `${q.query} Repository context: ${sourceRepos.join(', ')}.`
      : q.query;

    try {
      const response = await runDeterministicBrain({
        query: enrichedQuery,
        lane: q.lane,
        verbose: false,
      });

      const confidence = response.includes('error') ? 0.5 : 0.8;

      results.push({
        phase,
        lane: q.lane,
        query: q.query,
        response: response.substring(0, 300),
        confidence,
        timestamp: new Date().toISOString(),
      });

      try {
        ingestWikiLearning(
          `Brain Analysis (${phase}, ${q.lane} lane): ${response.substring(0, 200)}`,
          phase,
          ['brain', q.lane, 'insight']
        );
      } catch { /* wiki unavailable */ }
    } catch {
      results.push({
        phase,
        lane: q.lane,
        query: q.query,
        response: 'Brain unavailable',
        confidence: 0,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return results;
}

export async function analyzePipelineResults(scores: any, errors: any): Promise<string> {
  try {
    const query = `Analyze this pipeline run: Score: ${scores?.total || 'N/A'}/${scores?.maxTotal || 'N/A'}, Errors: ${errors?.totalErrors || 0}, TypeSafety: ${scores?.gates?.[0]?.score || 'N/A'}. What improvements should be prioritized?`;

    const response = await runDeterministicBrain({
      query,
      lane: 'cross_domain',
      verbose: false,
    });

    return response.substring(0, 400);
  } catch {
    return 'Brain post-analysis unavailable';
  }
}

export function endBrainSession(): void {
  sessionId = null;
}
