import type { GeneratedFile } from '../types';

export function getMcpToolkitTemplate(projectName: string): GeneratedFile[] {
  const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'my-mcp';

  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        name: slug,
        version: '0.0.1',
        type: 'module',
        main: 'dist/index.js',
        bin: {
          [slug]: './dist/index.js',
        },
        scripts: {
          build: 'tsc',
          start: 'node dist/index.js',
          dev: 'tsx src/index.ts',
        },
        mcp: {
          command: 'node',
          args: ['dist/index.js'],
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
          sourceMap: true,
        },
        include: ['src'],
        exclude: ['node_modules', 'dist'],
      }, null, 2),
    },
    {
      path: 'src/index.ts',
      content: `import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { readdir } from 'fs/promises'
import { join } from 'path'

const server = new McpServer({
  name: '${projectName}',
  version: '0.0.1',
})

server.tool(
  'echo',
  'Echo back the given message exactly as provided.',
  { message: z.string().describe('The message to echo back') },
  async ({ message }) => ({
    content: [{ type: 'text' as const, text: message }],
  }),
)

server.tool(
  'get_time',
  'Get the current date and time in ISO 8601 format.',
  {},
  async () => ({
    content: [{ type: 'text' as const, text: new Date().toISOString() }],
  }),
)

server.tool(
  'search_files',
  'Search for files matching a glob-like name pattern within a directory.',
  {
    directory: z.string().describe('Absolute path to the directory to search'),
    pattern: z.string().describe('A substring or simple glob to match file names against'),
    recursive: z.boolean().default(false).describe('Whether to search subdirectories recursively'),
  },
  async ({ directory, pattern, recursive }) => {
    const results: string[] = []

    async function scan(dir: string) {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (entry.isFile() && entry.name.toLowerCase().includes(pattern.toLowerCase())) {
          results.push(fullPath)
        }
        if (recursive && entry.isDirectory()) {
          await scan(fullPath)
        }
      }
    }

    await scan(directory)
    const text = results.length > 0
      ? results.join('\\n')
      : \`No files matching "\${pattern}" found in \${directory}\`
    return { content: [{ type: 'text' as const, text }] }
  },
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('${projectName} MCP server running on stdio')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
`,
    },
    {
      path: 'README.md',
      content: `# ${projectName}

A Model Context Protocol (MCP) server built with TypeScript and the official \`@modelcontextprotocol/sdk\`.

## Tools

| Tool | Description |
|------|-------------|
| \`echo\` | Echo back the given message exactly as provided. |
| \`get_time\` | Get the current date and time in ISO 8601 format. |
| \`search_files\` | Search for files matching a pattern within a directory. |

## Setup

\`\`\`bash
npm install
npm run build
\`\`\`

## Configuration

### Claude Desktop

Add to your \`claude_desktop_config.json\`:

\`\`\`json
{
  "mcpServers": {
    "${slug}": {
      "command": "node",
      "args": ["${process.cwd() === '/' ? '' : '/'}path/to/${slug}/dist/index.js"]
    }
  }
}
\`\`\`

### Claude Code / OpenCode

Add to \`.mcp.json\` or your CLI MCP config:

\`\`\`json
{
  "mcpServers": {
    "${slug}": {
      "type": "stdio",
      "command": "node",
      "args": ["dist/index.js"]
    }
  }
}
\`\`\`

## Development

\`\`\`bash
npm run dev
\`\`\`

## Adding a New Tool

1. Add a \`server.tool()\` call in \`src/index.ts\`
2. Use \`zod\` to define the input schema
3. Implement the handler function
4. Run \`npm run build\` and restart the MCP connection
`,
    },
  ];
}
