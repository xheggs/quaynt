import { timestamp } from 'drizzle-orm/pg-core';

export const timestamps = {
  createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
};
