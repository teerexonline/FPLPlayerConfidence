export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

/**
 * Creates a structured logger bound to a module name.
 * All output goes through `console.*` — this is the one place in the codebase
 * allowed to use console directly. Application code uses Logger, not console.
 */
export function createLogger(module: string): Logger {
  const base: Record<string, unknown> = { module };
  const ctx = (extra?: Record<string, unknown>): Record<string, unknown> =>
    extra !== undefined ? { ...base, ...extra } : base;

  return {
    debug: (message, context) => {
      console.debug(`[debug] ${message}`, ctx(context));
    },
    info: (message, context) => {
      console.info(`[info] ${message}`, ctx(context));
    },
    warn: (message, context) => {
      console.warn(`[warn] ${message}`, ctx(context));
    },
    error: (message, context) => {
      console.error(`[error] ${message}`, ctx(context));
    },
  };
}
