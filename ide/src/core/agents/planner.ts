import type { AppSpec, ArchitecturePlan, FileSpec } from './types';
import { generateText } from './llmClient';
export async function generatePlan(spec: AppSpec): Promise<ArchitecturePlan> {
  const tpl = (() => { const d = spec.description.toLowerCase(); if (d.includes('api') && d.includes('fullstack')) return 'fullstack'; if (d.includes('express') || d.includes('rest')) return 'express-api'; if (d.includes('fullstack') || d.includes('saas')) return 'fullstack'; if (d.includes('node') && !d.includes('react')) return 'node-ai'; return 'react-ts-vite'; })();
  const files: FileSpec[] = tpl === 'react-ts-vite' ? [
    { path: 'index.html', content: '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>App</title></head><body><div id="root"></div></body></html>' },
    { path: 'src/main.tsx', content: "import{createRoot}from'react-dom/client';createRoot(document.getElementById('root')!).render(<App/>);" },
    { path: 'src/App.tsx', content: "export default function App(){return<h1>Hello Nexus Alpha</h1>;}" },
    { path: 'src/App.css', content: '' },
    { path: 'vite.config.ts', content: "import{defineConfig}from'vite';export default defineConfig({plugins:[]});" },
    { path: 'tsconfig.json', content: '{"compilerOptions":{"target":"ES20","lib":["ES20","DOM"],"jsx":"react-jsx","module":"ESNext","moduleResolution":"bundler","strict":true},"include":["src"]}' },
  ] : [
    { path: 'src/index.ts', content: "import express from 'express';const app=express();app.use(express.json());app.get('/health',(_,r)=>r.json({ok:true}));app.listen(3000,()=>console.log('on :3000'));" },
    { path: 'src/routes/health.ts', content: "import{Router}from'express';const r=Router();r.get('/',(_,res)=>res.json({ok:true}));export default r;" },
    { path: 'tsconfig.json', content: '{"compilerOptions":{"target":"ES20","module":"NodeNext","moduleResolution":"NodeNext","strict":true}}' },
  ];
  const prompt = `Generate project spec for "${spec.description}" as valid JSON only (no markdown). Format:{"appType":"string","description":"string","files":[{"path":"string","content":"string"}],"dependencies":[],"devDependencies":[],"scripts":{}}`;
  try { const text = await generateText(prompt, { temperature: 0.3, maxTokens: 8000 }); const c = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim(); const i = c.indexOf('{'); const j = c.lastIndexOf('}'); if (i >= 0 && j > i) { const p = JSON.parse(c.slice(i, j + 1)) as ArchitecturePlan; return { ...p, appType: p.appType || tpl }; } } catch {}
  return { appType: tpl, description: spec.description, files, dependencies: tpl === 'react-ts-vite' ? ['react', 'react-dom'] : ['express'], devDependencies: ['typescript', 'tsx'], scripts: { dev: 'vite', build: 'tsc && vite build' } };
}
