import { boolean, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { generatePrefixedId } from '@/lib/db/id';
import { timestamps } from '@/lib/db/helpers';

export const user = pgTable('user', {
  id: text()
    .primaryKey()
    .$defaultFn(() => generatePrefixedId('user')),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  ...timestamps,
});

export const session = pgTable(
  'session',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('session')),
    expiresAt: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
    token: text().notNull().unique(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [index('session_user_id_idx').on(table.userId)]
);

export const account = pgTable(
  'account',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('account')),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true, mode: 'date' }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true, mode: 'date' }),
    scope: text(),
    password: text(),
    ...timestamps,
  },
  (table) => [index('account_user_id_idx').on(table.userId)]
);

export const verification = pgTable(
  'verification',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('verification')),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
    ...timestamps,
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)]
);
