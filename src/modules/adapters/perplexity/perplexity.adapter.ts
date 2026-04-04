import { BasePlatformAdapter } from '../adapter.base';
import type {
  AdapterConfig,
  Citation,
  HealthStatus,
  PlatformResponse,
  QueryOptions,
} from '../adapter.types';
import { PermanentAdapterError, TransientAdapterError } from '../adapter.types';
import { mapLocaleToUserLocation, getLanguageCode } from '@/lib/locale/locale';
import { extractCitationsFromResponse } from './perplexity.citations';
import { PerplexityClient } from './perplexity.client';
import type {
  PerplexityConfig,
  PerplexityChatRequest,
  PerplexityChatResponse,
} from './perplexity.types';
import { PERPLEXITY_CONFIG_DEFAULTS } from './perplexity.types';

const DEFAULT_TIMEOUT_MS = 30_000;

const VALID_MODELS = ['sonar', 'sonar-pro', 'sonar-reasoning-pro', 'sonar-deep-research'];

const VALID_RECENCY_FILTERS = ['hour', 'day', 'week', 'month', 'year'];

export class PerplexityAdapter extends BasePlatformAdapter {
  readonly platformId = 'perplexity';
  readonly platformName = 'Perplexity';

  private readonly client: PerplexityClient;
  private readonly perplexityConfig: PerplexityConfig;

  constructor(config: AdapterConfig) {
    super(config);

    const apiKey = config.credentials.apiKey as string | undefined;
    if (!apiKey) {
      throw new PermanentAdapterError('Missing required credential: apiKey', 'perplexity');
    }

    const model = (config.config.model as string) ?? PERPLEXITY_CONFIG_DEFAULTS.model;
    if (!VALID_MODELS.includes(model)) {
      throw new PermanentAdapterError(
        `Invalid model: ${model}. Must be one of: ${VALID_MODELS.join(', ')}`,
        'perplexity'
      );
    }

    const searchRecencyFilter = config.config.searchRecencyFilter as string | undefined;
    if (searchRecencyFilter && !VALID_RECENCY_FILTERS.includes(searchRecencyFilter)) {
      throw new PermanentAdapterError(
        `Invalid searchRecencyFilter: ${searchRecencyFilter}. Must be one of: ${VALID_RECENCY_FILTERS.join(', ')}`,
        'perplexity'
      );
    }

    const searchLanguageFilter = config.config.searchLanguageFilter as string[] | undefined;
    if (searchLanguageFilter && !Array.isArray(searchLanguageFilter)) {
      throw new PermanentAdapterError(
        'searchLanguageFilter must be an array of strings',
        'perplexity'
      );
    }

    this.perplexityConfig = {
      model,
      searchRecencyFilter: searchRecencyFilter as PerplexityConfig['searchRecencyFilter'],
      searchLanguageFilter,
      temperature: config.config.temperature as number | undefined,
      maxTokens: config.config.maxTokens as number | undefined,
    };

    this.client = new PerplexityClient(apiKey, this.log);
  }

  protected async doQuery(prompt: string, options: QueryOptions): Promise<PlatformResponse> {
    const userLocation = mapLocaleToUserLocation(options.locale);

    const request: PerplexityChatRequest = {
      model: this.perplexityConfig.model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      ...(this.perplexityConfig.temperature !== undefined && {
        temperature: this.perplexityConfig.temperature,
      }),
      ...(this.perplexityConfig.maxTokens !== undefined && {
        max_tokens: this.perplexityConfig.maxTokens,
      }),
      ...(this.perplexityConfig.searchRecencyFilter && {
        search_recency_filter: this.perplexityConfig.searchRecencyFilter,
      }),
      ...(this.perplexityConfig.searchLanguageFilter && {
        search_language_filter: this.perplexityConfig.searchLanguageFilter,
      }),
      ...(userLocation && { user_location: userLocation }),
    };

    // Derive search_language_filter from locale when no static config is set
    if (!this.perplexityConfig.searchLanguageFilter && options.locale) {
      const lang = getLanguageCode(options.locale);
      if (lang) {
        request.search_language_filter = [lang];
      }
    }

    const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS;
    const startTime = Date.now();

    const { body, rateLimits } = await this.client.createCompletion(request, {
      timeoutMs,
    });

    const latencyMs = Date.now() - startTime;

    this.log.debug({ rateLimits }, 'Perplexity rate limit status');

    const textContent = body.choices?.[0]?.message?.content ?? '';

    return {
      rawResponse: body,
      textContent,
      metadata: {
        requestId: body.id,
        timestamp: new Date(),
        latencyMs,
        model: body.model,
        tokensUsed: body.usage?.total_tokens,
      },
    };
  }

  protected async doExtractCitations(
    response: PlatformResponse,
    // Brand param unused — all citations returned unfiltered; classification is handled by 1.7
    _brand: { name: string; aliases: string[] } // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<Citation[]> {
    const rawResponse = response.rawResponse as PerplexityChatResponse;
    return extractCitationsFromResponse(rawResponse);
  }

  protected async doHealthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    const now = () => new Date();

    try {
      await this.client.createCompletion(
        {
          model: 'sonar',
          messages: [{ role: 'user', content: 'Hello' }],
          stream: false,
        },
        { timeoutMs: this.adapterConfig.timeoutMs ?? DEFAULT_TIMEOUT_MS }
      );

      return {
        status: 'healthy',
        latencyMs: Date.now() - startTime,
        lastCheckedAt: now(),
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      if (error instanceof TransientAdapterError) {
        return {
          status: 'degraded',
          latencyMs,
          message: error.message,
          lastCheckedAt: now(),
        };
      }

      return {
        status: 'unhealthy',
        latencyMs,
        message: error instanceof Error ? error.message : 'Unknown error',
        lastCheckedAt: now(),
      };
    }
  }
}
