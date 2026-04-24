import {
  pgTable,
  text,
  integer,
  date,
  numeric,
  jsonb,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { generatePrefixedId } from '@/lib/db/id';
import { timestamps } from '@/lib/db/helpers';
import { workspace } from '@/modules/workspace/workspace.schema';
import { brand } from '@/modules/brands/brand.schema';

/**
 * Persistent per-period snapshots of the brand-level GEO Score composite.
 * One row per (workspaceId, brandId, periodStart, granularity, platformId, locale).
 * platformId and locale default to '_all' (v1 does not slice by platform/locale).
 */
export const geoScoreSnapshot = pgTable(
  'geo_score_snapshot',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('geoScoreSnapshot')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    brandId: text()
      .notNull()
      .references(() => brand.id, { onDelete: 'cascade' }),
    periodStart: date({ mode: 'string' }).notNull(),
    periodEnd: date({ mode: 'string' }).notNull(),
    granularity: text().notNull(), // 'weekly' | 'monthly'
    platformId: text().notNull().default('_all'),
    locale: text().notNull().default('_all'),
    composite: numeric({ precision: 4, scale: 1 }),
    compositeRaw: numeric({ precision: 4, scale: 1 }),
    displayCapApplied: boolean().notNull().default(false),
    formulaVersion: integer().notNull(),
    contributingPromptSetIds: text().array().notNull().default([]),
    factors: jsonb().notNull(),
    inputs: jsonb().notNull(),
    computedAt: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('geo_score_snapshot_unique_idx').on(
      table.workspaceId,
      table.brandId,
      table.periodStart,
      table.granularity,
      table.platformId,
      table.locale
    ),
    index('geo_score_snapshot_brand_period_idx').on(
      table.workspaceId,
      table.brandId,
      table.periodStart
    ),
  ]
);

/**
 * Tracks which formula versions have had their 90-day backfill applied.
 * On worker startup, a singleton backfill job is enqueued only when the current
 * FORMULA_VERSION has no matching row. Self-healing across rolling deploys.
 */
export const geoScoreFormulaMigration = pgTable('geo_score_formula_migration', {
  formulaVersion: integer().primaryKey(),
  appliedAt: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
