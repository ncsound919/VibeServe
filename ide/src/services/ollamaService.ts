/**
 * Ollama Service - Local LLM integration
 * 
 * Communicates with a local Ollama instance (typically on port 11434).
 * Supports: Generation, Embedding, List models.
 */
import { logger } from '../lib/logger';

export interface OllamaOptions {
  model: string;
  prompt: string;
  system?: string;
  template?: string;
  stream?: boolean;
  options?: Record<string, any>;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

const DEFAULT_HOST = 'http://localhost:11434';

export class OllamaService {
  private host: string;

  constructor(host: string = DEFAULT_HOST) {
    this.host = host;
  }

  async generate(options: OllamaOptions): Promise<string> {
    try {
      logger.info('Ollama', `Generating with model: ${options.model}`);
      const response = await fetch(`${this.host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...options,
          stream: false, // For now, we use non-streaming for simplicity in the integration
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.statusText}`);
      }

      const data: OllamaResponse = await response.json();
      return data.response;
    } catch (error) {
      logger.error('Ollama', `Generation failed: ${error}`);
      throw error;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.host}/api/tags`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.models.map((m: any) => m.name);
    } catch (error) {
      logger.error('Ollama', `Failed to list models: ${error}`);
      return [];
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(this.host);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const ollamaService = new OllamaService();
