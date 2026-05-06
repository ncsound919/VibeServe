import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface FileManifestEntry {
  path: string;
  type: 'component' | 'store' | 'hook' | 'type' | 'page' | 'util' | 'style';
  dependsOn: string[];
  description: string;
}

interface PipelineFile {
  path: string;
  status: 'green' | 'red';
  issues: string[];
}

interface PipelineState {
  id: string;
  intent: string;
  startedAt: number;
  steps: { id: string; status: 'pending' | 'running' | 'done' | 'error'; detail: string }[];
  complete: boolean;
  files: PipelineFile[];
}

interface CallAIConfig {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  model?: string;
  timeoutMs?: number;
  retries?: number;
}

const activePipelines = new Map<string, PipelineState>();
const pipelineContexts = new Map<string, Record<string, string>>();

const PIPELINE_STEP_ORDER = ['scaffold', 'architect', 'parse', 'generate', 'validate', 'install'];
const GENERATED_BASE = path.resolve(process.cwd(), 'src', 'generated-apps');

async function callAIWithRetry(config: CallAIConfig): Promise<string> {
  const { systemPrompt, userPrompt, maxTokens = 2000, model = 'mimo-v2-pro', timeoutMs = 90000, retries = 3 } = config;
  const apiKey = process.env.OPENCODE_API_KEY;
  if (!apiKey) throw new Error('OPENCODE_API_KEY not configured');

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const sys = attempt === 1 ? systemPrompt : (attempt === 2 ? systemPrompt.slice(0, 1000) : '');
      const usr = attempt === 1 ? userPrompt : (attempt === 2 ? userPrompt.slice(0, 4000) : userPrompt.slice(0, 2000));

      const res = await fetch('https://opencode.ai/zen/go/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: sys.slice(0, 2000) },
            { role: 'user', content: usr.slice(0, 8000) },
          ],
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => 'unknown');
        if (res.status === 429) {
          await new Promise(r => setTimeout(r, 10000 * attempt));
          continue;
        }
        if (res.status === 400) {
          throw new Error(`API 400: ${errText.slice(0, 200)}`);
        }
        throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning_content || '';
      if (!content && attempt < retries) {
        if (model.includes('v4')) {
          config.model = 'mimo-v2-pro';
        }
        continue;
      }
      return content;
    } catch (err: any) {
      lastError = err;
      if (err.name === 'AbortError') {
        console.warn(`[Pipeline] Call timed out (${timeoutMs}ms), attempt ${attempt}/${retries}`);
      }
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error('All retries exhausted');
}

function scaffoldProject(appDir: string, intent: string): { packageJson: any; tsconfig: any; viteConfig: string; files: string[] } {
  const files: string[] = [];
  fs.mkdirSync(appDir, { recursive: true });

  const packageJson = {
    name: 'vibeserve-generated',
    version: '1.0.0',
    scripts: { dev: 'vite', build: 'tsc && vite build', preview: 'vite preview' },
    dependencies: {
      react: '^19.0.0', 'react-dom': '^19.0.0',
      zustand: '^5.0.0',
      '@tailwindcss/vite': '^4.0.0',
      tailwindcss: '^4.0.0',
      'react-hot-toast': '^2.4.0',
    },
    devDependencies: {
      '@types/react': '^19.0.0', '@types/react-dom': '^19.0.0',
      '@vitejs/plugin-react': '^4.0.0',
      typescript: '~5.7.0',
      vite: '^6.0.0',
      eslint: '^9.0.0',
      '@typescript-eslint/eslint-plugin': '^8.0.0',
      '@typescript-eslint/parser': '^8.0.0',
    },
  };

  const pkgPath = path.join(appDir, 'package.json');
  fs.writeFileSync(pkgPath, JSON.stringify(packageJson, null, 2));
  files.push(pkgPath);

  const tsconfig = {
    compilerOptions: {
      target: 'ES2022', lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      module: 'ESNext', moduleResolution: 'bundler',
      jsx: 'react-jsx', strict: true, noEmit: true,
      skipLibCheck: true, isolatedModules: true,
      paths: { '@/*': ['./src/*'] },
    },
    include: ['src'],
  };
  const tsPath = path.join(appDir, 'tsconfig.json');
  fs.writeFileSync(tsPath, JSON.stringify(tsconfig, null, 2));
  files.push(tsPath);

  const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});
`;
  const vitePath = path.join(appDir, 'vite.config.ts');
  fs.writeFileSync(vitePath, viteConfig);
  files.push(vitePath);

  const html = `<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>VibeServe App</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>`;
  const htmlPath = path.join(appDir, 'index.html');
  fs.writeFileSync(htmlPath, html);
  files.push(htmlPath);

  const eslint = { root: true, extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'], parser: '@typescript-eslint/parser', plugins: ['@typescript-eslint'], rules: {} };
  const eslintPath = path.join(appDir, '.eslintrc.json');
  fs.writeFileSync(eslintPath, JSON.stringify(eslint, null, 2));
  files.push(eslintPath);

  const srcDir = path.join(appDir, 'src');
  fs.mkdirSync(srcDir, { recursive: true });
  const mainTsx = `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
);
`;
  const mainPath = path.join(srcDir, 'main.tsx');
  fs.writeFileSync(mainPath, mainTsx);
  files.push(mainPath);

  const css = `@import "tailwindcss";\n`;
  const cssPath = path.join(srcDir, 'index.css');
  fs.writeFileSync(cssPath, css);
  files.push(cssPath);

  return { packageJson, tsconfig, viteConfig, files };
}

function validateFile(appDir: string, filePath: string): { valid: boolean; errors: string } {
  try {
    execSync(`npx tsc --noEmit`, { cwd: appDir, timeout: 15000, stdio: 'pipe' });
    return { valid: true, errors: '' };
  } catch (err: any) {
    const output = err.stdout?.toString() || err.stderr?.toString() || err.message || '';
    const lines = output.split('\n').filter((l: string) => l.includes(path.basename(filePath)));
    return { valid: false, errors: lines.join('\n').slice(0, 1000) };
  }
}

function eslintCheck(appDir: string): { valid: boolean; errors: string } {
  try {
    execSync(`npx eslint . --ext .ts,.tsx`, { cwd: appDir, timeout: 15000, stdio: 'pipe' });
    return { valid: true, errors: '' };
  } catch (err: any) {
    return { valid: false, errors: (err.stdout?.toString() || '').slice(0, 1000) };
  }
}

function parseManifest(architectOutput: string): FileManifestEntry[] {
  const files: FileManifestEntry[] = [];
  const pathRegex = /(?:^|[\s])(src\/[^\s`\]\)>,"']+\.[a-z]+|components\/[^\s`\]\)>,"']+\.[a-z]+|pages\/[^\s`\]\)>,"']+\.[a-z]+|stores\/[^\s`\]\)>,"']+\.[a-z]+|hooks\/[^\s`\]\)>,"']+\.[a-z]+|types\/[^\s`\]\)>,"']+\.[a-z]+|lib\/[^\s`\]\)>,"']+\.[a-z]+)/gim;
  let match;
  const seen = new Set<string>();
  while ((match = pathRegex.exec(architectOutput)) !== null) {
    const fp = match[1].replace(/['"]/g, '');
    if (!seen.has(fp) && !fp.includes('`')) {
      seen.add(fp);
      const ext = fp.split('.').pop() || '';
      let type: FileManifestEntry['type'] = 'component';
      if (fp.includes('/store')) type = 'store';
      else if (fp.includes('/hook') || fp.startsWith('hooks/')) type = 'hook';
      else if (fp.includes('/type') || fp.startsWith('types/')) type = 'type';
      else if (fp.includes('/page') || fp.startsWith('pages/')) type = 'page';
      else if (fp.includes('/lib') || fp.includes('/util')) type = 'util';
      else if (ext === 'css') type = 'style';
      files.push({ path: fp, type, dependsOn: [], description: '' });
    }
  }
  if (files.length === 0) {
    files.push(
      { path: 'src/App.tsx', type: 'component', dependsOn: [], description: 'Root component' },
      { path: 'src/index.css', type: 'style', dependsOn: [], description: 'Global styles' },
    );
  }
  return files;
}

function getLangTag(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.js': 'javascript',
    '.jsx': 'jsx',
    '.css': 'css',
    '.html': 'html',
    '.json': 'json',
  };
  return map[ext] || 'typescript';
}

async function generateFile(appDir: string, file: FileManifestEntry, architectOutput: string, existingFiles: string[]): Promise<{ status: 'green' | 'red'; issues: string[] }> {
  const issues: string[] = [];
  const filePath = path.join(appDir, file.path);

  let code = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const context = attempt > 1 && issues.length > 0 ? `\nFix these TypeScript errors:\n${issues.join('\n')}` : '';
      const prompt = `Generate the file ${file.path} (${file.type})${file.description ? `: ${file.description}` : ''}.${context}\n\nArchitecture context:\n${architectOutput.slice(0, 3000)}\n\nOutput ONLY the code block:\n\`\`\`${getLangTag(file.path)}\n// code\n\`\`\``;

      code = await callAIWithRetry({
        systemPrompt: `You generate production-ready ${file.type} code. TypeScript, strict mode, no any. Output only code, no explanations.`,
        userPrompt: prompt,
        maxTokens: 2000,
        model: 'mimo-v2-pro',
        retries: 1,
      });

      const codeMatch = code.match(/```[\w]*\n([\s\S]*?)```/);
      if (codeMatch) code = codeMatch[1].trim();

      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, code);

      const validation = validateFile(appDir, filePath);
      if (validation.valid) {
        return { status: 'green', issues: [] };
      }
      issues.push(validation.errors);
    } catch (err: any) {
      issues.push(`Attempt ${attempt}: ${err.message}`);
    }
  }

  return { status: 'red', issues };
}

async function executePipeline(id: string, appDir: string, intent: string): Promise<void> {
  const pipeline = activePipelines.get(id);
  const ctx = pipelineContexts.get(id) || {};
  if (!pipeline) return;

  const updateStep = (stepIndex: number, status: 'pending' | 'running' | 'done' | 'error', detail: string) => {
    const step = pipeline.steps[stepIndex];
    if (step) {
      step.status = status;
      step.detail = detail;
    }
  };

  // Step 0: Scaffold
  updateStep(0, 'running', 'Scaffolding project...');
  try {
    const scaffold = scaffoldProject(appDir, intent);
    pipeline.files = scaffold.files.map(f => ({ path: f, status: 'green' as const, issues: [] }));
    updateStep(0, 'done', `Scaffolded ${scaffold.files.length} config files`);
  } catch (err: any) {
    updateStep(0, 'error', err.message);
    pipeline.complete = true;
    return;
  }

  // Step 1: Architect
  updateStep(1, 'running', 'Generating architecture plan...');
  try {
    const archOutput = await callAIWithRetry({
      systemPrompt: 'You are a senior software architect. Design detailed technical architectures. Output structured plans with sections: Component Tree, Data Flow, API Routes, Database Schema, File Structure. Use markdown.',
      userPrompt: `Design a detailed technical architecture for: ${intent}. Include: component tree, data flow, API routes, database schema, file structure. Output a structured plan.`,
      maxTokens: 2000,
      model: 'mimo-v2-pro',
    });
    ctx.architect_output = archOutput;
    updateStep(1, 'done', `Architecture generated (${archOutput.length} chars)`);
  } catch (err: any) {
    updateStep(1, 'error', err.message);
    pipeline.complete = true;
    return;
  }

  // Step 2: Parse manifest
  updateStep(2, 'running', 'Parsing file manifest...');
  const manifest = parseManifest(ctx.architect_output || '');
  ctx.manifest = JSON.stringify(manifest);
  updateStep(2, 'done', `Parsed ${manifest.length} files from architecture`);

  // Step 3: Generate files
  updateStep(3, 'running', 'Generating files...');
  for (let i = 0; i < manifest.length; i++) {
    const file = manifest[i];
    updateStep(3, 'running', `Generating ${file.path} (${i + 1}/${manifest.length})...`);
    const result = await generateFile(appDir, file, ctx.architect_output || '', pipeline.files.map(f => f.path));
    pipeline.files.push({ path: file.path, status: result.status, issues: result.issues });
  }
  const greenCount = pipeline.files.filter(f => f.status === 'green').length;
  const redCount = pipeline.files.filter(f => f.status === 'red').length;
  updateStep(3, 'done', `Generated ${greenCount} files (${redCount} with issues)`);

  // Step 4: Validate
  updateStep(4, 'running', 'Running TypeScript + ESLint validation...');
  const tsResult = validateFile(appDir, path.join(appDir, 'src', 'main.tsx'));
  const esResult = eslintCheck(appDir);
  if (tsResult.valid && esResult.valid) {
    updateStep(4, 'done', 'All checks passed');
  } else {
    updateStep(4, 'done', 'Validation issues found');
    pipeline.files.push({ path: '_validation', status: 'red', issues: [tsResult.errors, esResult.errors].filter(Boolean) });
  }

  // Step 5: Install deps
  updateStep(5, 'running', 'Installing dependencies...');
  try {
    execSync('npm install', { cwd: appDir, timeout: 120000, stdio: 'pipe' });
    updateStep(5, 'done', 'Dependencies installed');
  } catch (err: any) {
    updateStep(5, 'error', `npm install failed: ${err.message}`);
    pipeline.complete = true;
    return;
  }

  pipeline.complete = true;
}

export function registerAIRoutes(app: any) {
  app.post('/api/ai/chat', async (c: any) => {
    const { message, mode } = await c.req.json();
    const apiKey = process.env.OPENCODE_API_KEY || process.env.VITE_OPENCODE_API_KEY;

    if (!apiKey) {
      return c.json({ response: 'No API key configured. Add OPENCODE_API_KEY to .env.local' });
    }

    try {
      const res = await fetch('https://opencode.ai/zen/go/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'mimo-v2-pro',
          messages: [
            { role: 'system', content: 'You are VibeServe, an AI coding assistant that builds production-ready full-stack applications. Respond concisely with actionable plans.' },
            { role: 'user', content: message },
          ],
          max_tokens: 500,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return c.json({ response: `API error (${res.status}): ${err.slice(0, 200)}` });
      }

      const data = await res.json();
      const msg = data.choices?.[0]?.message;
      const content = msg?.content || msg?.reasoning_content || 'No response from model';
      return c.json({ response: content });
    } catch (err: any) {
      return c.json({ response: `Failed to connect to OpenCode Go API: ${err.message}` });
    }
  });

  app.post('/api/ai/transform', async (c: any) => {
    const { code, instruction } = await c.req.json();
    const apiKey = process.env.OPENCODE_API_KEY || process.env.VITE_OPENCODE_API_KEY;
    if (!apiKey) return c.json({ result: code });

    try {
      const res = await fetch('https://opencode.ai/zen/go/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'mimo-v2-pro',
          messages: [
            { role: 'system', content: 'You transform code. Return ONLY the transformed code, no explanations.' },
            { role: 'user', content: `Transform this code: "${instruction}"\n\n\`\`\`\n${code}\n\`\`\`\n\nReturn only the transformed code.` },
          ],
          max_tokens: 1000,
        }),
      });
      if (!res.ok) return c.json({ result: code });
      const data = await res.json();
      const msg = data.choices?.[0]?.message;
      return c.json({ result: msg?.content || msg?.reasoning_content || code });
    } catch {
      return c.json({ result: code });
    }
  });

  app.post('/api/ai/complete', async (c: any) => {
    const { prefix } = await c.req.json();
    return c.json({ suggestion: null });
  });

  app.post('/api/ai/explain', async (c: any) => {
    const { code } = await c.req.json();
    return c.json({ explanation: `This appears to be: ${typeof code === 'string' ? code.slice(0, 50) : 'code'}...` });
  });

  app.get('/api/pipeline/status', (c: any) => {
    const pipelines = Array.from(activePipelines.values());
    const latest = pipelines[pipelines.length - 1];
    if (!latest) return c.json({ steps: [], complete: false, files: [] });

    if (latest.complete && Date.now() - latest.startedAt > 30000) {
      activePipelines.delete(latest.id);
      pipelineContexts.delete(latest.id);
    }

    return c.json({
      steps: latest.steps,
      complete: latest.complete,
      intent: latest.intent,
      pipelineId: latest.id,
      files: latest.files,
    });
  });

  app.post('/api/pipeline/run', async (c: any) => {
    const { intent } = await c.req.json();
    const id = `pipe_${Date.now()}`;
    const appDir = path.resolve(GENERATED_BASE, id);

    const pipeline: PipelineState = {
      id, intent, startedAt: Date.now(),
      steps: PIPELINE_STEP_ORDER.map(sid => ({ id: sid, status: 'pending' as const, detail: '' })),
      complete: false,
      files: [],
    };
    activePipelines.set(id, pipeline);
    pipelineContexts.set(id, {});

    executePipeline(id, appDir, intent).catch(err => {
      console.error(`[Pipeline ${id}] Fatal error:`, err);
      const p = activePipelines.get(id);
      if (p) {
        p.complete = true;
        const running = p.steps.find(s => s.status === 'running');
        if (running) { running.status = 'error'; running.detail = err.message; }
      }
    });

    return c.json({ status: 'started', intent, pipelineId: id });
  });
}
