import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { parsePagination, formatPaginatedResponse } from '@/lib/api/pagination';
import { apiSuccess, badRequest } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { listCitations, CITATION_ALLOWED_SORTS } from '@/modules/citations/citation.service';

const citationTypeEnum = z.enum(['owned', 'earned']);
const sentimentLabelEnum = z.enum(['positive', 'neutral', 'negative']);

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const pagination = parsePagination(req.nextUrl.searchParams, CITATION_ALLOWED_SORTS);
          if (pagination instanceof NextResponse) return pagination;

          const auth = getAuthContext(req);
          const t = await apiErrors();
          const params = req.nextUrl.searchParams;

          // Validate optional citationType filter
          const rawCitationType = params.get('citationType');
          if (rawCitationType) {
            const parsed = citationTypeEnum.safeParse(rawCitationType);
            if (!parsed.success) {
              return badRequest(t('validation.invalidCitationType'));
            }
          }

          // Validate optional sentiment filter
          const rawSentiment = params.get('sentiment');
          if (rawSentiment) {
            const parsed = sentimentLabelEnum.safeParse(rawSentiment);
            if (!parsed.success) {
              return badRequest(t('validation.invalidSentiment'));
            }
          }

          const filters = {
            brandId: params.get('brandId') ?? undefined,
            platformId: params.get('platformId') ?? undefined,
            citationType: rawCitationType as 'owned' | 'earned' | undefined,
            modelRunId: params.get('modelRunId') ?? undefined,
            locale: params.get('locale') ?? undefined,
            sentimentLabel: rawSentiment as 'positive' | 'neutral' | 'negative' | undefined,
            from: params.get('from') ?? undefined,
            to: params.get('to') ?? undefined,
          };

          const { items, total } = await listCitations(auth.workspaceId, filters, pagination);

          return apiSuccess(
            formatPaginatedResponse(items, total, pagination.page, pagination.limit)
          );
        }, 'read')
      )
    )
  )
);
