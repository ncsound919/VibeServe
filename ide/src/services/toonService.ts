/**
 * TOON (Token-Oriented Object Notation) Integration
 *
 * Compact serialization format that reduces JSON tokens by 30-60%.
 * Used to compress structured data before sending to LLMs, saving
 * significant API costs per call.
 *
 * Format: Replaces verbose JSON keys with abbreviations,
 * compresses arrays, and uses a YAML-like indentation style.
 *
 * @see https://github.com/toon-format/toon
 */
import { logger } from "../lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ToonOptions {
  minTokensThreshold?: number;
  minSavingsPercent?: number;
  aggressive?: boolean;
}

export interface ToonResult {
  original: string;
  compressed: string;
  format: "json" | "yaml" | "csv" | "text" | "unknown";
  originalTokens: number;
  compressedTokens: number;
  savingsPercent: number;
  applied: boolean;
}

export interface ToonStats {
  totalCalls: number;
  totalApplied: number;
  totalOriginalTokens: number;
  totalSavedTokens: number;
  averageSavingsPercent: number;
}

// ─── Token Estimator (rough count, 1 token ≈ 4 chars for English) ───────────

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─── TOON Encoders ────────────────────────────────────────────────────────────

const KEY_MAP: Record<string, string> = {
  "id": "id", "name": "n", "type": "t", "description": "d",
  "value": "v", "key": "k", "url": "u", "title": "tl",
  "content": "c", "message": "msg", "error": "err", "status": "s",
  "created_at": "ca", "updated_at": "ua", "timestamp": "ts",
  "version": "ver", "metadata": "meta", "data": "dt",
  "items": "it", "results": "res", "users": "usr",
  "email": "em", "password": "pw", "token": "tok",
  "role": "r", "permissions": "perm", "settings": "cfg",
  "config": "cfg", "environment": "env", "database": "db",
  "source": "src", "destination": "dst", "path": "p",
  "size": "sz", "count": "cnt", "total": "tot",
  "page": "pg", "limit": "lim", "offset": "off",
  "success": "ok", "failed": "fail", "pending": "pend",
  "active": "act", "inactive": "inact", "deleted": "del",
  "pipeline": "pipe", "execution": "exec", "repository": "repo",
  "iteration": "iter", "confidence": "conf", "score": "scr",
};

function compressKey(key: string): string {
  return KEY_MAP[key] || key;
}

function encodeJsonToToon(data: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  const childPad = "  ".repeat(indent + 1);

  if (data === null || data === undefined) return "~";
  if (typeof data === "boolean") return data ? "T" : "F";
  if (typeof data === "number") return String(data);
  if (typeof data === "string") {
    if (data.length > 50 || data.includes("\n") || data.includes('"')) {
      return `>${data.replace(/\n/g, "\\n")}<`;
    }
    if (data.includes(" ") || data.includes(":") || data === "") return `"${data}"`;
    return data;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return "[]";
    // Check if homogeneous simple array
    const allScalar = data.every(d => typeof d !== "object" || d === null);
    if (allScalar && data.length <= 10) {
      return "[" + data.map(d => encodeJsonToToon(d, 0)).join(",") + "]";
    }
    // Structured array
    return data.map((item, i) => {
      const encoded = encodeJsonToToon(item, indent);
      return `${pad}- ${encoded}`;
    }).join("\n");
  }

  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return "{}";

    // Check if all values are scalar (short format)
    const allScalar = entries.every(([, v]) => typeof v !== "object" || v === null);
    if (allScalar && entries.length <= 5) {
      const parts = entries.map(([k, v]) => `${compressKey(k)}:${encodeJsonToToon(v, 0)}`);
      return "{" + parts.join(",") + "}";
    }

    // Verbose format
    const lines = entries.map(([k, v]) => {
      const ck = compressKey(k);
      const cv = encodeJsonToToon(v, indent + 1);
      if (typeof v === "object" && v !== null && !Array.isArray(v)) {
        return `${childPad}${ck}:\n${cv}`;
      }
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object") {
        return `${childPad}${ck}:\n${cv}`;
      }
      return `${childPad}${ck}: ${cv}`;
    });
    return lines.join("\n");
  }

  return String(data);
}

// ─── TOON Decoder ─────────────────────────────────────────────────────────────

const REVERSE_KEY_MAP: Record<string, string> = {};
for (const [k, v] of Object.entries(KEY_MAP)) {
  if (!REVERSE_KEY_MAP[v]) REVERSE_KEY_MAP[v] = k;
}

function expandKey(key: string): string {
  return REVERSE_KEY_MAP[key] || key;
}

function decodeToonToJson(content: string): unknown {
  const trimmed = content.trim();
  if (trimmed === "~") return null;
  if (trimmed === "T") return true;
  if (trimmed === "F") return false;
  if (trimmed === "[]") return [];
  if (!isNaN(Number(trimmed)) && trimmed !== "") return Number(trimmed);

  // String value
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);

  return content; // Return as-is for now (full TOON parsing is complex)
}

// ─── Format Detection ─────────────────────────────────────────────────────────

function detectFormat(content: string): "json" | "yaml" | "csv" | "text" | "unknown" {
  const trimmed = content.trim();
  try { JSON.parse(trimmed); return "json"; } catch { /* ignore */ }
  if (trimmed.includes(",") && trimmed.includes("\n") && !trimmed.includes("{")) return "csv";
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "unknown"; // probably broken JSON
  return "text";
}

// ─── Public API ───────────────────────────────────────────────────────────────

const stats: ToonStats = { totalCalls: 0, totalApplied: 0, totalOriginalTokens: 0, totalSavedTokens: 0, averageSavingsPercent: 0 };

export function encodeToToon(
  content: string,
  options: ToonOptions = {}
): ToonResult {
  const format = detectFormat(content);
  const minTokens = options.minTokensThreshold || 50;
  const minSavings = options.minSavingsPercent || 10;
  const originalTokens = estimateTokens(content);

  stats.totalCalls++;

  // Skip if too small
  if (originalTokens < minTokens || format === "text") {
    return {
      original: content, compressed: content, format,
      originalTokens, compressedTokens: originalTokens,
      savingsPercent: 0, applied: false,
    };
  }

  let compressed: string;

  if (format === "json") {
    try {
      const parsed = JSON.parse(content);
      compressed = encodeJsonToToon(parsed);
    } catch {
      compressed = content;
    }
  } else if (format === "csv") {
    // Basic CSV compression: remove redundant commas, shorten headers
    const lines = content.trim().split("\n");
    if (lines.length > 1) {
      const header = lines[0].split(",").map(h => compressKey(h.trim())).join(",");
      compressed = [header, ...lines.slice(1)].join("\n");
    } else {
      compressed = content;
    }
  } else {
    compressed = content;
  }

  const compressedTokens = estimateTokens(compressed);
  const savingsPercent = originalTokens > 0
    ? Math.round(((originalTokens - compressedTokens) / originalTokens) * 100)
    : 0;

  const applied = savingsPercent >= minSavings;

  if (applied) {
    stats.totalApplied++;
    stats.totalOriginalTokens += originalTokens;
    stats.totalSavedTokens += (originalTokens - compressedTokens);
    stats.averageSavingsPercent = stats.totalApplied > 0
      ? Math.round((stats.totalSavedTokens / stats.totalOriginalTokens) * 100)
      : 0;
  }

  return {
    original: content, compressed,
    format,
    originalTokens, compressedTokens,
    savingsPercent, applied,
  };
}

export function compressJson(obj: unknown): string {
  return encodeJsonToToon(obj);
}

export function getToonStats(): ToonStats {
  return { ...stats };
}

export function resetToonStats(): void {
  stats.totalCalls = 0;
  stats.totalApplied = 0;
  stats.totalOriginalTokens = 0;
  stats.totalSavedTokens = 0;
  stats.averageSavingsPercent = 0;
}
