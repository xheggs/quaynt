import pino from 'pino';

const globalForLogger = globalThis as unknown as { logger: pino.Logger | undefined };

export const logger: pino.Logger =
  globalForLogger.logger ??
  pino({
    name: 'quaynt',
    level: process.env.LOG_LEVEL ?? 'info',
    ...(process.env.NODE_ENV !== 'production' && {
      transport: { target: 'pino-pretty' },
    }),
  });

if (process.env.NODE_ENV !== 'production') {
  globalForLogger.logger = logger;
}

const requestLoggerMap = new WeakMap<Request, pino.Logger>();

export function setRequestLogger(req: Request, child: pino.Logger): void {
  requestLoggerMap.set(req, child);
}

export function getRequestLogger(req: Request): pino.Logger {
  return requestLoggerMap.get(req) ?? logger;
}
