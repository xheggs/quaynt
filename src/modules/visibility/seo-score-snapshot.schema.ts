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
 * Persistent per-period snapshots of the brand-level SEO Score composite.
 * One row per (workspaceId, brandId, periodStart, granularity, platformId, locale).
 * platformId and locale default to '_all' (v1 does not slice by platform/locale;
 * the columns exist so a v2 or 6.5b can slice without migration).
 */
export const seoScoreSnapshot = pgTable(
  'seo_score_snapshot',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('seoScoreSnapshot')),
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
    querySetSize: integer().notNull().default(0),
    dataQualityAdvisories: text().array().notNull().default([]),
    /**
     * Null when the score was computed successfully. Otherwise one of
     * NO_GSC_CONNECTION | NO_ENABLED_PROMPT_SETS | NO_BRAND_QUERY_SET |
     * INSUFFICIENT_FACTORS.
     */
    code: text(),
    factors: jsonb().notNull(),
    inputs: jsonb().notNull(),
    computedAt: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('seo_score_snapshot_unique_idx').on(
      table.workspaceId,
      table.brandId,
      table.periodStart,
      table.granularity,
      table.platformId,
      table.locale
    ),
    index('seo_score_snapshot_brand_period_idx').on(
      table.workspaceId,
      table.brandId,
      table.periodStart
    ),
  ]
);

/**
 * Tracks which SEO score formula versions have had their 90-day backfill applied.
 * On worker startup, a singleton backfill job is enqueued only when the current
 * FORMULA_VERSION has no matching row. Self-healing across rolling deploys.
 */
export const seoScoreFormulaMigration = pgTable('seo_score_formula_migration', {
  formulaVersion: integer().primaryKey(),
  appliedAt: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
