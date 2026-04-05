import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { db } from '@/lib/db';
import { alertEvent } from '@/modules/alerts/alert.schema';

export const GET = withRequestId(
  withRequestLog(async (_req: Request, ctx: { params: Promise<{ eventId: string }> }) => {
    const { eventId } = await ctx.params;

    const [event] = await db.select().from(alertEvent).where(eq(alertEvent.id, eventId)).limit(1);

    if (!event) {
      return NextResponse.json({ error: 'Alert event not found' }, { status: 404 });
    }

    // When Phase 5 UI is built, redirect to the alert event detail view.
    // For now, return the event data as JSON.
    return NextResponse.json({ data: event });
  })
);
