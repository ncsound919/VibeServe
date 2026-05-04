import CircuitBreaker from 'opossum';
import { logger } from './logger';

const options: CircuitBreaker.Options = {
  timeout: 10000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  rollingCountTimeout: 60000,
  volumeThreshold: 3,
};

const breakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(name: string, fn: (...args: unknown[]) => Promise<unknown>, customOptions?: Partial<CircuitBreaker.Options>) {
  let breaker = breakers.get(name);
  if (!breaker) {
    breaker = new CircuitBreaker(fn, { ...options, ...customOptions });
    breaker.on('open', () => logger.warn('circuitBreaker', `Circuit ${name} OPEN - fast-failing`));
    breaker.on('halfOpen', () => logger.info('circuitBreaker', `Circuit ${name} HALF-OPEN - probing`));
    breaker.on('close', () => logger.info('circuitBreaker', `Circuit ${name} CLOSED - restored`));
    breaker.on('reject', () => logger.warn('circuitBreaker', `Circuit ${name} REJECT - request blocked`));
    breaker.on('timeout', () => logger.warn('circuitBreaker', `Circuit ${name} TIMEOUT`));
    breakers.set(name, breaker);
  }
  return breaker;
}

export async function withBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  fallback: T,
  customOptions?: Partial<CircuitBreaker.Options>
): Promise<T> {
  const breaker = getCircuitBreaker(name, fn as unknown as (...args: unknown[]) => Promise<unknown>, customOptions);
  try {
    return await breaker.fire() as T;
  } catch {
    logger.warn('circuitBreaker', `Circuit ${name} fallback used`);
    return fallback;
  }
}
