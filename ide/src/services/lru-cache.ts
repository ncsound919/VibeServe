/**
 * Lightweight LRU Cache with TTL support
 * Target: <1ms get operations for sub-100ms autocomplete
 */
export class LRUCache<K, V> {
  private cache = new Map<K, { value: V; expires: number; size: number }>();
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize = 100, defaultTTLMs = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTLMs;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }

    // LRU: move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V, ttlMs?: number): void {
    const expires = Date.now() + (ttlMs || this.defaultTTL);

    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, { value, expires, size: this.estimateSize(value) });
  }

  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  private estimateSize(value: V): number {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 1024; // fallback estimate
    }
  }
}

// Specialized caches for autocomplete
export const symbolCache = new LRUCache<string, any[]>(500, 60000); // 1 min TTL
export const memoryCache = new LRUCache<string, any[]>(100, 30000); // 30s TTL
export const completionCache = new LRUCache<string, any>(200, 30000); // 30s TTL

// Performance measurement
export function measureLatency<T>(fn: () => T, label: string): T {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  if (end - start > 50) {
    console.warn(`[Latency] ${label}: ${(end - start).toFixed(2)}ms (>50ms)`);
  }
  return result;
}
