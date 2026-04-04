import {
  pgTable,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { isNull } from 'drizzle-orm';
import { generatePrefixedId } from '@/lib/db/id';
import { timestamps } from '@/lib/db/helpers';
import { workspace } from '@/modules/workspace/workspace.schema';

export const platformAdapter = pgTable(
  'platform_adapter',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('platformAdapter')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    platformId: text().notNull(),
    displayName: text().notNull(),
    enabled: boolean().notNull().default(true),
    credentials: jsonb().notNull().default({}),
    config: jsonb().notNull().default({}),
    rateLimitPoints: integer().notNull().default(60),
    rateLimitDuration: integer().notNull().default(60),
    timeoutMs: integer().notNull().default(30_000),
    maxRetries: integer().notNull().default(3),
    circuitBreakerThreshold: integer().notNull().default(50),
    circuitBreakerResetMs: integer().notNull().default(60_000),
    lastHealthStatus: text(),
    lastHealthCheckedAt: timestamp({ withTimezone: true, mode: 'date' }),
    deletedAt: timestamp({ withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    index('platform_adapter_workspace_id_idx').on(table.workspaceId),
    uniqueIndex('platform_adapter_workspace_platform_idx')
      .on(table.workspaceId, table.platformId)
      .where(isNull(table.deletedAt)),
  ]
);
