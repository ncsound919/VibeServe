/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Types for the Settings / Brain Control system.
 */

export interface BrainLaneConfig {
  provider: string;
  model: string;
  enabled: boolean;
}

export interface BrainConfig {
  lanes: Record<string, BrainLaneConfig>;
  routerModel: string;
  llmFallback: string;
}

export interface BrainStatus {
  running: boolean;
  apiPort: number;
  pythonAvailable: boolean;
  brainDir: string | null;
  lastRun: string | null;
}

export interface IntegrationServiceItem {
  name: string;
  connected: boolean;
  configured: boolean;
  description: string;
}

export interface SettingsState {
  brain: BrainConfig;
  brainStatus: BrainStatus;
  integrations: IntegrationServiceItem[];
  pipeline: PipelineConfig;
  agents: AgentRegistryItem[];
  localFirstMode: boolean;
  ollamaEndpoint: string;
}

export interface PipelineConfig {
  buildTimeout: number;
  maxParallelPhases: number;
  autoRetry: boolean;
  securityDepth: 'basic' | 'full';
  wikiAutoCompile: boolean;
  graphifyAutoBuild: boolean;
  toonAutoCompress: boolean;
}

export interface AgentRegistryItem {
  id: string;
  name: string;
  type: string;
  qualityGrade: string;
  skills: string[];
  assignedPhase: string;
}

export const LANE_DESCRIPTIONS: Record<string, string> = {
  coding: 'Generates and refactors code across languages and frameworks.',
  business_logic: 'Handles business rules, validation, and domain logic.',
  agent_brain: 'Central reasoning engine for multi-step planning and decision-making.',
  tool_calling: 'Manages API tool selection, execution, and result parsing.',
  cross_domain: 'Synthesizes knowledge across coding, business, and agent domains.',
};

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  buildTimeout: 300,
  maxParallelPhases: 3,
  autoRetry: true,
  securityDepth: 'full',
  wikiAutoCompile: true,
  graphifyAutoBuild: false,
  toonAutoCompress: false,
};

export const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'xai', label: 'xAI' },
  { value: 'opencode', label: 'OpenCode' },
];

export const DEFAULT_BRAIN_CONFIG: BrainConfig = {
  lanes: {
    coding: { provider: 'openai', model: 'gpt-4o', enabled: true },
    business_logic: { provider: 'anthropic', model: 'claude-opus-4-20250514', enabled: true },
    agent_brain: { provider: 'anthropic', model: 'claude-sonnet-4-20250514', enabled: true },
    tool_calling: { provider: 'openai', model: 'gpt-4o', enabled: true },
    cross_domain: { provider: 'openai', model: 'gpt-4o', enabled: true },
  },
  routerModel: 'openai/gpt-4o-mini',
  llmFallback: 'stub mode',
};

export const INTEGRATION_SERVICE_DEFS: Omit<IntegrationServiceItem, 'connected' | 'configured'>[] = [
  { name: 'nanobot', description: 'Agent chat & tool orchestration' },
  { name: 'qdrant', description: 'Vector search & semantic retrieval' },
  { name: 'firecrawl', description: 'Web scraping & content extraction' },
  { name: 'tavily', description: 'Web search API' },
  { name: 'mem0', description: 'Memory & context persistence' },
  { name: 'langfuse', description: 'LLM observability & tracing' },
  { name: 'supabaseVector', description: 'Supabase vector store (pgvector)' },
];
