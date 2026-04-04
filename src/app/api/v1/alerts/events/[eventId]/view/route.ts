import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { alertEvent } from '@/modules/alerts/alert.schema';

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  const [event] = await db.select().from(alertEvent).where(eq(alertEvent.id, eventId)).limit(1);

  if (!event) {
    return NextResponse.json({ error: 'Alert event not found' }, { status: 404 });
  }

  // When Phase 5 UI is built, redirect to the alert event detail view.
  // For now, return the event data as JSON.
  return NextResponse.json({ data: event });
}
