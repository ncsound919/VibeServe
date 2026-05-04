import { withBreaker } from '../lib/circuitBreaker';
import { logger } from '../lib/logger';
import { getSession } from './authService';

const API_BASE = '/api/proxy';

const PROXY_CIRCUIT = 'api-proxy';

async function proxyFetch<T>(method: string, url: string, body?: unknown, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  
  const session = await getSession();
  const token = session?.access_token;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        'Authorization': `Bearer ${token}`
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function callGeminiProxy(prompt: string, model?: string): Promise<string> {
  const result = await proxyFetch<{ text: string }>('POST', `${API_BASE}/gemini`, { prompt, model });
  return result.text;
}

export async function fetchGitHubProxy<T = unknown>(path: string): Promise<T> {
  return withBreaker(
    PROXY_CIRCUIT,
    () => proxyFetch<T>('GET', `${API_BASE}/github/${path}`),
    undefined as unknown as T,
  );
}

export async function streamCLIProxy(
  provider: 'openrouter' | 'deepseek' | 'opencode',
  messages: Array<{ role: string; content: string }>,
  model?: string,
  callbacks?: { onToken?: (t: string) => void; onDone?: () => void; onError?: (e: Error) => void },
): Promise<void> {
  try {
    const session = await getSession();
    const token = session?.access_token;
    const controller = new AbortController();
    const res = await fetch(`${API_BASE}/cli/stream`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ provider, messages, model }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      callbacks?.onError?.(new Error(err.error ?? `HTTP ${res.status}`));
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      callbacks?.onDone?.();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            if (provider === 'opencode') {
              const parsed = JSON.parse(data);
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) callbacks?.onToken?.(text);
            } else {
              const parsed = JSON.parse(data);
              const text = parsed.choices?.[0]?.delta?.content;
              if (text) callbacks?.onToken?.(text);
            }
          } catch {
            // non-JSON chunk ignored
          }
        }
      }
    }

    callbacks?.onDone?.();
  } catch (e) {
    logger.error('apiClient', 'CLI stream proxy error', e);
    callbacks?.onError?.(e instanceof Error ? e : new Error(`${e}`));
  }
}
