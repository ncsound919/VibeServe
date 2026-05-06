/**
 * Chat Context Service — gathers codebase context for AI chat messages.
 * Auto-injects: open file content, symbols, file tree, and conversation history.
 * This is what makes the chat "aware" of what you're working on.
 */

import { extractSymbols, useContextIndex, type IndexedSymbol } from './contextIndex';

export interface ChatContext {
  /** The currently open file path and content */
  openFile?: {
    path: string;
    language: string;
    content: string;
    symbols: IndexedSymbol[];
  };
  /** Summary of project structure */
  projectTree?: string;
  /** Recent conversation for continuity */
  conversationHistory?: Array<{ role: string; content: string }>;
}

interface FileEntry {
  path: string;
  name: string;
  appId: string;
}

/**
 * Gather full context for a chat message.
 * Call before sending any chat message to the AI.
 */
export async function gatherChatContext(options?: {
  openFilePath?: string;
  openFileContent?: string;
  openFileLanguage?: string;
  recentMessages?: Array<{ role: string; content: string }>;
}): Promise<ChatContext> {
  const context: ChatContext = {};

  // 1. Open file context
  if (options?.openFilePath && options?.openFileContent) {
    const symbols = extractSymbols(options.openFileContent, options.openFilePath);
    context.openFile = {
      path: options.openFilePath,
      language: options.openFileLanguage ?? inferLanguage(options.openFilePath),
      content: options.openFileContent,
      symbols,
    };
  }

  // 2. Project file tree (top-level only, async fetch)
  try {
    const res = await fetch('/api/editor/files', { signal: AbortSignal.timeout(2000) });
    const data = await res.json();
    if (data.files) {
      const files = data.files as FileEntry[];
      const tree = buildTreeSummary(files);
      context.projectTree = tree;
    }
  } catch {
    // Silently skip if files API unavailable
  }

  // 3. Conversation history (last 3 messages)
  if (options?.recentMessages && options.recentMessages.length > 0) {
    context.conversationHistory = options.recentMessages.slice(-6); // last 3 exchanges
  }

  return context;
}

/**
 * Format context as a string for injection into the AI prompt.
 */
export function formatContextForPrompt(context: ChatContext): string {
  const parts: string[] = [];

  if (context.openFile) {
    parts.push(`## Currently Open File: ${context.openFile.path}`);
    parts.push(`Language: ${context.openFile.language}`);
    parts.push(`Symbols: ${context.openFile.symbols.map((s) => `${s.kind} ${s.name}:${s.line}`).join(', ')}`);
    parts.push('```');
    parts.push(context.openFile.content.slice(0, 3000)); // Truncate to 3000 chars
    parts.push('```');
    parts.push('');
  }

  if (context.projectTree) {
    parts.push('## Project Structure');
    parts.push(context.projectTree);
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Build a compact tree summary from a flat file list.
 */
function buildTreeSummary(files: FileEntry[]): string {
  if (files.length === 0) return '(empty project)';

  // Group by top-level directory
  const dirs = new Map<string, string[]>();
  for (const f of files) {
    const parts = f.path.split('/');
    const topDir = parts.length > 1 ? parts[0] : '(root)';
    const rest = parts.slice(1).join('/');
    if (!dirs.has(topDir)) dirs.set(topDir, []);
    dirs.get(topDir)!.push(rest);
  }

  const lines: string[] = [];
  for (const [dir, children] of dirs) {
    lines.push(`${dir}/`);
    const shown = children.slice(0, 10);
    for (const child of shown) {
      lines.push(`  ${child}`);
    }
    if (children.length > 10) {
      lines.push(`  ... and ${children.length - 10} more files`);
    }
  }

  return lines.join('\n');
}

function inferLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    json: 'json',
    html: 'html',
    css: 'css',
    md: 'markdown',
    go: 'go',
    rs: 'rust',
    java: 'java',
    rb: 'ruby',
  };
  return map[ext ?? ''] ?? 'text';
}
