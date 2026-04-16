import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiCreated, badRequest } from '@/lib/api/response';
import { getRequestLogger } from '@/lib/logger';
import { createBoss } from '@/lib/jobs/boss';
import { pushVisits } from '@/modules/crawler/crawler-visit.service';

const visitSchema = z.object({
  botName: z.string().optional(),
  userAgent: z.string().min(1),
  requestPath: z.string().min(1),
  requestMethod: z.string().default('GET'),
  statusCode: z.number().int().min(100).max(599).default(200),
  responseBytes: z.number().int().min(0).default(0),
  visitedAt: z.string().datetime(),
});

const pushSchema = z.object({
  visits: z.array(visitSchema).min(1).max(1000),
});

// POST /api/v1/crawler/visits — push visit data via API
export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);
          const log = getRequestLogger(req);

          let body: unknown;
          try {
            body = await req.json();
          } catch {
            return badRequest('Invalid JSON body');
          }

          const parsed = pushSchema.safeParse(body);
          if (!parsed.success) {
            return badRequest('Validation failed', parsed.error.flatten().fieldErrors);
          }

          const result = await pushVisits(auth.workspaceId, parsed.data.visits);

          // Enqueue aggregate jobs for affected dates
          if (result.accepted > 0) {
            const boss = createBoss();
            // Get unique dates from accepted visits
            const dates = new Set(parsed.data.visits.map((v) => v.visitedAt.slice(0, 10)));
            for (const date of dates) {
              await boss.send(
                'crawler-aggregate',
                { workspaceId: auth.workspaceId, date },
                {
                  singletonKey: `crawler-agg:${auth.workspaceId}:${date}`,
                  singletonSeconds: 120,
                }
              );
            }
          }

          log.info(
            { accepted: result.accepted, rejected: result.rejected },
            'Crawler visits pushed'
          );

          return apiCreated({
            accepted: result.accepted,
            rejected: result.rejected,
            errors: result.errors.length > 0 ? result.errors : undefined,
          });
        }, 'read-write'),
        { points: 30, duration: 60 }
      )
    )
  )
);
