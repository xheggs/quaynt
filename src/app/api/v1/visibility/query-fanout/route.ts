import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, badRequest } from '@/lib/api/response';
import {
  getFanoutByModelRun,
  type FanoutSourceFilter,
} from '@/modules/query-fanout/query-fanout.service';

/**
 * GET /api/v1/visibility/query-fanout
 *
 * Returns the observed query fan-out tree for a model run, one tree per result.
 *
 * Query parameters:
 *   - `modelRunId` (required)
 *   - `modelRunResultId` (optional — narrow to one result)
 *   - `platformId` (optional)
 *   - `promptId` (optional)
 *   - `source` (optional: `observed` | `simulated` | `both`; defaults to `both`)
 *
 * Response: `{ data: QueryFanoutTreeResponse[], meta: { totalResults, totalSubQueries, totalSources, totalSimulatedSubQueries } }`.
 *
 * Scoped to the caller's workspace — cross-workspace requests return empty
 * `data` rather than 403, consistent with other visibility endpoints.
 */
export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);
          const params = req.nextUrl.searchParams;

          const modelRunId = params.get('modelRunId');
          if (!modelRunId) {
            return badRequest('A modelRunId is required to view query fan-out');
          }

          const rawSource = params.get('source');
          const source: FanoutSourceFilter | undefined =
            rawSource === 'observed' || rawSource === 'simulated' || rawSource === 'both'
              ? rawSource
              : undefined;

          const filters = {
            modelRunResultId: params.get('modelRunResultId') ?? undefined,
            platformId: params.get('platformId') ?? undefined,
            promptId: params.get('promptId') ?? undefined,
            source,
          };

          const data = await getFanoutByModelRun(auth.workspaceId, modelRunId, filters);

          let totalSubQueries = 0;
          let totalSimulatedSubQueries = 0;
          let totalSources = 0;
          for (const tree of data) {
            totalSubQueries += tree.subQueries.length;
            totalSources += tree.rootSources.length;
            for (const subQuery of tree.subQueries) {
              if (subQuery.isSimulated) totalSimulatedSubQueries += 1;
              totalSources += subQuery.sources.length;
            }
          }

          return apiSuccess({
            data,
            meta: {
              totalResults: data.length,
              totalSubQueries,
              totalSimulatedSubQueries,
              totalSources,
            },
          });
        }, 'read')
      )
    )
  )
);
