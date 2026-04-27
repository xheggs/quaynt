import { index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { generatePrefixedId } from '@/lib/db/id';
import { timestamps } from '@/lib/db/helpers';
import { workspace } from '@/modules/workspace/workspace.schema';

export const onboardingStepEnum = pgEnum('onboarding_step', [
  'welcome',
  'brand',
  'competitors',
  'prompt_set',
  'first_run',
  'done',
]);

export type OnboardingStep = (typeof onboardingStepEnum.enumValues)[number];

export type OnboardingMilestones = {
  brandAdded: boolean;
  competitorsAdded: boolean;
  promptSetSelected: boolean;
  firstRunTriggered: boolean;
  firstCitationSeen: boolean;
  tourCompleted: boolean;
};

export const DEFAULT_ONBOARDING_MILESTONES: OnboardingMilestones = {
  brandAdded: false,
  competitorsAdded: false,
  promptSetSelected: false,
  firstRunTriggered: false,
  firstCitationSeen: false,
  tourCompleted: false,
};

export const workspaceOnboarding = pgTable(
  'workspace_onboarding',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('onboardingRow')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    step: onboardingStepEnum().notNull().default('welcome'),
    roleHint: text(),
    milestones: jsonb()
      .$type<OnboardingMilestones>()
      .notNull()
      .default(DEFAULT_ONBOARDING_MILESTONES),
    completedAt: timestamp({ withTimezone: true, mode: 'date' }),
    dismissedAt: timestamp({ withTimezone: true, mode: 'date' }),
    /** Updated on every (app)/layout request — drives second_session telemetry. */
    lastSeenAt: timestamp({ withTimezone: true, mode: 'date' }),
    /** Once-per-workspace flag preventing duplicate `second_session` emission. */
    secondSessionEmittedAt: timestamp({ withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (table) => [uniqueIndex('workspace_onboarding_ws_idx').on(table.workspaceId)]
);

export const onboardingSuggestionStatusEnum = pgEnum('onboarding_suggestion_status', [
  'pending',
  'fetching',
  'suggesting',
  'done',
  'failed',
]);

export type OnboardingSuggestionStatus = (typeof onboardingSuggestionStatusEnum.enumValues)[number];

export type OnboardingSuggestionExtracted = {
  brandName: string;
  aliases: string[];
  description: string | null;
  categories: string[];
};

export type OnboardingSuggestionCompetitor = {
  name: string;
  domain: string | null;
  reason: string | null;
};

export type OnboardingSuggestionPrompt = {
  text: string;
  tag: string | null;
};

export type OnboardingSuggestionError = {
  code: string;
  message: string;
  stage: 'fetch' | 'aliases' | 'competitors' | 'prompts';
};

export const onboardingSuggestion = pgTable(
  'onboarding_suggestion',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('onboardingSuggestion')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    domain: text().notNull(),
    status: onboardingSuggestionStatusEnum().notNull().default('pending'),
    error: jsonb().$type<OnboardingSuggestionError | null>(),
    extracted: jsonb().$type<OnboardingSuggestionExtracted | null>(),
    suggestedCompetitors: jsonb().$type<OnboardingSuggestionCompetitor[] | null>(),
    suggestedPrompts: jsonb().$type<OnboardingSuggestionPrompt[] | null>(),
    suggestedAliases: jsonb().$type<string[] | null>(),
    engineUsed: text(),
    completedAt: timestamp({ withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    index('onboarding_suggestion_lookup_idx').on(
      table.workspaceId,
      table.domain,
      table.createdAt.desc()
    ),
    index('onboarding_suggestion_done_idx')
      .on(table.workspaceId, table.domain, table.createdAt.desc())
      .where(sql`${table.status} = 'done'`),
  ]
);
