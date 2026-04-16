import { pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { generatePrefixedId } from '@/lib/db/id';
import { timestamps } from '@/lib/db/helpers';
import { user } from '@/modules/auth/auth.schema';

export const userPreference = pgTable(
  'user_preference',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('userPreference')),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    locale: varchar({ length: 10 }),
    ...timestamps,
  },
  (table) => [uniqueIndex('user_preference_user_id_idx').on(table.userId)]
);
