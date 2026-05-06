/**
 * Native circuit breaker — replaces the opossum dependency.
 * Tracks failure count and opens the circuit after a threshold,
 * with automatic half-open probing after a reset timeout.
 */
export class CircuitBreaker {
  private failures = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private openedAt = 0;

  constructor(
    private action: (...args: any[]) => Promise<any>,
    private options: { threshold?: number; resetTimeout?: number } = {}
  ) {}

  get threshold() { return this.options.threshold ?? 5; }
  get resetTimeout() { return this.options.resetTimeout ?? 30000; }

  async fire(...args: any[]): Promise<any> {
    if (this.state === 'open') {
      if (Date.now() - this.openedAt > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    try {
      const result = await this.action(...args);
      this.failures = 0;
      this.state = 'closed';
      return result;
    } catch (err) {
      this.failures++;
      if (this.failures >= this.threshold) {
        this.state = 'open';
        this.openedAt = Date.now();
      }
      throw err;
    }
  }

  on(_event: string, _handler: Function): this { return this; }
}
export default CircuitBreaker;
