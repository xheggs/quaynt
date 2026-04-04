import { pgTable, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { generatePrefixedId } from '@/lib/db/id';
import { promptSet } from './prompt-set.schema';

export const prompt = pgTable(
  'prompt',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('prompt')),
    promptSetId: text()
      .notNull()
      .references(() => promptSet.id, { onDelete: 'cascade' }),
    template: text().notNull(),
    order: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('prompt_prompt_set_id_idx').on(table.promptSetId),
    index('prompt_prompt_set_order_idx').on(table.promptSetId, table.order),
  ]
);
