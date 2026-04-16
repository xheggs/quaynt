import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { userPreference } from './user-preference.schema';

export async function getOrCreateUserPreference(userId: string) {
  const [existing] = await db
    .select()
    .from(userPreference)
    .where(eq(userPreference.userId, userId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(userPreference)
    .values({ userId })
    .onConflictDoNothing()
    .returning();

  if (!created) {
    const [fetched] = await db
      .select()
      .from(userPreference)
      .where(eq(userPreference.userId, userId))
      .limit(1);
    return fetched;
  }

  return created;
}

export async function updateUserPreference(userId: string, input: { locale?: string | null }) {
  const updateData: Record<string, unknown> = {};
  if (input.locale !== undefined) updateData.locale = input.locale;

  if (Object.keys(updateData).length === 0) {
    return getOrCreateUserPreference(userId);
  }

  // Ensure preference record exists
  await getOrCreateUserPreference(userId);

  const [updated] = await db
    .update(userPreference)
    .set(updateData)
    .where(eq(userPreference.userId, userId))
    .returning();

  return updated;
}
