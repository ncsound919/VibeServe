/**
 * Inline AI Completion Service — ghost-text completions like Cursor.
 * Provides fast local completions (instant) and AI completions (debounced).
 */

interface CompletionRequest {
  code: string;
  position: { lineNumber: number; column: number };
  language: string;
  fileName: string;
}

interface CompletionResponse {
  text: string;
}

class CompletionCache {
  private cache = new Map<string, { text: string; timestamp: number }>();
  private maxSize = 500;
  private ttl = 3 * 60 * 1000;

  key(prefix: string, language: string): string {
    const hash = prefix.slice(0, 80).replace(/\s+/g, ' ');
    return `${language}:${hash}`;
  }

  get(key: string): string | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.text;
  }

  set(key: string, text: string) {
    if (this.cache.size >= this.maxSize) {
      const first = this.cache.keys().next().value;
      if (first !== undefined) this.cache.delete(first);
    }
    this.cache.set(key, { text, timestamp: Date.now() });
  }
}

export const completionCache = new CompletionCache();

const AI_COMPLETION_ENDPOINT = '/api/ai/complete';

let pendingController: AbortController | null = null;

function getContextWindow(code: string, lineNumber: number, linesAbove = 30, linesBelow = 5): string {
  const lines = code.split('\n');
  const start = Math.max(0, lineNumber - linesAbove);
  const end = Math.min(lines.length, lineNumber + linesBelow);
  return lines.slice(start, end).join('\n');
}

function buildPrompt(request: CompletionRequest): string {
  const lines = request.code.split('\n');
  const currentLine = lines[request.position.lineNumber - 1] ?? '';
  const context = getContextWindow(request.code, request.position.lineNumber);
  const prefix = currentLine.slice(0, request.position.column - 1);
  const suffix = currentLine.slice(request.position.column - 1);

  return `You are an expert ${request.language} developer. Complete the code at the cursor. Return ONLY the completion text, nothing else — no explanations, no markdown, no code fences.

Language: ${request.language}
File: ${request.fileName}

Before cursor:
${context.slice(0, Math.min(context.length, context.indexOf(prefix) + prefix.length + 200))}

The character right after the cursor is: "${suffix.slice(0, 1) || '(end of line)'}"

Complete the line starting from the cursor position. If the completion should span multiple lines, include newlines.`;
}

/**
 * Fetch AI-powered inline completion with debouncing.
 * Cancels previous in-flight request if a new one comes in.
 */
export async function fetchInlineCompletion(request: CompletionRequest): Promise<CompletionResponse | null> {
  const lines = request.code.split('\n');
  const currentLine = lines[request.position.lineNumber - 1] ?? '';
  const prefix = currentLine.slice(0, request.position.column - 1);

  // Skip if cursor is in whitespace or at very start of line
  if (prefix.length < 2 && !currentLine.trim()) return null;

  const cacheKey = completionCache.key(prefix + '\n' + currentLine, request.language);
  const cached = completionCache.get(cacheKey);
  if (cached !== undefined) {
    return { text: cached };
  }

  // Cancel any previous in-flight request
  if (pendingController) {
    pendingController.abort();
  }
  pendingController = new AbortController();

  try {
    const response = await fetch(AI_COMPLETION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: buildPrompt(request),
        language: request.language,
        fileName: request.fileName,
        maxTokens: 60,
        temperature: 0.1,
      }),
      signal: pendingController.signal,
    });

    if (!response.ok) { pendingController = null; return null; }

    const data = await response.json();
    const text = (data.completion ?? data.text ?? '').trim();

    // Reject completions that are too short, too long, or look like explanations
    if (text.length < 1 || text.length > 200) { pendingController = null; return null; }
    if (text.startsWith('Here') || text.startsWith('The') || text.startsWith('This') || text.startsWith('I ')) { pendingController = null; return null; }
    if (text.includes('```')) { pendingController = null; return null; }

    completionCache.set(cacheKey, text);
    pendingController = null;
    return { text };
  } catch (e) {
    pendingController = null;
    if ((e as Error).name === 'AbortError') return null;
    return null;
  }
}

/**
 * Fast local completions — symbol-based, no LLM call.
 * Returns instantly for common code patterns.
 */
export function getLocalInlineCompletion(
  code: string,
  lineNumber: number,
  column: number,
  language: string,
): string | null {
  const lines = code.split('\n');
  const currentLine = lines[lineNumber - 1] ?? '';
  const beforeCursor = currentLine.slice(0, column - 1);
  const prefix = beforeCursor.trim();

  if (!prefix) return null;

  // ── Function / method patterns ──
  const fnPatterns: Array<[RegExp, string]> = [
    [/^console\.log$/, '('],
    [/^console\.error$/, '('],
    [/^console\.warn$/, '('],
    [/^console\.table$/, '('],
    [/^console\.dir$/, '('],
    [/^console\.assert$/, '('],
    [/^console\.trace$/, '('],
    [/^console\.time$/, '('],
    [/^console\.timeEnd$/, '('],
  ];

  for (const [re, completion] of fnPatterns) {
    if (re.test(prefix)) return completion;
  }

  // ── Control flow patterns ──
  if (/^if\s*$/.test(prefix)) return ' () {\n  \n}';
  if (/^if\s*\($/.test(prefix)) return ') {\n  \n}';
  if (/^else\s*$/.test(prefix)) return ' {\n  \n}';
  if (/^for\s*$/.test(prefix)) return ' (let i = 0; i < ; i++) {\n  \n}';
  if (/^for\s*\($/.test(prefix)) return 'let i = 0; i < ; i++) {\n  \n}';
  if (/^while\s*$/.test(prefix)) return ' () {\n  \n}';
  if (/^while\s*\($/.test(prefix)) return ') {\n  \n}';
  if (/^switch\s*$/.test(prefix)) return ' () {\n  case :\n    break;\n  default:\n    break;\n}';

  // ── Declaration patterns ──
  if (/^function\s+\w+$/.test(prefix)) return '() {\n  \n}';
  if (/^const\s+\w+$/.test(prefix)) return ' = ';
  if (/^let\s+\w+$/.test(prefix)) return ' = ';
  if (/^var\s+\w+$/.test(prefix)) return ' = ';

  // ── Import / Export patterns ──
  if (/^import\s+\{$/.test(prefix)) return ' } from "";';
  if (/^import\s+\{\s*\w+$/.test(prefix)) return ' } from "";';
  if (/^import\s+\w+\s+from\s+$/.test(prefix)) return '"";';
  if (/^import\s+$/.test(prefix)) return '{  } from "";';
  if (/^export\s+default\s+function\s+\w+$/.test(prefix)) return '() {\n  \n}';
  if (/^export\s+default\s+class\s+\w+$/.test(prefix)) return ' {\n  \n}';
  if (/^export\s+const\s+\w+$/.test(prefix)) return ' = ';
  if (/^export\s+function\s+\w+$/.test(prefix)) return '() {\n  \n}';

  // ── Try/catch ──
  if (/^try\s*$/.test(prefix)) return ' {\n  \n} catch (e) {\n  \n}';
  if (/^catch\s*$/.test(prefix)) return ' (e) {\n  \n}';

  // ── React / JSX patterns ──
  if (/^useState$/.test(prefix)) return '()';
  if (/^useEffect$/.test(prefix)) return '(() => {\n  \n}, [])';
  if (/^useCallback$/.test(prefix)) return '(() => {\n  \n}, [])';
  if (/^useMemo$/.test(prefix)) return '(() => {\n  \n}, [])';
  if (/^useRef$/.test(prefix)) return '()';
  if (/^useContext$/.test(prefix)) return '()';

  // ── Return / throw ──
  if (/^return\s+\w+\.$/.test(prefix)) {
    // Return chain: infer next property from context
    return null; // Can't pattern-match this, let AI handle it
  }
  if (/^throw\s+new\s+$/.test(prefix)) return 'Error()';
  if (/^throw\s+new\s+\w+$/.test(prefix)) return '()';

  // ── Array/object patterns ──
  if (/^const\s+\w+\s*=\s*\[$/.test(prefix)) return '];';
  if (/^const\s+\w+\s*=\s*\{$/.test(prefix)) return '};';

  // ── Async/await ──
  if (/^async\s+function\s+\w+$/.test(prefix)) return '() {\n  \n}';
  if (/^await\s+\w+\.$/.test(prefix)) return null; // let AI handle

  // ── TypeScript specific ──
  if (language === 'typescript') {
    if (/^interface\s+\w+$/.test(prefix)) return ' {\n  \n}';
    if (/^type\s+\w+\s*=\s*$/.test(prefix)) return ' {};';
    if (/^type\s+\w+$/.test(prefix)) return ' = {\n  \n};';
    if (/^enum\s+\w+$/.test(prefix)) return ' {\n  \n}';
    if (/^as\s+$/.test(prefix)) return 'const;';
    if (/^readonly\s+$/.test(prefix)) return ';';
  }

  // ── Python specific ──
  if (language === 'python') {
    if (/^def\s+\w+$/.test(prefix)) return '():\n    ';
    if (/^class\s+\w+$/.test(prefix)) return ':\n    ';
    if (/^class\s+\w+\($/.test(prefix)) return '):\n    ';
    if (/^if\s+$/.test(prefix)) return ':\n    ';
    if (/^elif\s+$/.test(prefix)) return ':\n    ';
    if (/^else$/.test(prefix)) return ':\n    ';
    if (/^for\s+$/.test(prefix)) return ' in :\n    ';
    if (/^while\s+$/.test(prefix)) return ':\n    ';
    if (/^try$/.test(prefix)) return ':\n    ';
    if (/^except\s*$/.test(prefix)) return ' Exception as e:\n    ';
    if (/^except$/.test(prefix)) return ' Exception as e:\n    ';
    if (/^with\s+$/.test(prefix)) return ' as :\n    ';
    if (/^import\s+\w+$/.test(prefix)) return '';
    if (/^from\s+\w+\s+import\s+$/.test(prefix)) return '';
    if (/^return\s+$/.test(prefix)) return 'None';
    if (/^print\($/.test(prefix)) return ')';
    if (/^lambda\s+$/.test(prefix)) return ': ';
    if (/^self\.$/.test(prefix)) return null; // let AI handle
    if (/^@\w+$/.test(prefix)) return '\ndef '; // decorator
  }

  return null;
}

// Debounce state for AI completions
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastRequestKey = '';

export function clearCompletionDebounce() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (pendingController) {
    pendingController.abort();
    pendingController = null;
  }
}
