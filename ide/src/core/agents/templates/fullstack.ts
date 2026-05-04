import type { GeneratedFile } from '../types';

export function getFullstackTemplate(projectName: string): GeneratedFile[] {
  const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'my-app';

  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        name: slug,
        private: true,
        version: '0.0.1',
        scripts: {
        dev: 'concurrently "npm run dev:server" "npm run dev:client"',
          'dev:server': 'npm --workspace=server run dev',
          'dev:client': 'npm --workspace=client run dev',
          build: 'npm --workspace=client run build && npm --workspace=server run build',
        },
        workspaces: ['client', 'server', 'shared'],
      }, null, 2),
    },
    {
      path: 'client/package.json',
      content: JSON.stringify({
        name: 'client',
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
      path: 'client/tsconfig.json',
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
      path: 'client/vite.config.ts',
      content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
`,
    },
    {
      path: 'client/index.html',
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
      path: 'client/src/main.tsx',
      content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`,
    },
    {
      path: 'client/src/App.tsx',
      content: `import { useEffect, useState } from 'react'

function App() {
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setMessage(data.message))
      .catch(console.error)
  }, [])

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>${projectName}</h1>
      <p>Server says: {message}</p>
    </div>
  )
}

export default App
`,
    },
    {
      path: 'server/package.json',
      content: JSON.stringify({
        name: 'server',
        private: true,
        version: '0.0.1',
        type: 'module',
        scripts: {
          dev: 'tsx watch src/index.ts',
          build: 'tsc',
          start: 'node dist/index.js',
        },
      }, null, 2),
    },
    {
      path: 'server/tsconfig.json',
      content: JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          outDir: './dist',
          rootDir: './src',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
          declaration: true,
          sourceMap: true,
        },
        include: ['src'],
        exclude: ['node_modules', 'dist'],
      }, null, 2),
    },
    {
      path: 'server/src/index.ts',
      content: `import express from 'express'

const app = express()
const port = process.env.PORT || 3001

app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ message: '${projectName} API running', status: 'ok' })
})

app.listen(port, () => {
  console.log(\`Server listening on http://localhost:\${port}\`)
})
`,
    },
    {
      path: 'shared/tsconfig.json',
      content: JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          declaration: true,
          outDir: './dist',
        },
        include: ['src'],
      }, null, 2),
    },
  ];
}
