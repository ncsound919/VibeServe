/**
 * ErrorContextService
 *
 * Watches terminal output, extracts structured error contexts, deduplicates
 * them by fingerprint, and routes them to the chat system for AI analysis.
 *
 * Data flow:
 *   Terminal chunk → rolling buffer → pattern match → dedup → chat injection
 *
 * Usage:
 *   const svc = ErrorContextService.getInstance();
 *   svc.ingestChunk(terminalOutputChunk);
 *   svc.onError((err) => dispatch({ type: 'ADD_ERROR_CONTEXT', payload: err }));
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ErrorKind =
  | 'runtime'
  | 'typecheck'
  | 'test'
  | 'build'
  | 'syntax'
  | 'lint'
  | 'unknown';

export type ErrorSeverity = 'error' | 'warning' | 'info';

export interface DetectedError {
  /** Stable deduplication key — hash of normalized trace */
  fingerprint: string;
  /** Unique instance id for React keys */
  id: string;
  kind: ErrorKind;
  severity: ErrorSeverity;
  /** One-line human-readable title */
  title: string;
  /** Extracted and cleaned stack / compiler output (≤ MAX_TRACE_CHARS) */
  trace: string;
  /** Best-guess source file, if parseable */
  file?: string;
  /** Best-guess line number */
  line?: number;
  /** Best-guess column */
  column?: number;
  /** Epoch ms when first detected in this session */
  createdAt: number;
  /** Whether the user has dismissed this from the chip */
  dismissed: boolean;
}

export type ErrorListener = (err: DetectedError) => void;

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLLING_BUFFER_CHARS = 8_000;
const MAX_TRACE_CHARS = 3_000;
/** Same fingerprint suppressed for this many ms */
const DEDUP_WINDOW_MS = 10_000;
/** Max errors held in memory before evicting oldest */
const MAX_ERROR_QUEUE = 50;

// ─── Pattern library ─────────────────────────────────────────────────────────

interface ErrorPattern {
  kind: ErrorKind;
  severity: ErrorSeverity;
  /** Matches a block of terminal output */
  detect: RegExp;
  /** Extract title from the match */
  title: (m: RegExpMatchArray) => string;
  /** Where in the matched block does the real trace start */
  traceStart?: (raw: string) => number;
  /** Optional file/line extractor applied to the raw block */
  location?: RegExp;
}

const PATTERNS: ErrorPattern[] = [
  // ── Python traceback ──────────────────────────────────────────────────────
  {
    kind: 'runtime',
    severity: 'error',
    detect: /Traceback \(most recent call last\):([\s\S]*?)(?=\n\n|\n(?=[A-Z])|\s*$)/,
    title: (m) => {
      const lastLine = m[1].trim().split('\n').pop() ?? 'Python error';
      return lastLine.slice(0, 120);
    },
    location: /File "([^"]+)", line (\d+)/,
  },

  // ── Python syntax error ───────────────────────────────────────────────────
  {
    kind: 'syntax',
    severity: 'error',
    detect: /SyntaxError: (.+)/,
    title: (m) => `SyntaxError: ${m[1].trim().slice(0, 100)}`,
    location: /File "([^"]+)", line (\d+)/,
  },

  // ── pytest failure block ──────────────────────────────────────────────────
  {
    kind: 'test',
    severity: 'error',
    detect: /FAILED (.+?) - (.+?)(?:\n|$)/,
    title: (m) => `Test failed: ${m[1].trim().slice(0, 80)} — ${m[2].trim().slice(0, 60)}`,
    location: /([^\s]+\.py)(?::(\d+))?/,
  },

  // ── pytest error summary ─────────────────────────────────────────────────
  {
    kind: 'test',
    severity: 'error',
    detect: /(\d+) failed(?:, \d+ passed)?(?:, \d+ error)?/,
    title: (m) => `pytest: ${m[0].trim()}`,
  },

  // ── TypeScript / tsc ──────────────────────────────────────────────────────
  {
    kind: 'typecheck',
    severity: 'error',
    detect: /error TS(\d+): (.+)/,
    title: (m) => `TS${m[1]}: ${m[2].trim().slice(0, 100)}`,
    location: /([^\s]+\.tsx?)\((\d+),(\d+)\)/,
  },

  // ── Node.js / V8 runtime error ────────────────────────────────────────────
  {
    kind: 'runtime',
    severity: 'error',
    detect: /(ReferenceError|TypeError|RangeError|SyntaxError|Error): (.+)/,
    title: (m) => `${m[1]}: ${m[2].trim().slice(0, 100)}`,
    location: /at .+ \(([^)]+):(\d+):(\d+)\)/,
  },

  // ── ESM / CommonJS import error ───────────────────────────────────────────
  {
    kind: 'runtime',
    severity: 'error',
    detect: /Cannot find module '([^']+)'/,
    title: (m) => `Cannot find module '${m[1]}'`,
  },

  // ── Vite build error ──────────────────────────────────────────────────────
  {
    kind: 'build',
    severity: 'error',
    detect: /\[vite\] (error|Error):? (.+)/i,
    title: (m) => `Vite: ${m[2].trim().slice(0, 100)}`,
    location: /([^\s]+\.[jt]sx?):(\d+):(\d+)/,
  },

  // ── npm / pnpm build failure ──────────────────────────────────────────────
  {
    kind: 'build',
    severity: 'error',
    detect: /npm ERR! (code .+|.+failed)/i,
    title: (m) => `npm: ${m[1].trim().slice(0, 100)}`,
  },

  // ── ESLint / ruff ─────────────────────────────────────────────────────────
  {
    kind: 'lint',
    severity: 'warning',
    detect: /(\d+) error?s?, (\d+) warning?s?/,
    title: (m) => `Lint: ${m[0].trim()}`,
  },

  // ── Generic "error:" line ─────────────────────────────────────────────────
  {
    kind: 'unknown',
    severity: 'error',
    detect: /^(?:error|ERROR|Error):\s+(.+)/m,
    title: (m) => m[1].trim().slice(0, 100),
  },
];

// ─── FNV-1a 32-bit for fingerprinting ────────────────────────────────────────

function fnv1a32(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function fingerprint(kind: ErrorKind, title: string, file?: string): string {
  // Normalize: strip line numbers and memory addresses for stable hashing
  const normalized = `${kind}|${title}|${file ?? ''}`
    .replace(/\b\d{2,}\b/g, 'N')     // strip plain numbers
    .replace(/0x[\da-f]+/gi, '0xN')  // strip hex addresses
    .toLowerCase()
    .trim();
  return fnv1a32(normalized);
}

// ─── Service class ────────────────────────────────────────────────────────────

let _instance: ErrorContextService | null = null;

export class ErrorContextService {
  private buffer = '';
  private listeners: Set<ErrorListener> = new Set();
  private seenFingerprints = new Map<string, number>(); // fingerprint → expiry ms
  private errorQueue: DetectedError[] = [];
  private enabled = true;

  private constructor() {
    // Clean expired fingerprints every 30 s
    setInterval(() => this._evictExpiredFingerprints(), 30_000);
  }

  static getInstance(): ErrorContextService {
    if (!_instance) _instance = new ErrorContextService();
    return _instance;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Feed raw terminal output (one or more chunks). Call on every xterm data event. */
  ingestChunk(chunk: string): void {
    if (!this.enabled) return;

    // Strip ANSI escape codes before buffering
    const clean = chunk.replace(/\x1b\[[0-9;]*[mGKHF]/g, '');
    this.buffer += clean;

    // Keep buffer bounded — trim from the front
    if (this.buffer.length > ROLLING_BUFFER_CHARS) {
      this.buffer = this.buffer.slice(this.buffer.length - ROLLING_BUFFER_CHARS);
    }

    this._scan();
  }

  /** Register a callback invoked whenever a new, unique error is detected. */
  onError(listener: ErrorListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** All errors detected in this session (not dismissed). */
  getQueue(): DetectedError[] {
    return [...this.errorQueue];
  }

  dismissError(id: string): void {
    const idx = this.errorQueue.findIndex((e) => e.id === id);
    if (idx !== -1) this.errorQueue[idx] = { ...this.errorQueue[idx], dismissed: true };
  }

  clearAll(): void {
    this.errorQueue = [];
    this.seenFingerprints.clear();
  }

  setEnabled(val: boolean): void {
    this.enabled = val;
    if (!val) this.buffer = '';
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private _scan(): void {
    for (const pattern of PATTERNS) {
      const m = this.buffer.match(pattern.detect);
      if (!m) continue;

      // Extract a bounded trace window around the match
      const matchIndex = this.buffer.indexOf(m[0]);
      const windowStart = Math.max(0, matchIndex - 300);
      const rawWindow = this.buffer.slice(windowStart, matchIndex + Math.min(m[0].length + 2_000, MAX_TRACE_CHARS));
      const trace = this._cleanTrace(rawWindow);

      // Location
      let file: string | undefined;
      let line: number | undefined;
      let column: number | undefined;

      if (pattern.location) {
        const loc = rawWindow.match(pattern.location);
        if (loc) {
          file = loc[1];
          line = loc[2] ? parseInt(loc[2], 10) : undefined;
          column = loc[3] ? parseInt(loc[3], 10) : undefined;
        }
      }

      const title = pattern.title(m);
      const fp = fingerprint(pattern.kind, title, file);

      // Dedup check
      const expiry = this.seenFingerprints.get(fp);
      if (expiry && Date.now() < expiry) continue;

      this.seenFingerprints.set(fp, Date.now() + DEDUP_WINDOW_MS);

      const err: DetectedError = {
        fingerprint: fp,
        id: `${fp}-${Date.now()}`,
        kind: pattern.kind,
        severity: pattern.severity,
        title,
        trace,
        file,
        line,
        column,
        createdAt: Date.now(),
        dismissed: false,
      };

      this._enqueue(err);
      this._notify(err);

      // Consume the matched section so we don't double-fire on same content
      this.buffer = this.buffer.slice(matchIndex + m[0].length);
      break; // One error per scan pass; next chunk will re-scan
    }
  }

  private _cleanTrace(raw: string): string {
    return raw
      .replace(/\x1b\[[0-9;]*[mGKHF]/g, '')  // ANSI
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')             // collapse blank lines
      .trim()
      .slice(0, MAX_TRACE_CHARS);
  }

  private _enqueue(err: DetectedError): void {
    this.errorQueue.push(err);
    if (this.errorQueue.length > MAX_ERROR_QUEUE) {
      this.errorQueue.shift();
    }
  }

  private _notify(err: DetectedError): void {
    for (const cb of this.listeners) {
      try { cb(err); } catch (_) { /* listener errors must not crash the service */ }
    }
  }

  private _evictExpiredFingerprints(): void {
    const now = Date.now();
    for (const [fp, expiry] of this.seenFingerprints) {
      if (now >= expiry) this.seenFingerprints.delete(fp);
    }
  }
}
