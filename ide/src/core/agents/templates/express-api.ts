import type { GeneratedFile } from '../types';

export function getExpressApiTemplate(projectName: string): GeneratedFile[] {
  const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'my-api';

  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        name: slug,
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
      path: 'tsconfig.json',
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
          declarationMap: true,
          sourceMap: true,
        },
        include: ['src'],
        exclude: ['node_modules', 'dist'],
      }, null, 2),
    },
    {
      path: 'src/index.ts',
      content: `import express from 'express'

const app = express()
const port = process.env.PORT || 3000

app.use(express.json())

app.get('/', (_req, res) => {
  res.json({ message: '${projectName} API', status: 'ok' })
})

app.listen(port, () => {
  console.log(\`Server running on http://localhost:\${port}\`)
})
`,
    },
    {
      path: 'src/routes/health.ts',
      content: `import { Router } from 'express'

const router = Router()

router.get('/', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() })
})

export default router
`,
    },
  ];
}
