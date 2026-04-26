// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runOnboardingSuggest, type OnboardingSuggestJobData } from './onboarding-suggest.handler';
import { ExtractSiteError, type ExtractSiteResult } from './extractor';
import { SuggestionEngineError, type SuggestionEngine } from './suggestion-engine';

vi.mock('./onboarding-suggest.service', () => {
  const updates: Record<string, unknown>[] = [];
  return {
    updates,
    updateSuggestion: vi.fn(async (_id: string, patch: Record<string, unknown>) => {
      updates.push(patch);
    }),
  };
});

import * as service from './onboarding-suggest.service';

const baseJob: OnboardingSuggestJobData = {
  suggestionId: 'onbsug_test',
  workspaceId: 'ws_test',
  domain: 'example.com',
  baseUrl: 'https://example.com',
  roleHint: 'seo',
  locale: 'en-US',
};

const goodExtraction: ExtractSiteResult = {
  brandName: 'Acme Analytics',
  aliases: ['Acme'],
  description: 'Real-time analytics for product teams',
  categories: ['Product analytics'],
};

function makeEngine(overrides: Partial<SuggestionEngine> = {}): SuggestionEngine {
  return {
    providerId: 'openai',
    suggest: async (_p, schema) =>
      schema.parse({
        competitors: [{ name: 'Beta Co', domain: 'beta.example', reason: 'similar buyer' }],
        prompts: [{ text: 'best product analytics tool', tag: 'discovery' }],
      }),
    ...overrides,
  };
}

let updates: Record<string, unknown>[];

beforeEach(() => {
  // Reset the recorded updates array
  updates = (service as unknown as { updates: Record<string, unknown>[] }).updates;
  updates.length = 0;
  vi.mocked(service.updateSuggestion).mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runOnboardingSuggest', () => {
  it('engine present → done with brand + competitors + prompts', async () => {
    await runOnboardingSuggest(baseJob, {
      extractSite: async () => goodExtraction,
      resolveEngine: () => makeEngine(),
    });

    const final = lastUpdateMatching('status', 'done');
    expect(final).toBeDefined();
    expect(final?.engineUsed).toBe('openai');
    expect(final?.error).toBeNull();
    const competitorUpdate = lastUpdateWithKey('suggestedCompetitors');
    expect(competitorUpdate?.suggestedCompetitors).toMatchObject([{ name: 'Beta Co' }]);
    const promptUpdate = lastUpdateWithKey('suggestedPrompts');
    expect(promptUpdate?.suggestedPrompts).toMatchObject([{ text: 'best product analytics tool' }]);
  });

  it('engine absent → done with brand only, no engine error', async () => {
    await runOnboardingSuggest(baseJob, {
      extractSite: async () => goodExtraction,
      resolveEngine: () => null,
    });

    const final = lastUpdateMatching('status', 'done');
    expect(final?.engineUsed).toBeNull();
    expect(updates.find((u) => 'suggestedCompetitors' in u)).toBeUndefined();
    expect(updates.find((u) => 'suggestedPrompts' in u)).toBeUndefined();
  });

  it('extractor failure → status=failed with categorized error', async () => {
    await runOnboardingSuggest(baseJob, {
      extractSite: async () => {
        throw new ExtractSiteError('non_html_response', 'Got JSON');
      },
      resolveEngine: () => makeEngine(),
    });

    const final = lastUpdateMatching('status', 'failed');
    expect(final?.error).toMatchObject({ code: 'non_html_response', stage: 'fetch' });
  });

  it('engine fails on competitors only → done with prompts + partial error', async () => {
    let call = 0;
    const engine: SuggestionEngine = {
      providerId: 'openai',
      suggest: async (_p, schema) => {
        call++;
        if (call === 1) {
          throw new SuggestionEngineError('engine_rate_limited', 'rate-limited');
        }
        return schema.parse({
          prompts: [{ text: 'best product analytics tool', tag: 'discovery' }],
        });
      },
    };

    await runOnboardingSuggest(baseJob, {
      extractSite: async () => goodExtraction,
      resolveEngine: () => engine,
    });

    const final = lastUpdateMatching('status', 'done');
    expect(final?.error).toMatchObject({ code: 'engine_rate_limited', stage: 'competitors' });
    const promptUpdate = lastUpdateWithKey('suggestedPrompts');
    expect(promptUpdate?.suggestedPrompts).toMatchObject([{ text: 'best product analytics tool' }]);
  });

  it('engine returns schema-invalid response → engine_response_invalid stored', async () => {
    const engine: SuggestionEngine = {
      providerId: 'anthropic',
      suggest: async () => {
        throw new SuggestionEngineError('engine_response_invalid', 'bad shape');
      },
    };

    await runOnboardingSuggest(baseJob, {
      extractSite: async () => goodExtraction,
      resolveEngine: () => engine,
    });

    const final = lastUpdateMatching('status', 'done');
    expect(final?.error).toMatchObject({ code: 'engine_response_invalid' });
  });

  it('privacy: no recorded update field exceeds 4 KB', async () => {
    await runOnboardingSuggest(baseJob, {
      extractSite: async () => goodExtraction,
      resolveEngine: () => makeEngine(),
    });

    for (const update of updates) {
      for (const [key, value] of Object.entries(update)) {
        if (value === null || value === undefined) continue;
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        expect(serialized.length, `${key} should be small`).toBeLessThanOrEqual(4096);
      }
    }
  });
});

function lastUpdateMatching<T extends string>(
  key: string,
  value: T
): Record<string, unknown> | undefined {
  return [...updates].reverse().find((u) => u[key] === value);
}

function lastUpdateWithKey(key: string): Record<string, unknown> | undefined {
  return [...updates].reverse().find((u) => key in u);
}
