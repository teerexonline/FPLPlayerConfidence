export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** Wraps a success value in a Result. */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Wraps an error value in a Result. */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
