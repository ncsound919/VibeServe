import { logger } from '../../lib/logger';

const CTX = 'OllamaProvider';

const OLLAMA_HOST = typeof process !== 'undefined' ? (process.env.OLLAMA_HOST || 'http://localhost:11434') : 'http://localhost:11434';

interface OllamaTagsResponse {
  models: Array<{ name: string; modified_at?: string; size?: number }>;
}

interface OllamaGenerateResponse {
  response: string;
  model: string;
  done: boolean;
}

let cachedModels: string[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

const PREFERRED_MODELS = ['llama3.1', 'qwen2.5', 'codellama', 'deepseek-r1', 'mistral'];

async function fetchAvailableModels(): Promise<string[]> {
  if (cachedModels && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    logger.debug(CTX, 'Using cached model list', { count: cachedModels.length });
    return cachedModels;
  }

  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`Ollama /api/tags returned ${res.status}: ${await res.text().catch(() => '')}`);
    }

    const data = (await res.json()) as OllamaTagsResponse;
    cachedModels = data.models.map((m) => {
      const [base] = m.name.split(':');
      return base;
    });
    cacheTimestamp = Date.now();
    logger.info(CTX, `Detected ${cachedModels.length} Ollama models`, { models: cachedModels.slice(0, 10) });
    return cachedModels;
  } catch (err) {
    logger.warn(CTX, 'Failed to fetch Ollama models', err);
    throw new Error(`Ollama is unreachable at ${OLLAMA_HOST}. Make sure Ollama is running.`);
  }
}

function pickDefaultModel(available: string[]): string {
  for (const preferred of PREFERRED_MODELS) {
    const match = available.find((m) => m.toLowerCase().includes(preferred.toLowerCase()));
    if (match) return match;
  }
  if (available.length > 0) return available[0];
  return 'llama3.1';
}

export interface OllamaOptions {
  model?: string;
  temperature?: number;
}

export interface OllamaResult {
  text: string;
  model: string;
}

export async function generateWithOllama(
  prompt: string,
  options?: OllamaOptions,
): Promise<OllamaResult> {
  const available = await fetchAvailableModels();
  const model = options?.model || pickDefaultModel(available);

  logger.info(CTX, `Generating with Ollama model: ${model}`);

  try {
    const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.3,
        },
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Ollama generate HTTP ${res.status}: ${errBody}`);
    }

    const data = (await res.json()) as OllamaGenerateResponse;
    logger.info(CTX, `Ollama response received`, { model: data.model, length: data.response.length });
    return { text: data.response, model: data.model };
  } catch (err) {
    logger.error(CTX, 'Ollama generation failed', err);
    throw new Error(`Ollama generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function isOllamaConfigured(): boolean {
  return !!OLLAMA_HOST;
}
