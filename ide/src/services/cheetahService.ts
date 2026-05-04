/**
 * CheetahService — Overlay Cheetah V3 Integration
 *
 * Bridges Nexus Alpha to the Overlay Cheetah V3 autocoder engine
 * (https://github.com/tap919/Overlay-Cheetah-V3).
 *
 * Cheetah V3 model: YAML task spec → Jinja2 templates → generated code files.
 * Enhanced features: parallel generation, incremental builds, smart caching.
 *
 * This service:
 * 1. Accepts structured code generation requests from Nexus routes
 * 2. Writes YAML task specs to the Cheetah task directory
 * 3. Invokes the Cheetah Python engine (if available) or the TS fallback
 * 4. Returns generated file content back to the caller
 * 5. Replaces/unifies: autocoderService.ts patterns
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import path from 'path';
import { logger } from '../lib/logger';

const execFileAsync = promisify(execFile);

// ─── Paths ────────────────────────────────────────────────────────────────────

const CHEETAH_DIR = path.resolve(process.cwd(), 'cheetah');
const TASK_DIR = path.join(CHEETAH_DIR, 'tasks');
const OUT_DIR = path.join(CHEETAH_DIR, 'out');
const REPORTS_DIR = path.join(CHEETAH_DIR, 'reports');
const TEMPLATES_DIR = path.join(CHEETAH_DIR, 'templates');

function ensureDirs() {
  for (const dir of [TASK_DIR, OUT_DIR, REPORTS_DIR, TEMPLATES_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type CheetahPattern =
  | 'crud-api'
  | 'react-component'
  | 'typescript-interface'
  | 'database-schema'
  | 'test-file'
  | 'config-file'
  | 'hook'
  | 'service'
  | 'model'
  | 'middleware'
  | 'hono-route'
  | 'supabase-table';

export interface CheetahRequest {
  taskId: string;
  pattern: CheetahPattern;
  name: string;
  options?: {
    language?: string;
    framework?: string;
    database?: string;
    addTypes?: boolean;
    addTests?: boolean;
    addDocs?: boolean;
    parallel?: boolean;
    incremental?: boolean;
  };
}

export interface CheetahResult {
  success: boolean;
  taskId: string;
  pattern: CheetahPattern;
  files: Array<{ path: string; content: string }>;
  tokenSavings: number;
  engine: 'cheetah-python' | 'cheetah-ts-fallback';
  message?: string;
  durationMs: number;
}

export interface CheetahBuildReport {
  taskId: string;
  generated: string[];
  errors: Array<{ file: string; error: string }>;
  warnings: string[];
  skipped?: Array<{ file: string; reason: string }>;
}

// ─── Python Engine Detection ──────────────────────────────────────────────────

let _pythonAvailable: boolean | null = null;
let _cheetahScriptPath: string | null = null;

async function detectPythonEngine(): Promise<{ available: boolean; scriptPath?: string }> {
  if (_pythonAvailable !== null) {
    return { available: _pythonAvailable, scriptPath: _cheetahScriptPath ?? undefined };
  }

  const candidate = path.join(process.cwd(), 'cheetah', 'autocoder.py');

  if (existsSync(candidate)) {
    _pythonAvailable = true;
    _cheetahScriptPath = candidate;
    logger.info('CheetahService', `Python engine found at: ${candidate}`);
    return { available: true, scriptPath: candidate };
  }

  // Check if python3 / python is in PATH
  try {
    await execFileAsync('python', ['--version'], { timeout: 5000 });
    _pythonAvailable = false; // Python available but no cheetah script
  } catch {
    _pythonAvailable = false;
  }

  logger.info('CheetahService', 'Python engine not found — using TypeScript fallback');
  return { available: false };
}

// ─── YAML Task Writer ─────────────────────────────────────────────────────────

function writeCheetahTask(request: CheetahRequest): string {
  ensureDirs();

  const templateName = getTemplateName(request.pattern, request.options);
  const outputPath = getOutputPath(request.pattern, request.name, request.options);

  const yamlContent = [
    `task_id: ${request.taskId}`,
    `files:`,
    `  - template: ${templateName}`,
    `    output: ${outputPath}`,
    `    context:`,
    `      name: ${request.name}`,
    `      pattern: ${request.pattern}`,
    request.options?.language ? `      language: ${request.options.language}` : null,
    request.options?.framework ? `      framework: ${request.options.framework}` : null,
    request.options?.database ? `      database: ${request.options.database}` : null,
    `      addTypes: ${request.options?.addTypes ?? false}`,
    `      addTests: ${request.options?.addTests ?? false}`,
    `      addDocs: ${request.options?.addDocs ?? false}`,
  ].filter(Boolean).join('\n');

  const taskFile = path.join(TASK_DIR, `${request.taskId}.yaml`);
  writeFileSync(taskFile, yamlContent, 'utf-8');
  return taskFile;
}

// ─── TypeScript Fallback Generator ───────────────────────────────────────────
// Mirrors Cheetah V3's template logic in pure TypeScript — used when Python
// is unavailable or for inline generation without file I/O overhead.

function toPascalCase(str: string): string {
  return str.replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')).replace(/^(.)/, (c) => c.toUpperCase());
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '').replace(/[-_\s]+/g, '_');
}

function generateTsFallback(request: CheetahRequest): string {
  const pascal = toPascalCase(request.name);
  const camel = toCamelCase(request.name);
  const snake = toSnakeCase(request.name);
  const opts = request.options ?? {};

  switch (request.pattern) {
    case 'hono-route':
      return `import { Hono } from 'hono';

const ${camel}Routes = new Hono();

${opts.addDocs ? `/** GET /${camel} — list all ${camel}s */` : ''}
${camel}Routes.get('/', async (c) => {
  // TODO: implement
  return c.json({ data: [] });
});

${opts.addDocs ? `/** GET /${camel}/:id — get single ${camel} */` : ''}
${camel}Routes.get('/:id', async (c) => {
  const id = c.req.param('id');
  // TODO: implement
  return c.json({ data: null });
});

${opts.addDocs ? `/** POST /${camel} — create ${camel} */` : ''}
${camel}Routes.post('/', async (c) => {
  const body = await c.req.json();
  // TODO: implement
  return c.json({ data: body }, 201);
});

${opts.addDocs ? `/** PUT /${camel}/:id — update ${camel} */` : ''}
${camel}Routes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  // TODO: implement
  return c.json({ data: { id, ...body } });
});

${opts.addDocs ? `/** DELETE /${camel}/:id — delete ${camel} */` : ''}
${camel}Routes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  // TODO: implement
  return c.json({ deleted: id });
});

export default ${camel}Routes;
`;

    case 'service':
      return `${opts.addDocs ? `/**\n * ${pascal}Service\n * Generated by Cheetah V3\n */\n` : ''}
export class ${pascal}Service {
${opts.framework === 'crud' ? `  private static instance: ${pascal}Service;

  private constructor() {}

  static getInstance(): ${pascal}Service {
    if (!${pascal}Service.instance) {
      ${pascal}Service.instance = new ${pascal}Service();
    }
    return ${pascal}Service.instance;
  }

  async findAll(): Promise<unknown[]> { return []; }
  async findById(id: string): Promise<unknown | null> { return null; }
  async create(data: unknown): Promise<unknown> { return data; }
  async update(id: string, data: unknown): Promise<unknown | null> { return null; }
  async delete(id: string): Promise<boolean> { return true; }` :
`  async execute(action: string, payload?: unknown): Promise<unknown> {
    switch (action) {
      default:
        throw new Error('Unknown action: ' + action);
    }
  }`}
}
`;

    case 'react-component':
      return `import React from 'react';

interface ${pascal}Props {
  className?: string;
}

export function ${pascal}({ className }: ${pascal}Props) {
  return (
    <div className={className}>
      {/* TODO: implement ${pascal} */}
    </div>
  );
}
`;

    case 'hook':
      return `import { useState, useEffect, useCallback } from 'react';

export function use${pascal}() {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // TODO: implement fetch
      setData(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
`;

    case 'typescript-interface':
      return `${opts.addDocs ? `/**\n * ${pascal} interface — Generated by Cheetah V3\n */\n` : ''}
export interface ${pascal} {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}
${opts.addTypes ? `
export type ${pascal}Input = Partial<Omit<${pascal}, 'id' | 'createdAt' | 'updatedAt'>>;
export type ${pascal}Output = ${pascal};
` : ''}`;

    case 'database-schema': {
      const db = opts.database ?? 'postgresql';
      if (db === 'postgresql' || db === 'supabase') {
        return `-- ${pascal} table — Generated by Cheetah V3
CREATE TABLE ${snake} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE ${snake} ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_${snake}_created_at ON ${snake}(created_at);
`;
      }
      return `model ${pascal} {
  id        String   @id @default(uuid())
  name      String
  description String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`;
    }

    case 'supabase-table':
      return `-- ${pascal} Supabase table — Generated by Cheetah V3
CREATE TABLE public.${snake} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.${snake} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "${snake}_user_policy" ON public.${snake}
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_${snake}_user_id ON public.${snake}(user_id);
CREATE INDEX idx_${snake}_created_at ON public.${snake}(created_at);
`;

    case 'test-file':
      return `import { describe, it, expect } from 'vitest';
import { ${pascal} } from '../services/${pascal}';

describe('${pascal}', () => {
  it('should be defined', () => {
    expect(${pascal}).toBeDefined();
  });

  it('should have correct structure', () => {
    // TODO: add specific assertions
    expect(true).toBe(true);
  });
});
`;

    case 'middleware':
      return `import { Context, Next } from 'hono';

export async function ${camel}Middleware(c: Context, next: Next) {
  try {
    // TODO: implement middleware logic
    const canProceed = true;
    if (!canProceed) {
      return c.json({ error: 'Access denied' }, 403);
    }
    await next();
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Middleware error' }, 500);
  }
}
`;

    case 'crud-api':
    default:
      return `import { Hono } from 'hono';

const ${camel} = new Hono();

${camel}.get('/', (c) => c.json({ data: [] }));
${camel}.get('/:id', (c) => c.json({ data: null }));
${camel}.post('/', async (c) => { const b = await c.req.json(); return c.json(b, 201); });
${camel}.put('/:id', async (c) => { const b = await c.req.json(); return c.json(b); });
${camel}.delete('/:id', (c) => c.json({ deleted: c.req.param('id') }));

export default ${camel};
`;
  }
}

function getOutputPath(pattern: CheetahPattern, name: string, opts?: CheetahRequest['options']): string {
  const pascal = toPascalCase(name);
  const camel = toCamelCase(name);
  switch (pattern) {
    case 'hono-route':     return `src/server/routes/${camel}Routes.ts`;
    case 'crud-api':       return `src/routes/${camel}.ts`;
    case 'react-component': return `src/components/${pascal}/${pascal}.tsx`;
    case 'typescript-interface': return `src/types/${pascal}.ts`;
    case 'database-schema': return `database/${toCamelCase(name)}.sql`;
    case 'supabase-table': return `database/supabase_${toSnakeCase(name)}.sql`;
    case 'test-file':      return `tests/${pascal}.test.ts`;
    case 'hook':           return `src/hooks/use${pascal}.ts`;
    case 'service':        return `src/services/${pascal}Service.ts`;
    case 'model':          return `src/models/${pascal}.ts`;
    case 'middleware':     return `src/middleware/${camel}.ts`;
    case 'config-file':    return opts?.language === 'yaml' ? 'config.yaml' : 'config.json';
    default:               return `src/${name}.ts`;
  }
}

function getTemplateName(pattern: CheetahPattern, opts?: CheetahRequest['options']): string {
  return `${pattern}.jinja2`;
}

// Token savings estimates per pattern (from Cheetah V3 benchmarks)
const TOKEN_SAVINGS: Record<CheetahPattern, number> = {
  'crud-api':              150,
  'react-component':        80,
  'typescript-interface':   40,
  'database-schema':        60,
  'supabase-table':         75,
  'test-file':             100,
  'config-file':            30,
  'hook':                  120,
  'service':                90,
  'model':                  70,
  'middleware':             85,
  'hono-route':            160,
};

// ─── Main Service ─────────────────────────────────────────────────────────────

export async function generateWithCheetah(request: CheetahRequest): Promise<CheetahResult> {
  const t0 = Date.now();

  try {
    const { available, scriptPath } = await detectPythonEngine();

    if (available && scriptPath) {
      // ── Python path: write YAML task, invoke Cheetah engine ──
      const taskFile = writeCheetahTask(request);

      try {
        const args = ['--once', '--no-format'];
        if (request.options?.parallel === false) args.push('--no-parallel');
        if (request.options?.incremental === false) args.push('--no-incremental');

        await execFileAsync('python', [scriptPath, ...args], {
          cwd: CHEETAH_DIR,
          timeout: 30_000,
          env: { ...process.env },
        });

        // Read generated files
        const reportFile = path.join(REPORTS_DIR, `${request.taskId}.json`);
        if (existsSync(reportFile)) {
          const report: CheetahBuildReport = JSON.parse(readFileSync(reportFile, 'utf-8'));
          const files = report.generated.map((relPath) => {
            const fullPath = path.join(OUT_DIR, relPath);
            return {
              path: relPath,
              content: existsSync(fullPath) ? readFileSync(fullPath, 'utf-8') : '',
            };
          });

          logger.info('CheetahService', `[python] Generated ${files.length} files for task "${request.taskId}"`);

          return {
            success: report.errors.length === 0,
            taskId: request.taskId,
            pattern: request.pattern,
            files,
            tokenSavings: files.length * (TOKEN_SAVINGS[request.pattern] ?? 80),
            engine: 'cheetah-python',
            message: report.errors.length > 0 ? `${report.errors.length} error(s)` : undefined,
            durationMs: Date.now() - t0,
          };
        }
      } catch (pyErr) {
        logger.warn('CheetahService', `Python engine failed, falling back to TS: ${pyErr}`);
      }
    }

    // ── TypeScript fallback ──
    const content = generateTsFallback(request);
    const outputPath = getOutputPath(request.pattern, request.name, request.options);

    logger.info('CheetahService', `[ts-fallback] Generated ${request.pattern} for "${request.name}"`);

    return {
      success: true,
      taskId: request.taskId,
      pattern: request.pattern,
      files: [{ path: outputPath, content }],
      tokenSavings: TOKEN_SAVINGS[request.pattern] ?? 80,
      engine: 'cheetah-ts-fallback',
      durationMs: Date.now() - t0,
    };
  } catch (err) {
    logger.error('CheetahService', `Generation failed: ${err}`);
    return {
      success: false,
      taskId: request.taskId,
      pattern: request.pattern,
      files: [],
      tokenSavings: 0,
      engine: 'cheetah-ts-fallback',
      message: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - t0,
    };
  }
}

/** Estimate token savings for a pattern without running generation */
export function estimateCheetahSavings(pattern: CheetahPattern): number {
  return TOKEN_SAVINGS[pattern] ?? 80;
}

/** List all supported Cheetah patterns */
export function getCheetahPatterns(): CheetahPattern[] {
  return Object.keys(TOKEN_SAVINGS) as CheetahPattern[];
}

/** Check if the Python Cheetah engine is available */
export async function isCheetahEngineAvailable(): Promise<boolean> {
  const { available } = await detectPythonEngine();
  return available;
}

/** Get Cheetah engine status */
export async function getCheetahStatus(): Promise<{
  engineAvailable: boolean;
  scriptPath?: string;
  taskDir: string;
  outDir: string;
  pendingTasks: number;
  completedTasks: number;
}> {
  const { available, scriptPath } = await detectPythonEngine();
  ensureDirs();

  const tasks = existsSync(TASK_DIR) ? readdirSync(TASK_DIR).filter(f => f.endsWith('.yaml')) : [];
  const done = existsSync(TASK_DIR) ? readdirSync(TASK_DIR).filter(f => f.endsWith('.done')) : [];

  return {
    engineAvailable: available,
    scriptPath,
    taskDir: TASK_DIR,
    outDir: OUT_DIR,
    pendingTasks: tasks.length - done.length,
    completedTasks: done.length,
  };
}
