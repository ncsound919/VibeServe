/**
 * Brain Control Service - Server-side only
 * Proxies to the deterministic-brain FastAPI server and manages brain configuration.
 */

import { findBrainDir, isAvailable } from './brainToolService';

export interface BrainConfigPayload {
  lanes?: Record<string, { provider?: string; model?: string; enabled?: boolean }>;
  routerModel?: string;
}

export interface BrainStatusPayload {
  running: boolean;
  apiPort: number;
  pythonAvailable: boolean;
  brainDir: string | null;
  lastRun: string | null;
}

const BRAIN_API_PORT = Number(process.env.BRAIN_API_PORT ?? 8000);
const BRAIN_API_URL = `http://localhost:${BRAIN_API_PORT}`;

async function brainApiFetch<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${BRAIN_API_URL}${path}`, {
      signal: AbortSignal.timeout(5000),
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

export async function getBrainHealth(): Promise<{ status: string } | null> {
  return brainApiFetch('/health');
}

export async function getBrainConfigFromAPI(): Promise<Record<string, unknown> | null> {
  const health = await getBrainHealth();
  if (!health) return null;
  return health as Record<string, unknown>;
}

export async function getBrainStatus(): Promise<BrainStatusPayload> {
  const brainDir = findBrainDir();
  const pythonAvailable = isAvailable('python');
  const apiReachable = await getBrainHealth();
  return {
    running: !!apiReachable,
    apiPort: BRAIN_API_PORT,
    pythonAvailable,
    brainDir: brainDir ?? null,
    lastRun: null,
  };
}

export async function updateBrainConfig(config: BrainConfigPayload): Promise<boolean> {
  try {
    const res = await brainApiFetch('/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
    return res !== null;
  } catch {
    return false;
  }
}

export async function reloadBrain(): Promise<boolean> {
  try {
    const res = await brainApiFetch('/reload', { method: 'POST' });
    return res !== null;
  } catch {
    return false;
  }
}
