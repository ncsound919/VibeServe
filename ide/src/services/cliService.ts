/**
 * Multi-provider CLI Service
 * Wires OpenRouter, DeepSeek, and OpenCode to real API endpoints via server proxy.
 */

import { streamCLIProxy } from "./apiClient";

export type CLIProvider = "opencode" | "openrouter" | "deepseek";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface StreamCallback {
  onToken: (token: string) => void;
  onDone: (fullText: string) => void;
  onError: (err: Error) => void;
}

// ─── Public API ──────────────────────────────────────────────────────────────────
export async function streamCLI(
  provider: CLIProvider,
  command: string,
  history: ChatMessage[],
  callbacks: StreamCallback
): Promise<void> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are Nexus Alpha, an AI-powered build platform assistant. Help the user with code, builds, repos, pipelines, and AI tooling. Be concise and technical.",
    },
    ...history,
    { role: "user", content: command },
  ];

  try {
    await streamCLIProxy(provider, messages, undefined, {
      onToken: callbacks.onToken,
      onDone: () => {
        callbacks.onDone(""); 
      },
      onError: (err) => {
        callbacks.onError(err);
      }
    });
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  }
}
