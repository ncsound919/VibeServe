import type { TemplateConfig, FileSpec } from './types';
export interface Tpl { id: string; name: string; description: string; keywords: string[]; estimatedBuildTime: number; dependencies: string[]; devDependencies: string[]; scripts: Record<string,string>; files: FileSpec[] }
const registry: Tpl[] = [
  { id: 'react-ts-vite', name: 'React TypeScript (Vite)', description: 'React + TypeScript with Vite bundler', keywords: ['react', 'typescript', 'vite', 'frontend'], estimatedBuildTime: 45, dependencies: ['react', 'react-dom'], devDependencies: ['vite', '@vitejs/plugin-react', 'typescript', '@types/react', '@types/react-dom'], scripts: { dev: 'vite', build: 'tsc && vite build', preview: 'vite preview' }, files: [
    { path: 'index.html', content: '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>App</title></head><body><div id="root"></div></body></html>' },
    { path: 'src/main.tsx', content: "import{createRoot}from'react-dom/client';createRoot(document.getElementById('root')!).render(<App/>);" },
    { path: 'src/App.tsx', content: "export default function App(){return<h1>Hello Nexus Alpha</h1>;}" },
    { path: 'src/App.css', content: '' },
    { path: 'vite.config.ts', content: "import{defineConfig}from'vite';export default defineConfig({plugins:[]});" },
    { path: 'tsconfig.json', content: '{"compilerOptions":{"target":"ES20","lib":["ES20","DOM"],"jsx":"react-jsx","module":"ESNext","moduleResolution":"bundler","strict":true},"include":["src"]}' },
  ] },
  { id: 'express-api', name: 'Express API', description: 'Node/Express REST API', keywords: ['express', 'api', 'node', 'backend', 'rest'], estimatedBuildTime: 30, dependencies: ['express'], devDependencies: ['typescript', '@types/express', '@types/node', 'tsx'], scripts: { dev: 'tsx watch src/index.ts', build: 'tsc', start: 'node dist/index.js' }, files: [
    { path: 'src/index.ts', content: "import express from 'express';const app=express();app.use(express.json());app.get('/health',(_,r)=>r.json({ok:true}));app.listen(3000,()=>console.log('on :3000'));" },
    { path: 'src/routes/health.ts', content: "import{Router}from'express';const r=Router();r.get('/',(_,res)=>res.json({ok:true}));export default r;" },
    { path: 'tsconfig.json', content: '{"compilerOptions":{"target":"ES20","module":"NodeNext","moduleResolution":"NodeNext","strict":true}}' },
  ] },
  { id: 'fullstack', name: 'Fullstack (React + Express)', description: 'React + Express', keywords: ['fullstack', 'saas', 'frontend', 'backend'], estimatedBuildTime: 60, dependencies: ['express', 'react', 'react-dom'], devDependencies: ['vite', 'typescript', '@types/express', 'tsx'], scripts: { dev: 'concurrently "vite" "tsx watch server/src/index.ts"', build: 'npm run build:client && npm run build:server' }, files: [] },
  { id: 'node-api', name: 'Node API', description: 'Pure Node/TypeScript', keywords: ['node', 'api', 'rest'], estimatedBuildTime: 25, dependencies: [], devDependencies: ['typescript', '@types/node', 'tsx'], scripts: { dev: 'tsx watch src/index.ts', build: 'tsc', start: 'node dist/index.js' }, files: [{ path: 'src/index.ts', content: "console.log('Hello Nexus Alpha');" }] },
  { id: 'vanilla-ts', name: 'Vanilla TypeScript', description: 'Pure TypeScript CLI', keywords: ['typescript', 'vanilla', 'cli'], estimatedBuildTime: 20, dependencies: [], devDependencies: ['typescript', '@types/node', 'tsx'], scripts: { dev: 'tsx watch src/index.ts', build: 'tsc', start: 'node dist/index.js' }, files: [{ path: 'src/index.ts', content: "console.log('Hello Nexus Alpha');" }] },
];
export function getTemplateForDescription(desc: string): Tpl { const kw = desc.toLowerCase(); const scored = registry.map(t => ({ t, s: t.keywords.filter(k => kw.includes(k)).length })).sort((a, b) => b.s - a.s); return scored[0]?.s > 0 ? scored[0].t : registry[0]; }
export function listTemplates(): Tpl[] { return registry; }
