/**
 * Nexus Local Infrastructure — Docker-free replacement for container services
 * Listens on the same ports as docker services (Qdrant:6333) with compatible APIs.
 * Auto-launched when Docker is unavailable.
 */

import http from 'http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { logger } from '../lib/logger';

// ─── Configuration ──────────────────────────────────────────────────────────

export interface LocalInfraStatus {
  qdrant: { running: boolean; port: number; vectors: number; collections: string[] };
  mode: 'local' | 'docker' | 'off';
  started: string;
}

let running = false;
let servers: http.Server[] = [];
let startTime = '';

// ─── In-memory Vector Store (mimics Qdrant API) ────────────────────────────

interface QdrantPoint {
  id: string | number;
  vector: number[];
  payload?: Record<string, unknown>;
}

interface QdrantCollection {
  name: string;
  vectors: { size: number; distance: string };
  points: Map<string | number, QdrantPoint>;
}

const collections = new Map<string, QdrantCollection>();

const DATA_DIR = path.resolve(process.cwd(), 'uploads', 'nexus', 'local-infra');
function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function persist() {
  ensureDir();
  const data: Record<string, { name: string; vectors: { size: number; distance: string }; points: QdrantPoint[] }> = {};
  for (const [name, col] of collections) {
    data[name] = { name: col.name, vectors: col.vectors, points: Array.from(col.points.values()) };
  }
  writeFileSync(path.join(DATA_DIR, 'qdrant.json'), JSON.stringify(data, null, 2), 'utf-8');
}

function load() {
  ensureDir();
  const file = path.join(DATA_DIR, 'qdrant.json');
  if (!existsSync(file)) return;
  try {
    const data = JSON.parse(readFileSync(file, 'utf-8'));
    for (const [name, col] of Object.entries(data)) {
      const c = col as any;
      const points = new Map<string | number, QdrantPoint>();
      if (c.points) for (const p of c.points) points.set(p.id, p);
      collections.set(name, { name, vectors: c.vectors, points });
    }
  } catch { /* ignore corrupt data */ }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] ** 2;
    magB += b[i] ** 2;
  }
  const mag = Math.sqrt(magA) * Math.sqrt(magB);
  return mag === 0 ? 0 : dot / mag;
}

// ─── Qdrant Mock Server ─────────────────────────────────────────────────────

function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function json(res: http.ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'http://localhost:3000' });
  res.end(JSON.stringify(data));
}

async function handleQdrantRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const parts = url.pathname.split('/').filter(Boolean);

  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // GET /health
    if (req.method === 'GET' && url.pathname === '/health') {
      json(res, 200, { ok: true, version: '1.12.5-local' });
      return;
    }

    // GET / - root
    if (req.method === 'GET' && url.pathname === '/') {
      json(res, 200, { title: 'qdrant - local mock' });
      return;
    }

    // GET /collections
    if (req.method === 'GET' && url.pathname === '/collections') {
      const result = Array.from(collections.keys()).map(name => ({
        name,
        status: 'green',
        vectors_count: collections.get(name)!.points.size,
      }));
      json(res, 200, { result, status: 'ok', time: Date.now() });
      return;
    }

    // PUT /collections/{name}
    if (req.method === 'PUT' && parts.length === 2 && parts[0] === 'collections') {
      const body = await parseBody(req);
      const name = parts[1];
      const vectorSize = body.vectors?.size || body.vector_size || 384;
      collections.set(name, { name, vectors: { size: vectorSize, distance: 'Cosine' }, points: new Map() });
      json(res, 200, { result: true, status: 'ok', time: Date.now() });
      persist();
      return;
    }

    // DELETE /collections/{name}
    if (req.method === 'DELETE' && parts.length === 2 && parts[0] === 'collections') {
      collections.delete(parts[1]);
      json(res, 200, { result: true, status: 'ok', time: Date.now() });
      persist();
      return;
    }

    // PUT /collections/{name}/points?wait=true
    if (req.method === 'PUT' && parts.length === 3 && parts[0] === 'collections' && parts[2] === 'points') {
      const body = await parseBody(req);
      const col = collections.get(parts[1]);
      if (!col) { json(res, 404, { status: 'error', error: 'Collection not found' }); return; }
      const batch = body.batch || body.points || [];
      for (const point of batch) {
        const id = point.id ?? point.idx;
        col.points.set(id, { id, vector: point.vector, payload: point.payload });
      }
      const count = batch.length;
      json(res, 200, { result: { operation_id: Date.now(), status: 'completed' }, status: 'ok', time: Date.now() });
      persist();
      return;
    }

    // POST /collections/{name}/points/search
    if (req.method === 'POST' && parts.length === 4 && parts[0] === 'collections' && parts[2] === 'points' && parts[3] === 'search') {
      const body = await parseBody(req);
      const col = collections.get(parts[1]);
      if (!col) { json(res, 404, { status: 'error', error: 'Collection not found' }); return; }

      const queryVector = body.vector;
      const limit = body.limit || 10;
      const results: Array<{ id: string | number; score: number; payload?: Record<string, unknown>; version: number }> = [];

      if (queryVector) {
        const scored: Array<{ id: string | number; score: number; payload?: Record<string, unknown> }> = [];
        for (const point of col.points.values()) {
          if (point.vector && point.vector.length > 0) {
            const score = cosineSimilarity(queryVector, point.vector);
            scored.push({ id: point.id, score, payload: point.payload });
          }
        }
        scored.sort((a, b) => b.score - a.score);
        for (const s of scored.slice(0, limit)) {
          results.push({ ...s, version: 0 });
        }
      }

      json(res, 200, { result: results, status: 'ok', time: Date.now() });
      return;
    }

    // GET /collections/{name} - collection info
    if (req.method === 'GET' && parts.length === 2 && parts[0] === 'collections') {
      const col = collections.get(parts[1]);
      if (!col) { json(res, 404, { status: 'error', error: 'Not found' }); return; }
      json(res, 200, {
        result: {
          name: col.name,
          status: 'green',
          vectors_count: col.points.size,
          config: { params: { vectors: { size: col.vectors.size, distance: col.vectors.distance } } },
        },
        status: 'ok',
        time: Date.now(),
      });
      return;
    }

    // Fallback (Qdrant returns 404 for unknown routes)
    json(res, 404, { status: 'error', error: `Not found: ${req.method} ${url.pathname}` });
  } catch (e: any) {
    json(res, 500, { status: 'error', error: e.message });
  }
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

function createServer(port: number, handler: http.RequestListener): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logger.warn('LocalInfra', `Port ${port} in use — skipping (likely Docker running)`);
        resolve(server);
      } else {
        reject(err);
      }
    });
    server.listen(port, '127.0.0.1', () => {
      logger.info('LocalInfra', `Qdrant mock listening on 127.0.0.1:${port}`);
      resolve(server);
    });
  });
}

export async function start(): Promise<LocalInfraStatus> {
  if (running) return getStatus();

  load();
  startTime = new Date().toISOString();

  try {
    const qdrantServer = await createServer(6333, handleQdrantRequest);
    servers.push(qdrantServer);

    running = true;

    logger.info('LocalInfra', 'Local infrastructure started (mock services on standard ports)');
  } catch (e: any) {
    logger.error('LocalInfra', 'Failed to start local infrastructure', { error: e.message });
  }

  return getStatus();
}

export function stop() {
  for (const server of servers) {
    try { server.close(); } catch { /* ignore */ }
  }
  servers = [];
  running = false;
  logger.info('LocalInfra', 'Local infrastructure stopped');
}

export function getStatus(): LocalInfraStatus {
  const collectionList = Array.from(collections.keys());
  const totalVectors = Array.from(collections.values()).reduce((sum, col) => sum + col.points.size, 0);

  return {
    qdrant: {
      running,
      port: 6333,
      vectors: totalVectors,
      collections: collectionList,
    },
    mode: running ? 'local' : 'off',
    started: startTime,
  };
}

// Auto-start module
start();
