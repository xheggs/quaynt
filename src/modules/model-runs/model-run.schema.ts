import {
  pgTable,
  pgEnum,
  text,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { generatePrefixedId } from '@/lib/db/id';
import { timestamps } from '@/lib/db/helpers';
import { workspace } from '@/modules/workspace/workspace.schema';
import { promptSet } from '@/modules/prompt-sets/prompt-set.schema';
import { brand } from '@/modules/brands/brand.schema';
import { prompt } from '@/modules/prompt-sets/prompt.schema';
import { platformAdapter } from '@/modules/adapters/adapter.schema';

export const modelRunStatus = pgEnum('model_run_status', [
  'pending',
  'running',
  'completed',
  'partial',
  'failed',
  'cancelled',
]);

export const modelRunResultStatus = pgEnum('model_run_result_status', [
  'pending',
  'running',
  'completed',
  'failed',
  'skipped',
]);

export const modelRun = pgTable(
  'model_run',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('modelRun')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    promptSetId: text()
      .notNull()
      .references(() => promptSet.id),
    brandId: text()
      .notNull()
      .references(() => brand.id),
    adapterConfigIds: text().array().notNull(),
    locale: text(),
    market: text(),
    status: modelRunStatus().notNull().default('pending'),
    totalResults: integer().notNull(),
    pendingResults: integer().notNull(),
    errorSummary: text(),
    startedAt: timestamp({ withTimezone: true, mode: 'date' }),
    completedAt: timestamp({ withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    index('model_run_workspace_id_idx').on(table.workspaceId),
    index('model_run_workspace_status_idx').on(table.workspaceId, table.status),
    index('model_run_workspace_created_at_idx').on(table.workspaceId, table.createdAt),
    index('model_run_prompt_set_id_idx').on(table.promptSetId),
    index('model_run_brand_id_idx').on(table.brandId),
  ]
);

export const modelRunResult = pgTable(
  'model_run_result',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('modelRunResult')),
    modelRunId: text()
      .notNull()
      .references(() => modelRun.id, { onDelete: 'cascade' }),
    promptId: text()
      .notNull()
      .references(() => prompt.id),
    adapterConfigId: text()
      .notNull()
      .references(() => platformAdapter.id),
    platformId: text().notNull(),
    interpolatedPrompt: text().notNull(),
    status: modelRunResultStatus().notNull().default('pending'),
    rawResponse: jsonb(),
    textContent: text(),
    responseMetadata: jsonb(),
    error: text(),
    startedAt: timestamp({ withTimezone: true, mode: 'date' }),
    completedAt: timestamp({ withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    index('model_run_result_run_id_idx').on(table.modelRunId),
    index('model_run_result_run_status_idx').on(table.modelRunId, table.status),
    uniqueIndex('model_run_result_unique_idx').on(
      table.modelRunId,
      table.promptId,
      table.adapterConfigId
    ),
  ]
);
