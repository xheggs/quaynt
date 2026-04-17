import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withPublicCollector } from '@/lib/api/public-middleware';
import { apiNoContent, badRequest, apiError } from '@/lib/api/response';
import { getRequestLogger } from '@/lib/logger';
import { collectVisit } from '@/modules/traffic/traffic-collector.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE_KEY_PATTERN = /^tsk_[a-zA-Z0-9]{32,}$/;

const PayloadSchema = z.object({
  referrer: z.string().max(2048).nullable().optional(),
  landingPath: z.string().min(1).max(2048),
  userAgentFamily: z.string().max(20).optional(),
});

/**
 * Parses a body that may arrive as either `application/json` or `text/plain` —
 * `navigator.sendBeacon` defaults to `text/plain` when passed a raw string and to the
 * explicit MIME type when passed a Blob. Both are tolerated.
 */
async function parseBody(req: NextRequest): Promise<unknown> {
  const text = await req.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function collectorHandler(
  req: NextRequest,
  ctx: { params: Promise<{ siteKey: string }> }
): Promise<NextResponse> {
  const log = getRequestLogger(req);
  const { siteKey } = await ctx.params;

  // Honor opt-out headers — return 204 with no DB write. Sec-GPC is enforced by Firefox
  // and DuckDuckGo today; DNT is effectively deprecated but still respected as a courtesy.
  if (req.headers.get('dnt') === '1' || req.headers.get('sec-gpc') === '1') {
    return apiNoContent();
  }

  // Path-level validation — reject malformed keys without a DB round-trip.
  if (!SITE_KEY_PATTERN.test(siteKey)) {
    return apiNoContent();
  }

  const parsedBody = await parseBody(req);
  const validation = PayloadSchema.safeParse(parsedBody);
  if (!validation.success) {
    return badRequest();
  }

  const userAgent = req.headers.get('user-agent') ?? '';
  const requestOrigin = req.headers.get('origin');

  const result = await collectVisit({
    siteKeyPlaintext: siteKey,
    payload: validation.data,
    userAgent,
    requestOrigin,
  });

  if (!result.accepted) {
    log.debug({ reason: result.reason }, 'collector dropped visit');
  }

  // Silent acceptance on every outcome so response codes don't leak which referrers
  // count as "AI sources" or which site keys are valid.
  return apiNoContent();
}

export const POST = withPublicCollector(collectorHandler, {
  keyExtractor: async (_req, ctx) => (await ctx.params).siteKey,
});

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  response.headers.set('Access-Control-Max-Age', '86400');
  return response;
}

export async function GET() {
  return apiError('METHOD_NOT_ALLOWED', 'METHOD_NOT_ALLOWED', 405);
}
