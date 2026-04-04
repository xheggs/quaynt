import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { parsePagination, formatPaginatedResponse } from '@/lib/api/pagination';
import { apiSuccess, badRequest } from '@/lib/api/response';
import {
  getOpportunities,
  OPPORTUNITY_ALLOWED_SORTS,
} from '@/modules/visibility/opportunity.service';
import type { OpportunityType } from '@/modules/visibility/opportunity.types';

const typeEnum = z.enum(['missing', 'weak']);

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const pagination = parsePagination(req.nextUrl.searchParams, OPPORTUNITY_ALLOWED_SORTS);
          if (pagination instanceof NextResponse) return pagination;

          const auth = getAuthContext(req);
          const params = req.nextUrl.searchParams;

          const promptSetId = params.get('promptSetId');
          if (!promptSetId) {
            return badRequest('A prompt set (market) is required to view opportunities');
          }

          const brandId = params.get('brandId');
          if (!brandId) {
            return badRequest('A brand is required to view opportunities');
          }

          // Validate optional type filter
          const rawType = params.get('type');
          if (rawType) {
            const parsed = typeEnum.safeParse(rawType);
            if (!parsed.success) {
              return badRequest("Type must be 'missing' or 'weak'");
            }
          }

          // Validate optional minCompetitorCount
          const rawMinCompetitors = params.get('minCompetitorCount');
          let minCompetitorCount: number | undefined;
          if (rawMinCompetitors) {
            const parsed = z.coerce.number().int().min(1).safeParse(rawMinCompetitors);
            if (!parsed.success) {
              return badRequest('minCompetitorCount must be a positive integer');
            }
            minCompetitorCount = parsed.data;
          }

          const filters = {
            promptSetId,
            brandId,
            type: (rawType as OpportunityType) ?? undefined,
            minCompetitorCount,
            platformId: params.get('platformId') ?? undefined,
            from: params.get('from') ?? undefined,
            to: params.get('to') ?? undefined,
          };

          const { items, total, summary } = await getOpportunities(
            auth.workspaceId,
            filters,
            pagination
          );

          return apiSuccess({
            ...formatPaginatedResponse(items, total, pagination.page, pagination.limit),
            summary,
          });
        }, 'read')
      )
    )
  )
);
