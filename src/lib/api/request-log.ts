import type { NextRequest } from 'next/server';
import { logger, setRequestLogger } from '@/lib/logger';
import { getRequestId } from './request-id';
import { apiError } from './response';
import type { ApiHandler } from './types';

export function withRequestLog<T extends Record<string, string> = Record<string, string>>(
  handler: ApiHandler<T>
): ApiHandler<T> {
  return async (req: NextRequest, ctx) => {
    const requestId = getRequestId(req);
    const method = req.method;
    const url = req.nextUrl.pathname;

    const childLogger = logger.child({ requestId, method, url });
    setRequestLogger(req, childLogger);

    childLogger.info(
      {
        userAgent: req.headers.get('user-agent'),
        ip: req.headers.get('x-forwarded-for'),
      },
      'request received'
    );

    const start = performance.now();

    try {
      const response = await handler(req, ctx);
      const durationMs = Math.round(performance.now() - start);
      const statusCode = response.status;

      const logData = { statusCode, durationMs };

      if (statusCode >= 500) {
        childLogger.error(logData, 'request completed');
      } else if (statusCode >= 400) {
        childLogger.warn(logData, 'request completed');
      } else {
        childLogger.info(logData, 'request completed');
      }

      return response;
    } catch (error) {
      const durationMs = Math.round(performance.now() - start);
      childLogger.error({ err: error, durationMs }, 'unhandled error in request handler');
      return apiError('INTERNAL_SERVER_ERROR', 'INTERNAL_SERVER_ERROR', 500);
    }
  };
}
