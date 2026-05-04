/**
 * Nexus Alpha Logger — Pino on server, console in browser.
 * Same API: logger.debug/info/warn/error(context, message, data?)
 */
const LOG_PREFIX = '[Nexus]';
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const logLevels = { debug: 0, info: 1, warn: 2, error: 3 } as const;
const currentLevel: LogLevel =
  (typeof process !== 'undefined' && (process.env as Record<string, string>).NEXUS_LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return logLevels[level] >= logLevels[currentLevel];
}

function formatMessage(level: LogLevel, context: string, message: string, data?: unknown): string {
  const ts = new Date().toISOString();
  const prefix = `${LOG_PREFIX}[${context}][${level.toUpperCase()}]`;
  if (data !== undefined) {
    return `${prefix} ${message} ${JSON.stringify(data)}`;
  }
  return `${prefix} ${message}`;
}

// ─── Console fallback (browser-safe) ────────────────────────────────────────────

const consoleLogger = {
  debug: (context: string, message: string, data?: unknown) => {
    if (shouldLog('debug')) console.debug(formatMessage('debug', context, message, data));
  },
  info: (context: string, message: string, data?: unknown) => {
    if (shouldLog('info')) console.info(formatMessage('info', context, message, data));
  },
  warn: (context: string, message: string, data?: unknown) => {
    if (shouldLog('warn')) console.warn(formatMessage('warn', context, message, data));
  },
  error: (context: string, message: string, data?: unknown) => {
    if (shouldLog('error')) console.error(formatMessage('error', context, message, data));
  },
};

// ─── Pino logger (server only — lazy-loaded) ────────────────────────────────────

let pinoLogger: typeof consoleLogger | null = null;
let pinoInitAttempted = false;

async function initPino(): Promise<typeof consoleLogger> {
  if (pinoInitAttempted) return pinoLogger ?? consoleLogger;
  pinoInitAttempted = true;
  if (typeof window !== 'undefined') return consoleLogger;

  try {
    const [pinoModule, fsModule, pathModule] = await Promise.all([
      import('pino'),
      import('node:fs'),
      import('node:path'),
    ]);

    const pino = pinoModule.default;
    const { existsSync, mkdirSync } = fsModule;
    const path = pathModule.default;

    const level = (process.env.NEXUS_LOG_LEVEL as string) || 'info';
    const isDev = process.env.NODE_ENV !== 'production';
    const streams: { level: string; stream: any }[] = [];

    if (isDev) {
      try {
        const pretty = await import('pino-pretty');
        streams.push({
          level,
          stream: pino.transport({ target: 'pino-pretty', options: { colorize: true } }),
        });
      } catch {
        streams.push({ level, stream: process.stdout });
      }
    } else {
      streams.push({ level, stream: process.stdout });
    }

    try {
      const logDir = path.resolve('uploads', 'nexus');
      if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
      streams.push({
        level,
        stream: pino.destination(path.resolve(logDir, 'pipeline.log')),
      });
    } catch {
      // file transport unavailable
    }

    const baseLogger = pino({ level, name: 'Nexus' }, pino.multistream(streams));

    pinoLogger = {
      debug: (ctx: string, msg: string, data?: unknown) => {
        if (shouldLog('debug')) baseLogger.debug({ context: ctx, ...(data !== undefined ? { data } : {}) }, msg);
      },
      info: (ctx: string, msg: string, data?: unknown) => {
        if (shouldLog('info')) baseLogger.info({ context: ctx, ...(data !== undefined ? { data } : {}) }, msg);
      },
      warn: (ctx: string, msg: string, data?: unknown) => {
        if (shouldLog('warn')) baseLogger.warn({ context: ctx, ...(data !== undefined ? { data } : {}) }, msg);
      },
      error: (ctx: string, msg: string, data?: unknown) => {
        if (shouldLog('error')) baseLogger.error({ context: ctx, ...(data !== undefined ? { data } : {}) }, msg);
      },
    };
    return pinoLogger;
  } catch {
    return consoleLogger;
  }
}

// Start Pino init in background (don't block)
initPino();

// ─── Public API ─────────────────────────────────────────────────────────────────

export const logger = {
  debug: (context: string, message: string, data?: unknown) => {
    if (pinoLogger) pinoLogger.debug(context, message, data);
    else consoleLogger.debug(context, message, data);
  },
  info: (context: string, message: string, data?: unknown) => {
    if (pinoLogger) pinoLogger.info(context, message, data);
    else consoleLogger.info(context, message, data);
  },
  warn: (context: string, message: string, data?: unknown) => {
    if (pinoLogger) pinoLogger.warn(context, message, data);
    else consoleLogger.warn(context, message, data);
  },
  error: (context: string, message: string, data?: unknown) => {
    if (pinoLogger) pinoLogger.error(context, message, data);
    else consoleLogger.error(context, message, data);
  },
};
