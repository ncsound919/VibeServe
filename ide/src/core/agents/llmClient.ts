/**
 * Nexus-Alpha LLM Client — Multi-provider with auto-fallback
 *
 * Providers (in priority order):
 *   1. Gemini (GEMINI_API_KEY)
 *   2. OpenRouter (OPENROUTER_API_KEY)
 *   3. Local Ollama (http://localhost:11434)
 *
 * If a provider fails, the next one is tried automatically.
 * All providers use AbortSignal.timeout to prevent hanging.
 */

const providers = [
  { name: 'gemini' as const, available: () => !!process.env.GEMINI_API_KEY },
  { name: 'openrouter' as const, available: () => !!process.env.OPENROUTER_API_KEY },
  {
    name: 'ollama' as const,
    available: async () => {
      try {
        const r = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
        return r.ok;
      } catch {
        return false;
      }
    },
  },
];

export type LlmProvider = 'gemini' | 'openrouter' | 'ollama';

export function isOffline(): boolean {
  return !process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY;
}

export function activeProvider(): LlmProvider {
  return providers.find(p => p.available())?.name ?? 'ollama';
}

interface LlmOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

/**
 * Generate text using the best available LLM provider.
 * Falls through Gemini → OpenRouter → Ollama automatically.
 */
export async function generateText(prompt: string, opts: LlmOptions = {}): Promise<string> {
  const { temperature = 0.3, maxTokens = 8192, model } = opts;

  // 1. Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.0-flash'}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': String(process.env.GEMINI_API_KEY) },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature, maxOutputTokens: maxTokens },
          }),
          signal: AbortSignal.timeout(30000),
        }
      );
      if (res.ok) {
        const d = await res.json();
        return d.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      }
      console.warn(`[LLMClient] Gemini returned ${res.status}: ${res.statusText}`);
    } catch (err) {
      console.warn('[LLMClient] Gemini failed:', err instanceof Error ? err.message : String(err));
    }
  }

  // 2. OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
        body: JSON.stringify({
          model: model || 'anthropic/claude-3-haiku',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature,
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        const d = await res.json();
        return d.choices?.[0]?.message?.content ?? '';
      }
      console.warn(`[LLMClient] OpenRouter returned ${res.status}: ${res.statusText}`);
    } catch (err) {
      console.warn('[LLMClient] OpenRouter failed:', err instanceof Error ? err.message : String(err));
    }
  }

  // 3. Local Ollama
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'qwen2.5-coder-7b',
        prompt,
        stream: false,
        options: { temperature, num_predict: maxTokens },
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (res.ok) {
      const d = await res.json();
      return d.response ?? '';
    }
  } catch (err) {
    console.error('[LLMClient] Local Ollama failed:', err);
  }

  throw new Error('All LLM providers failed');
}
