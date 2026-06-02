/**
 * Native circuit breaker — replaces the opossum dependency.
 * Tracks failure count and opens the circuit after a threshold,
 * with automatic half-open probing after a reset timeout.
 */
export interface CircuitBreakerOptions {
	threshold?: number;
	resetTimeout?: number;
	errorThresholdPercentage?: number;
	timeout?: number;
}

export class CircuitBreaker {
	private failures = 0;
	private totalAttempts = 0;
	private state: "closed" | "open" | "half-open" = "closed";
	private openedAt = 0;

	constructor(
		private action: (...args: any[]) => Promise<any>,
		private options: CircuitBreakerOptions = {},
	) {}

	get threshold() {
		return this.options.threshold ?? 5;
	}
	get resetTimeout() {
		return this.options.resetTimeout ?? 30000;
	}
	get errorThresholdPercentage() {
		return this.options.errorThresholdPercentage ?? 50;
	}
	get timeout() {
		return this.options.timeout ?? 0;
	}

	async fire(...args: any[]): Promise<any> {
		if (this.state === "open") {
			if (Date.now() - this.openedAt > this.resetTimeout) {
				this.state = "half-open";
				console.info(
					"[CircuitBreaker] Probing — transitioned open → half-open",
				);
			} else {
				throw new Error("Circuit breaker is open");
			}
		}
		const prevState = this.state;
		this.totalAttempts++;
		try {
			const result = await (this.timeout > 0
				? this.executeWithTimeout(...args)
				: this.action(...args));
			this.failures = 0;
			this.state = "closed";
			if (prevState === "half-open") {
				console.info(
					"[CircuitBreaker] Recovered — transitioned half-open → closed",
				);
			}
			return result;
		} catch (err) {
			this.failures++;
			const errorRate =
				this.errorThresholdPercentage != null
					? (this.failures / this.totalAttempts) * 100
					: 0;
			const exceeded =
				this.errorThresholdPercentage != null
					? errorRate >= this.errorThresholdPercentage
					: this.failures >= this.threshold;
			if (exceeded) {
				this.state = "open";
				this.openedAt = Date.now();
				console.warn(
					`[CircuitBreaker] Opened — ${this.failures}/${this.totalAttempts} failures (${errorRate.toFixed(1)}%) exceeded threshold`,
				);
			} else if (prevState === "half-open") {
				console.warn("[CircuitBreaker] Probe failed — remaining half-open");
			}
			throw err;
		}
	}

	private executeWithTimeout(...args: any[]): Promise<any> {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(
				() => reject(new Error("Operation timed out")),
				this.timeout,
			);
			this.action(...args)
				.then((result) => {
					clearTimeout(timer);
					resolve(result);
				})
				.catch((err) => {
					clearTimeout(timer);
					reject(err);
				});
		});
	}

	on(_event: string, _handler: Function): this {
		return this;
	}
}

// Helper function for easy usage
export function withBreaker(
	action: (...args: any[]) => Promise<any>,
	options: CircuitBreakerOptions = {},
) {
	return new CircuitBreaker(action, options);
}

export default CircuitBreaker;
