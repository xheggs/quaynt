// ---------------------------------------------------------------------------
// AIO adapter — Google AI Overviews via third-party SERP APIs.
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';
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
import { extractCitationsFromSerpResult } from './aio.citations';
import { createSerpProvider } from './aio.serp-provider';
import type { SerpProvider } from './aio.serp-provider';
import type { AioConfig, SerpSearchResult } from './aio.types';
import { AIO_CONFIG_DEFAULTS, SUPPORTED_SERP_PROVIDERS } from './aio.types';

const DEFAULT_TIMEOUT_MS = 45_000;

export class AioAdapter extends BasePlatformAdapter {
  readonly platformId = 'aio';
  readonly platformName = 'AI Overviews';

  private readonly serpProvider: SerpProvider;
  private readonly aioConfig: AioConfig;

  constructor(config: AdapterConfig) {
    super(config);

    const serpProvider = (config.config.serpProvider as string) ?? AIO_CONFIG_DEFAULTS.serpProvider;

    if (
      !SUPPORTED_SERP_PROVIDERS.includes(serpProvider as (typeof SUPPORTED_SERP_PROVIDERS)[number])
    ) {
      throw new PermanentAdapterError(
        `Unknown SERP provider: ${serpProvider}. Supported providers: ${SUPPORTED_SERP_PROVIDERS.join(', ')}`,
        'aio'
      );
    }

    this.aioConfig = { serpProvider };

    this.serpProvider = createSerpProvider(
      serpProvider,
      config.credentials,
      config.config,
      this.log
    );
  }

  protected async doQuery(prompt: string, options: QueryOptions): Promise<PlatformResponse> {
    const countryCode = options.locale
      ? mapLocaleToUserLocation(options.locale)?.country.toLowerCase()
      : undefined;
    const languageCode = options.locale ? getLanguageCode(options.locale) : undefined;

    const timeoutMs = options.timeout ?? this.adapterConfig.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const startTime = Date.now();

    const result = await this.serpProvider.search(prompt, {
      countryCode,
      languageCode,
      timeoutMs,
    });

    const latencyMs = Date.now() - startTime;

    const textContent = this.buildTextContent(result);

    if (result.hasAiOverview) {
      this.log.debug('AI Overview present in SERP response');
    } else {
      this.log.debug('No AI Overview in SERP response');
    }

    return {
      rawResponse: result,
      textContent,
      metadata: {
        requestId: result.requestId ?? randomUUID(),
        timestamp: new Date(),
        latencyMs,
        model: 'google-aio',
        tokensUsed: undefined,
      },
    };
  }

  protected async doExtractCitations(
    response: PlatformResponse,
    _brand: { name: string; aliases: string[] } // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<Citation[]> {
    const result = response.rawResponse as SerpSearchResult;
    return extractCitationsFromSerpResult(result);
  }

  protected async doHealthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    const now = () => new Date();

    try {
      await this.serpProvider.healthCheck();

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

  private buildTextContent(result: SerpSearchResult): string {
    if (!result.hasAiOverview || !result.aiOverview) return '';

    const blocks = result.aiOverview.textBlocks;
    if (!blocks || blocks.length === 0) return '';

    return blocks.map((b) => b.text).join('\n');
  }
}
