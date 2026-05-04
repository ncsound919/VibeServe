import type { GeneratedFile } from '../types';

export function getReactTsViteTemplate(projectName: string): GeneratedFile[] {
  const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'my-app';

  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        name: slug,
        private: true,
        version: '0.0.1',
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'tsc -b && vite build',
          preview: 'vite preview',
        },
      }, null, 2),
    },
    {
      path: 'tsconfig.json',
      content: JSON.stringify({
        compilerOptions: {
          tsBuildInfoFile: './node_modules/.tmp/tsconfig.app.tsbuildinfo',
          target: 'ES2020',
          useDefineForClassFields: true,
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          skipLibCheck: true,
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          isolatedModules: true,
          moduleDetection: 'force',
          noEmit: true,
          jsx: 'react-jsx',
          strict: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          noFallthroughCasesInSwitch: true,
          noUncheckedSideEffectImports: true,
        },
        include: ['src'],
      }, null, 2),
    },
    {
      path: 'tsconfig.app.json',
      content: JSON.stringify({
        extends: './tsconfig.json',
        compilerOptions: {
          tsBuildInfoFile: './node_modules/.tmp/tsconfig.app.tsbuildinfo',
        },
        include: ['src'],
      }, null, 2),
    },
    {
      path: 'tsconfig.node.json',
      content: JSON.stringify({
        compilerOptions: {
          tsBuildInfoFile: './node_modules/.tmp/tsconfig.node.tsbuildinfo',
          target: 'ES2022',
          lib: ['ES2023'],
          module: 'ESNext',
          skipLibCheck: true,
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          isolatedModules: true,
          moduleDetection: 'force',
          noEmit: true,
          strict: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          noFallthroughCasesInSwitch: true,
          noUncheckedSideEffectImports: true,
        },
        include: ['vite.config.ts'],
      }, null, 2),
    },
    {
      path: 'vite.config.ts',
      content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`,
    },
    {
      path: 'index.html',
      content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    },
    {
      path: 'src/vite-env.d.ts',
      content: `/// <reference types="vite/client" />
`,
    },
    {
      path: 'src/main.tsx',
      content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`,
    },
    {
      path: 'src/App.tsx',
      content: `import './App.css'

function App() {
  return (
    <div className="app">
      <h1>${projectName}</h1>
    </div>
  )
}

export default App
`,
    },
    {
      path: 'src/App.css',
      content: `#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
}

.app {
  text-align: center;
}

h1 {
  font-size: 2rem;
  color: #333;
}
`,
    },
    {
      path: 'src/index.css',
      content: `*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  line-height: 1.6;
  color: #333;
  background: #fff;
}
`,
    },
  ];
}
