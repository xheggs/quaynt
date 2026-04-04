import { pgTable, pgEnum, text, integer, numeric, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { generatePrefixedId } from '@/lib/db/id';
import { timestamps } from '@/lib/db/helpers';
import { workspace } from '@/modules/workspace/workspace.schema';
import { brand } from '@/modules/brands/brand.schema';
import { modelRun, modelRunResult } from '@/modules/model-runs/model-run.schema';

export const citationType = pgEnum('citation_type', ['owned', 'earned']);
export const sentimentLabel = pgEnum('sentiment_label', ['positive', 'neutral', 'negative']);

export const citation = pgTable(
  'citation',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('citation')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    brandId: text()
      .notNull()
      .references(() => brand.id, { onDelete: 'restrict' }),
    modelRunId: text()
      .notNull()
      .references(() => modelRun.id, { onDelete: 'cascade' }),
    modelRunResultId: text()
      .notNull()
      .references(() => modelRunResult.id, { onDelete: 'cascade' }),
    platformId: text().notNull(),
    citationType: citationType().notNull(),
    position: integer().notNull(),
    contextSnippet: text(),
    relevanceSignal: text().notNull(),
    sourceUrl: text().notNull(),
    title: text(),
    locale: text(),
    sentimentLabel: sentimentLabel(),
    sentimentScore: numeric({ precision: 5, scale: 4 }),
    sentimentConfidence: numeric({ precision: 3, scale: 2 }),
    normalizedUrl: text(),
    domain: text(),
    ...timestamps,
  },
  (table) => [
    index('citation_workspace_id_idx').on(table.workspaceId),
    index('citation_brand_id_idx').on(table.brandId),
    index('citation_model_run_id_idx').on(table.modelRunId),
    index('citation_model_run_result_id_idx').on(table.modelRunResultId),
    index('citation_workspace_brand_platform_idx').on(
      table.workspaceId,
      table.brandId,
      table.platformId
    ),
    index('citation_locale_idx').on(table.locale),
    index('citation_workspace_created_at_idx').on(table.workspaceId, table.createdAt),
    uniqueIndex('citation_result_url_unique_idx').on(table.modelRunResultId, table.sourceUrl),
    index('citation_workspace_sentiment_idx').on(table.workspaceId, table.sentimentLabel),
    index('citation_workspace_domain_idx').on(table.workspaceId, table.domain),
  ]
);
