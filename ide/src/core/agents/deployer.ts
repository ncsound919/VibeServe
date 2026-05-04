import { existsSync, writeFileSync, readFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { logger } from '../../lib/logger';
import type { DeployConfig, DeployResult, DeployAvailability, DeployTarget } from './deployerTypes';
import { safeExec, safeExecLegacy } from '../../lib/safeShell';

const CTX = 'Deployer';

export function checkDeployAvailability(): DeployAvailability {
  const avail: DeployAvailability = {
    docker: false,
    vercel: false,
    netlify: false,
    zip: true,
  };

  try {
    safeExec('docker', ['--version'], { timeout: 5000 });
    avail.docker = true;
  } catch {}

  try {
    safeExec('vercel', ['--version'], { timeout: 5000 });
    avail.vercel = true;
  } catch {}

  try {
    safeExec('netlify', ['--version'], { timeout: 5000 });
    avail.netlify = true;
  } catch {}

  return avail;
}

export async function deploy(config: DeployConfig): Promise<DeployResult> {
  logger.info(CTX, `Deploying ${config.appName} to ${config.target}`);

  const safeDir = path.resolve(config.appDir);
  if (!existsSync(safeDir)) {
    return { success: false, target: config.target, logs: [], error: `App directory does not exist: ${safeDir}` };
  }
  config.appDir = safeDir;

  switch (config.target) {
    case 'docker': return deployDocker(config);
    case 'vercel': return deployVercel(config);
    case 'netlify': return deployNetlify(config);
    case 'zip': return deployZip(config);
    default: return { success: false, target: config.target, logs: [], error: `Unknown target: ${config.target}` };
  }
}

function generateDockerfile(config: DeployConfig): string {
  const hasServer = existsSync(path.join(config.appDir, 'server', 'src', 'index.ts'));
  const hasClient = existsSync(path.join(config.appDir, 'client', 'package.json'));

  if (hasServer && hasClient) {
    return `FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
COPY client/package*.json client/
COPY server/package*.json server/
RUN npm install

COPY . .

RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/package*.json ./
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/package*.json ./server/
COPY --from=build /app/node_modules ./node_modules

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server/dist/index.js"]
`;
  }

  if (hasServer) {
    return `FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/package*.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules

ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/index.js"]
`;
  }

  return `FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
}

function generateDockerCompose(config: DeployConfig): string {
  const port = config.port || 3000;
  return `version: '3.8'

services:
  app:
    build: .
    ports:
      - "${port}:${port}"
    environment:
      - NODE_ENV=production
${Object.entries(config.env || {}).map(([k, v]) => `      - ${k}=${v}`).join('\n')}
    restart: unless-stopped
`;
}

function generateNginxConf(config: DeployConfig): string {
  return `server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
`;
}

function generateVercelConfig(config: DeployConfig): string {
  const isSPA = existsSync(path.join(config.appDir, 'index.html')) ||
    existsSync(path.join(config.appDir, 'client', 'index.html'));

  if (isSPA) {
    return JSON.stringify({
      buildCommand: 'npm run build',
      outputDirectory: config.appDir.includes('client') ? 'client/dist' : 'dist',
      framework: 'vite',
      rewrites: [{ source: '/(.*)', destination: '/index.html' }],
    }, null, 2);
  }

  return JSON.stringify({
    buildCommand: 'npm run build',
    outputDirectory: 'dist',
    framework: 'vite',
    rewrites: [{ source: '/(.*)', destination: '/index.html' }],
  }, null, 2);
}

function generateNetlifyConfig(config: DeployConfig): string {
  const isSPA = existsSync(path.join(config.appDir, 'index.html')) ||
    existsSync(path.join(config.appDir, 'client', 'index.html'));

  if (isSPA) {
    return `[build]
  command = "npm run build"
  publish = "${config.appDir.includes('client') ? 'client/dist' : 'dist'}"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`;
  }

  return `[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`;
}

async function deployDocker(config: DeployConfig): Promise<DeployResult> {
  const logs: string[] = [];

  try {
    const dockerfile = generateDockerfile(config);
    const dockerPath = path.join(config.appDir, 'Dockerfile');
    writeFileSync(dockerPath, dockerfile, 'utf-8');
    logs.push('[DOCKER] Dockerfile generated');

    const compose = generateDockerCompose(config);
    const composePath = path.join(config.appDir, 'docker-compose.yml');
    writeFileSync(composePath, compose, 'utf-8');
    logs.push('[DOCKER] docker-compose.yml generated');

    if (!existsSync(path.join(config.appDir, 'nginx.conf')) &&
        !existsSync(path.join(config.appDir, 'server', 'src', 'index.ts'))) {
      const nginxConf = generateNginxConf(config);
      writeFileSync(path.join(config.appDir, 'nginx.conf'), nginxConf, 'utf-8');
      logs.push('[DOCKER] nginx.conf generated');
    }

    try {
      safeExec('docker', ['build', '-t', 'nexus-app', '.'], {
        cwd: config.appDir, timeout: 120000,
        maxBuffer: 5 * 1024 * 1024,
      });
      logs.push('[DOCKER] Docker image built successfully');
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 200) : 'unknown';
      logs.push(`[DOCKER] Docker build failed (may be rate-limited or Docker not running): ${msg}`);
    }

    return {
      success: true,
      target: 'docker',
      logs,
      configPath: path.join(config.appDir, 'docker-compose.yml'),
    };
  } catch (err) {
    return {
      success: false,
      target: 'docker',
      logs,
      error: err instanceof Error ? err.message : 'Docker deployment failed',
    };
  }
}

async function deployVercel(config: DeployConfig): Promise<DeployResult> {
  const logs: string[] = [];

  try {
    const vercelConfig = generateVercelConfig(config);
    const vercelPath = path.join(config.appDir, 'vercel.json');
    writeFileSync(vercelPath, vercelConfig, 'utf-8');
    logs.push('[VERCEL] vercel.json generated');

    try {
      const output = safeExecLegacy('vercel --prod --yes 2>&1', {
        cwd: config.appDir, timeout: 180000,
        maxBuffer: 5 * 1024 * 1024,
      });

      const urlMatch = output.match(/https?:\/\/[^\s]+/);
      const deployUrl = urlMatch ? urlMatch[0] : undefined;

      logs.push('[VERCEL] Deployed to Vercel');
      return { success: true, target: 'vercel', logs, url: deployUrl, configPath: vercelPath };
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 200) : 'unknown';
      logs.push(`[VERCEL] Vercel CLI not authenticated or unavailable. Run \`vercel login\` first.`);
      logs.push(`[VERCEL] Config ready at: ${vercelPath}`);

      return {
        success: false,
        target: 'vercel',
        logs,
        configPath: vercelPath,
        error: msg,
      };
    }
  } catch (err) {
    return {
      success: false,
      target: 'vercel',
      logs,
      error: err instanceof Error ? err.message : 'Vercel deployment failed',
    };
  }
}

async function deployNetlify(config: DeployConfig): Promise<DeployResult> {
  const logs: string[] = [];

  try {
    const netlifyToml = generateNetlifyConfig(config);
    const tomlPath = path.join(config.appDir, 'netlify.toml');
    writeFileSync(tomlPath, netlifyToml, 'utf-8');
    logs.push('[NETLIFY] netlify.toml generated');

    try {
      safeExecLegacy('netlify deploy --prod --dir=dist 2>&1', {
        cwd: config.appDir, timeout: 180000,
        maxBuffer: 5 * 1024 * 1024,
      });
      logs.push('[NETLIFY] Deployed to Netlify');
      return { success: true, target: 'netlify', logs, configPath: tomlPath };
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 200) : 'unknown';
      logs.push('[NETLIFY] Netlify CLI not authenticated or unavailable. Run `netlify login` first.');
      logs.push(`[NETLIFY] Config ready at: ${tomlPath}`);

      return { success: false, target: 'netlify', logs, configPath: tomlPath, error: msg };
    }
  } catch (err) {
    return {
      success: false,
      target: 'netlify',
      logs,
      error: err instanceof Error ? err.message : 'Netlify deployment failed',
    };
  }
}

async function deployZip(config: DeployConfig): Promise<DeployResult> {
  const logs: string[] = [];
  const outputDir = path.resolve(process.cwd(), 'uploads', 'deployments');
  mkdirSync(outputDir, { recursive: true });

  const slug = config.appName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  const zipName = `${slug}.zip`;
  const zipPath = path.join(outputDir, zipName);

  try {
    const isWin = process.platform === 'win32';

    if (isWin) {
      safeExec('powershell', [
        '-Command', 
        `Compress-Archive -Path '${config.appDir.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`
      ], { timeout: 60000 });
    } else {
      safeExec('tar', ['-czf', zipPath, '--directory', config.appDir, '--exclude=node_modules', '.'], {
        timeout: 60000,
      });
    }

    const stats = statSync(zipPath);
    logs.push(`[ZIP] Created ${zipName} (${(stats.size / 1024).toFixed(0)}KB) — ${zipPath}`);
    logs.push('[ZIP] Ready to download — extract and run `npm install && npm run build`');

    return { success: true, target: 'zip', logs, zipPath };
  } catch (err) {
    logs.push(`[ZIP] Could not create archive: ${err instanceof Error ? err.message.slice(0, 100) : 'unknown'}`);
    logs.push('[ZIP] Files ready for manual packaging at: ' + config.appDir);
    return {
      success: false,
      target: 'zip',
      logs,
      error: err instanceof Error ? err.message : 'ZIP creation failed',
    };
  }
}
