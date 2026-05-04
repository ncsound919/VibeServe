/**
 * Secrets Manager Proxy
 * Client-side interface for secure server-held API keys and credentials.
 * Provider keys are stored on the server and prioritized by proxy routes.
 * The client only receives masked placeholders for UI purposes.
 */

export type SecretKey =
  | "GEMINI_API_KEY"
  | "GITHUB_TOKEN"
  | "OPENROUTER_API_KEY"
  | "DEEPSEEK_API_KEY"
  | "SUPABASE_URL"
  | "SUPABASE_ANON_KEY"
  | "OPENCODE_API_KEY";

import { getSession } from "./authService";

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const session = await getSession();
  const token = session?.access_token;
  
  const headers = {
    ...options.headers as any,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const secretsService = {
  async set(key: SecretKey, value: string): Promise<void> {
    await fetchWithAuth('/api/secrets/set', {
      method: 'POST',
      body: JSON.stringify({ key, value })
    });
  },

  async get(key: SecretKey): Promise<string | null> {
    // Note: Server-side secrets manager does not return the full secret to the client for safety.
    // The client only needs to know if it exists (for UI) or use it via proxy routes.
    const keys = await this.list();
    return keys.includes(key) ? '********' : null;
  },

  async remove(key: SecretKey): Promise<void> {
    await fetchWithAuth(`/api/secrets/${key}`, { method: 'DELETE' });
  },

  async clear(): Promise<void> {
    const keys = await this.list();
    for (const key of keys) {
      await this.remove(key);
    }
  },

  async list(): Promise<SecretKey[]> {
    const data = await fetchWithAuth('/api/secrets');
    return data.keys as SecretKey[];
  },

  async has(key: SecretKey): Promise<boolean> {
    const keys = await this.list();
    return keys.includes(key);
  },

  /** Mask value for display: shows placeholder since real value is on server */
  async mask(key: SecretKey): Promise<string> {
    const exists = await this.has(key);
    return exists ? "********" : "(not set)";
  },
};

/** Provider metadata */
export const PROVIDER_CONFIGS: Record<
  string,
  { label: string; key: SecretKey; baseUrl: string; docsUrl: string }
> = {
  gemini: {
    label: "Google Gemini",
    key: "GEMINI_API_KEY",
    baseUrl: "https://generativelanguage.googleapis.com",
    docsUrl: "https://ai.google.dev/docs",
  },
  github: {
    label: "GitHub",
    key: "GITHUB_TOKEN",
    baseUrl: "https://api.github.com",
    docsUrl: "https://docs.github.com/en/rest",
  },
  openrouter: {
    label: "OpenRouter",
    key: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai/api/v1",
    docsUrl: "https://openrouter.ai/docs",
  },
  deepseek: {
    label: "DeepSeek",
    key: "DEEPSEEK_API_KEY",
    baseUrl: "https://api.deepseek.com/v1",
    docsUrl: "https://platform.deepseek.com/docs",
  },
  supabase: {
    label: "Supabase",
    key: "SUPABASE_ANON_KEY",
    baseUrl: "https://supabase.com",
    docsUrl: "https://supabase.com/docs",
  },
};
