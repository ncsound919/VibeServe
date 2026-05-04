export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E = Error>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(r: Result<T, E>): r is { ok: true; value: T } {
  return r.ok;
}

export function isErr<T, E>(r: Result<T, E>): r is { ok: false; error: E } {
  return !r.ok;
}

export function unwrap<T, E>(r: Result<T, E>, msg?: string): T {
  if (r.ok) return r.value;
  if (isErr(r)) throw r.error;
  throw new Error(msg ?? 'Invalid Result state');
}

export function unwrapOr<T, E>(r: Result<T, E>, fallback: T): T {
  if (r.ok) return r.value;
  return fallback;
}

export function map<T, U, E>(r: Result<T, E>, fn: (t: T) => U): Result<U, E> {
  if (r.ok) return ok(fn(r.value));
  if (isErr(r)) return err(r.error);
  throw new Error('Invalid Result state');
}

export function mapErr<T, E, F>(r: Result<T, E>, fn: (e: E) => F): Result<T, F> {
  if (r.ok) return r;
  if (isErr(r)) return err(fn(r.error));
  throw new Error('Invalid Result state');
}

export async function tryCatch<T, E = Error>(fn: () => Promise<T>, onError: (e: unknown) => E): Promise<Result<T, E>> {
  try {
    return ok(await fn());
  } catch (e) {
    return err(onError(e));
  }
}

export function resultify<T, E = Error>(fn: () => T, onError: (e: unknown) => E): Result<T, E> {
  try {
    return ok(fn());
  } catch (e) {
    return err(onError(e));
  }
}
