export type AppType = 'landing-page' | 'saas' | 'blog' | 'ecommerce' | 'api' | 'dashboard' | 'todo' | 'custom';

export interface TechStack {
  frontend?: 'react' | 'vue' | 'svelte' | 'vanilla' | 'none';
  backend?: 'express' | 'fastify' | 'none';
  database?: 'sqlite' | 'postgres' | 'none';
  css?: 'tailwind' | 'css' | 'styled-components' | 'none';
}

export interface AppSpec {
  description: string;
  appType?: AppType;
  features?: string[];
  outputDir?: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
  executable?: boolean;
}

export interface ArchitecturePlan {
  appType: AppType;
  techStack: Required<TechStack>;
  files: GeneratedFile[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  summary: string;
}

export interface BuildError {
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface BuildResult {
  success: boolean;
  outputPath: string;
  duration: number;
  errors: BuildError[];
  warnings: string[];
}

export interface GenerationResult {
  success: boolean;
  appPath: string;
  plan: ArchitecturePlan;
  buildResult?: BuildResult;
  summary: string;
  duration: number;
}

export const APP_TYPE_LABELS: Record<AppType, string> = {
  'landing-page': 'Landing Page',
  saas: 'SaaS Application',
  blog: 'Blog / CMS',
  ecommerce: 'E-commerce Store',
  api: 'API Server',
  dashboard: 'Dashboard',
  todo: 'Todo App',
  custom: 'Custom Application',
};

export interface PlanStep {
  id: string;
  file: string;
  action: 'create' | 'modify' | 'delete';
  purpose: string;
  status: 'pending' | 'completed' | 'failed';
}

export interface MultiFilePlan {
  id: string;
  title: string;
  summary: string;
  steps: PlanStep[];
}
