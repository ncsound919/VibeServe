import * as path from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import type { TechStack, GeneratedFile } from '../types';

type AppSpecLike = { description: string };
type ScaffoldFn = (root: string, spec: AppSpecLike) => Promise<void> | void;

export interface TemplateDefinition {
  appType: string;
  name: string;
  description: string;
  defaultTechStack: Required<TechStack>;
  keywords?: string[];
  scaffold?: ScaffoldFn;
  getFiles: (description: string) => GeneratedFile[];
}

const reactTsViteTemplate: TemplateDefinition = {
  appType: 'react-ts-vite',
  name: 'React + Vite (TS)',
  description: 'A minimal React 18 + Vite + TypeScript frontend scaffold',
  defaultTechStack: {
    frontend: 'react',
    backend: 'none',
    database: 'none',
    css: 'css',
  },
  keywords: ['todo', 'frontend', 'dashboard', 'react', 'ui', 'app', 'landing', 'saas'],
  getFiles: () => [
    { path: 'index.html', content: '<!DOCTYPE html><html><body><div id="root"></div></body></html>' },
    { path: 'src/main.tsx', content: "import React from 'react';import{createRoot}from'react-dom/client';import{App}from'./App';const r=document.getElementById('root');if(r)createRoot(r).render(<App/>);" },
    { path: 'src/App.tsx', content: "export function App(){return <h1>Hello</h1>}" },
  ],
  scaffold: async (appRoot: string, spec: AppSpecLike) => {
    const srcDir = path.join(appRoot, 'src');
    const stylesDir = path.join(appRoot, 'src', 'styles');

    mkdirSync(srcDir, { recursive: true });
    mkdirSync(stylesDir, { recursive: true });

    // index.html
    writeFileSync(path.join(appRoot, 'index.html'),
`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Nexus Generated App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`);

    // main.tsx
    writeFileSync(path.join(srcDir, 'main.tsx'),
`import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/main.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    React.createElement(App, { description: ${JSON.stringify(spec.description)} })
  );
}`);

    // App.tsx — uses a proper React.FC with props so description is injected safely
    writeFileSync(path.join(srcDir, 'App.tsx'),
`import React from 'react';

interface AppProps {
  description?: string;
}

export const App: React.FC<AppProps> = ({ description }) => {
  return (
    <div style={{ padding: '24px', fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Nexus Generated App</h1>
      {description && (
        <p style={{ color: '#555', borderLeft: '4px solid #646cff', paddingLeft: '12px' }}>
          {description}
        </p>
      )}
    </div>
  );
};`);

    // gen-spec.ts — stores the generation prompt for traceability
    writeFileSync(path.join(srcDir, 'gen-spec.ts'),
`export const SPEC = {
  description: ${JSON.stringify(spec.description)},
  generatedAt: ${JSON.stringify(new Date().toISOString())},
  template: 'react-ts-vite',
} as const;
export type GenSpec = typeof SPEC;`);

    // main.css
    writeFileSync(path.join(stylesDir, 'main.css'),
`body {
  margin: 0;
  font-family: Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}`);

    // vite.config.ts
    writeFileSync(path.join(appRoot, 'vite.config.ts'),
`import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});`);

    // package.json
    writeFileSync(path.join(appRoot, 'package.json'), JSON.stringify({
      name: 'nexus-generated-app',
      version: '1.0.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
      },
      dependencies: {
        react: '^18.3.1',
        'react-dom': '^18.3.1',
      },
      devDependencies: {
        '@vitejs/plugin-react': '^4.3.4',
        typescript: '^5.7.3',
        vite: '^6.2.1',
        '@types/react': '^18.3.18',
        '@types/react-dom': '^18.3.5',
      },
    }, null, 2));

    // tsconfig.json
    writeFileSync(path.join(appRoot, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
      },
      include: ['src'],
    }, null, 2));
  },
};

const expressApiTemplate: TemplateDefinition = {
  appType: 'express-api',
  name: 'Express API (Node + TS)',
  description: 'A minimal Node.js + Express + TypeScript REST API scaffold',
  defaultTechStack: {
    frontend: 'none',
    backend: 'express',
    database: 'sqlite',
    css: 'none',
  },
  keywords: ['api', 'backend', 'server', 'express', 'rest', 'node'],
  getFiles: () => [
    { path: 'src/index.ts', content: "import express from 'express';const app=express();app.listen(3000);" },
  ],
  scaffold: async (appRoot: string, spec: AppSpecLike) => {
    const srcDir = path.join(appRoot, 'src');

    mkdirSync(srcDir, { recursive: true });

    writeFileSync(path.join(appRoot, 'package.json'), JSON.stringify({
      name: 'nexus-generated-api',
      version: '1.0.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'tsx watch src/index.ts',
        build: 'tsc',
        start: 'node dist/index.js',
      },
      dependencies: {
        express: '^4.21.2',
        cors: '^2.8.5',
      },
      devDependencies: {
        typescript: '^5.7.3',
        '@types/express': '^5.0.1',
        '@types/cors': '^2.8.17',
        tsx: '^4.19.3',
        'ts-node': '^10.9.2',
      },
    }, null, 2));

    writeFileSync(path.join(appRoot, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        outDir: 'dist',
        rootDir: 'src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        resolveJsonModule: true,
      },
      include: ['src'],
    }, null, 2));

    writeFileSync(path.join(srcDir, 'index.ts'),
`import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', description: ${JSON.stringify(spec.description)}, ts: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});`);

    writeFileSync(path.join(srcDir, 'gen-spec.ts'),
`export const SPEC = {
  description: ${JSON.stringify(spec.description)},
  generatedAt: ${JSON.stringify(new Date().toISOString())},
  template: 'express-api',
} as const;`);
  },
};

const fullstackTemplate: TemplateDefinition = {
  appType: 'fullstack',
  name: 'Full-Stack (React + Express + SQLite)',
  description: 'A full-stack React + Vite frontend with Express API and SQLite persistence',
  defaultTechStack: {
    frontend: 'react',
    backend: 'express',
    database: 'sqlite',
    css: 'css',
  },
  keywords: ['fullstack', 'saas', 'full-stack', 'database', 'sqlite', 'blog', 'ecommerce'],
  getFiles: () => [],
  scaffold: async (appRoot: string, spec: AppSpecLike) => {
    const clientDir = path.join(appRoot, 'client', 'src');
    const serverDir = path.join(appRoot, 'server', 'src');

    mkdirSync(clientDir, { recursive: true });
    mkdirSync(serverDir, { recursive: true });

    // Client package.json
    writeFileSync(path.join(appRoot, 'client', 'package.json'), JSON.stringify({
      name: 'nexus-client',
      version: '1.0.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite --port 5173',
        build: 'vite build',
      },
      dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
      devDependencies: {
        '@vitejs/plugin-react': '^4.3.4',
        typescript: '^5.7.3',
        vite: '^6.2.1',
        '@types/react': '^18.3.18',
        '@types/react-dom': '^18.3.5',
      },
    }, null, 2));

    writeFileSync(path.join(appRoot, 'client', 'vite.config.ts'),
`import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } } });`);

    writeFileSync(path.join(appRoot, 'client', 'index.html'),
`<!doctype html><html lang="en"><head><meta charset="UTF-8"/><title>Nexus App</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`);

    writeFileSync(path.join(clientDir, 'main.tsx'),
`import React from 'react';import{createRoot}from'react-dom/client';import{App}from'./App';const r=document.getElementById('root');if(r){createRoot(r).render(React.createElement(App));}`);
    writeFileSync(path.join(clientDir, 'App.tsx'),
`import React from 'react';export const App:React.FC=()=><div style={{padding:24,fontFamily:'Arial'}}><h1>Nexus App</h1><p>${spec.description.replace(/'/g, "\\'")}</p></div>;`);

    // Server package.json
    writeFileSync(path.join(appRoot, 'server', 'package.json'), JSON.stringify({
      name: 'nexus-server',
      version: '1.0.0',
      private: true,
      type: 'module',
      scripts: { dev: 'tsx watch src/index.ts', start: 'node dist/index.js' },
      dependencies: { express: '^4.21.2', cors: '^2.8.5' },
      devDependencies: { typescript: '^5.7.3', '@types/express': '^5.0.1', tsx: '^4.19.3' },
    }, null, 2));

    writeFileSync(path.join(serverDir, 'index.ts'),
`import express from 'express';const app=express();app.use(express.json());app.get('/api/health',(_req,res)=>res.json({ok:true,ts:new Date().toISOString()}));app.listen(3000,()=>console.log('API on :3000'));`);

    writeFileSync(path.join(appRoot, 'gen-spec.ts'),
`export const SPEC={description:${JSON.stringify(spec.description)},generatedAt:${JSON.stringify(new Date().toISOString())},template:'fullstack'};`);
  },
};

// Template registry — ordered by specificity (most specific first)
const REGISTRY: TemplateDefinition[] = [
  expressApiTemplate,
  fullstackTemplate,
  reactTsViteTemplate,
];

/**
 * Picks the best template for a given natural-language description.
 * Uses keyword matching with longest-match-wins semantics.
 */
export function getTemplateForDescription(description: string): TemplateDefinition {
  const lower = description.toLowerCase();
  const scores: Array<{ t: TemplateDefinition; score: number }> = [];

  for (const t of REGISTRY) {
    let score = 0;
    for (const kw of t.keywords ?? []) {
      if (lower.includes(kw)) score += kw.length;
    }
    scores.push({ t, score });
  }

  scores.sort((a, b) => b.score - a.score);
  return scores[0].t;
}

/** Lists all available template IDs and names */
export function listTemplates(): Array<{ appType: string; name: string; description: string }> {
  return REGISTRY.map(t => ({ appType: t.appType, name: t.name, description: t.description }));
}

export type { AppSpecLike };
