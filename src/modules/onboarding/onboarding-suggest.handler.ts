import type { PgBoss } from 'pg-boss';
import { logger } from '@/lib/logger';
import { extractSite, ExtractSiteError } from './extractor';
import { updateSuggestion } from './onboarding-suggest.service';
import type {
  OnboardingSuggestionCompetitor,
  OnboardingSuggestionError,
  OnboardingSuggestionExtracted,
  OnboardingSuggestionPrompt,
} from './onboarding.schema';
import { buildCompetitorPrompt, buildPromptGenerationPrompt } from './suggestion-engine/prompts';
import { suggestedCompetitorsSchema, suggestedPromptsSchema } from './suggestion-engine/schemas';
import {
  getSuggestionEngine,
  SuggestionEngineError,
  type SuggestionEngine,
} from './suggestion-engine';

export type OnboardingSuggestJobData = {
  suggestionId: string;
  workspaceId: string;
  domain: string;
  baseUrl: string;
  roleHint: string | null;
  locale: string | null;
};

export const ONBOARDING_SUGGEST_QUEUE = 'onboarding-suggest';

const log = logger.child({ module: 'onboarding-suggest' });

export type OnboardingSuggestHandlerDeps = {
  /** Override for tests. Defaults to `extractSite` from `./extractor`. */
  extractSite?: typeof extractSite;
  /** Override for tests. Defaults to `getSuggestionEngine()`. */
  resolveEngine?: () => SuggestionEngine | null;
};

export async function registerOnboardingSuggestHandler(
  boss: PgBoss,
  deps: OnboardingSuggestHandlerDeps = {}
): Promise<void> {
  await boss.work<OnboardingSuggestJobData>(
    ONBOARDING_SUGGEST_QUEUE,
    { includeMetadata: true, localConcurrency: 3 },
    async (jobs) => {
      for (const job of jobs) {
        await runOnboardingSuggest(job.data, deps).catch((e) => {
          log.error({ err: e, jobId: job.id }, 'onboarding-suggest handler crashed');
          throw e;
        });
      }
    }
  );
}

/**
 * Pure handler entry-point — exported for tests so they can drive the pipeline
 * without spinning up pg-boss. The pg-boss `work()` callback above just calls
 * this for each job.
 */
export async function runOnboardingSuggest(
  data: OnboardingSuggestJobData,
  deps: OnboardingSuggestHandlerDeps = {}
): Promise<void> {
  const extract = deps.extractSite ?? extractSite;
  const resolveEngine = deps.resolveEngine ?? getSuggestionEngine;

  // 1. Fetch + extract.
  await updateSuggestion(data.suggestionId, { status: 'fetching' });
  let extracted: OnboardingSuggestionExtracted;
  try {
    extracted = await extract(data.baseUrl);
  } catch (e) {
    const code = e instanceof ExtractSiteError ? e.code : 'fetch_failed';
    const message = (e as Error).message ?? String(e);
    const errorRecord: OnboardingSuggestionError = { code, message, stage: 'fetch' };
    await updateSuggestion(data.suggestionId, {
      status: 'failed',
      error: errorRecord,
      completedAt: new Date(),
    });
    log.warn({ suggestionId: data.suggestionId, code }, 'Extractor failed');
    return;
  }
  await updateSuggestion(data.suggestionId, { extracted });

  // 2. Resolve engine. No engine → done with brand-only output (OSS path).
  const engine = resolveEngine();
  if (!engine) {
    await updateSuggestion(data.suggestionId, {
      status: 'done',
      engineUsed: null,
      completedAt: new Date(),
    });
    return;
  }

  // 3. Competitor inference (per-step error isolation).
  await updateSuggestion(data.suggestionId, { status: 'suggesting' });
  let competitors: OnboardingSuggestionCompetitor[] | null = null;
  let competitorError: OnboardingSuggestionError | null = null;
  try {
    const result = await engine.suggest(
      buildCompetitorPrompt({
        brandName: extracted.brandName,
        description: extracted.description,
        categories: extracted.categories,
        domain: data.domain,
        roleHint: data.roleHint,
      }),
      suggestedCompetitorsSchema,
      { locale: data.locale ?? undefined }
    );
    competitors = result.competitors.map((c) => ({
      name: c.name,
      domain: c.domain ?? null,
      reason: c.reason ?? null,
    }));
  } catch (e) {
    competitorError = engineErrorToRecord(e, 'competitors');
    log.warn(
      { suggestionId: data.suggestionId, code: competitorError.code },
      'Competitor suggestion failed'
    );
  }
  await updateSuggestion(data.suggestionId, {
    suggestedCompetitors: competitors,
  });

  // 4. Prompt generation (per-step error isolation).
  let prompts: OnboardingSuggestionPrompt[] | null = null;
  let promptError: OnboardingSuggestionError | null = null;
  try {
    const result = await engine.suggest(
      buildPromptGenerationPrompt({
        brandName: extracted.brandName,
        description: extracted.description,
        categories: extracted.categories,
        domain: data.domain,
        roleHint: data.roleHint,
      }),
      suggestedPromptsSchema,
      { locale: data.locale ?? undefined }
    );
    prompts = result.prompts.map((p) => ({ text: p.text, tag: p.tag ?? null }));
  } catch (e) {
    promptError = engineErrorToRecord(e, 'prompts');
    log.warn(
      { suggestionId: data.suggestionId, code: promptError.code },
      'Prompt suggestion failed'
    );
  }

  // 5. Finalize. We keep partial success: the UI shows manual fallback only
  // for the section that failed.
  const finalError = competitorError ?? promptError;
  await updateSuggestion(data.suggestionId, {
    status: 'done',
    suggestedPrompts: prompts,
    engineUsed: engine.providerId,
    error: finalError,
    completedAt: new Date(),
  });
}

function engineErrorToRecord(
  e: unknown,
  stage: OnboardingSuggestionError['stage']
): OnboardingSuggestionError {
  if (e instanceof SuggestionEngineError) {
    return { code: e.code, message: e.message, stage };
  }
  return {
    code: 'engine_unavailable',
    message: (e as Error).message ?? 'Unknown engine error',
    stage,
  };
}
