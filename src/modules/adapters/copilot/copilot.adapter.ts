// ---------------------------------------------------------------------------
// Copilot adapter — Microsoft Copilot via third-party SERP APIs.
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
import { extractCitationsFromCopilotResult } from './copilot.citations';
import { createCopilotSerpProvider } from './copilot.serp-provider';
import type { CopilotSerpProvider } from './copilot.serp-provider';
import type { CopilotConfig, CopilotSearchResult } from './copilot.types';
import { COPILOT_CONFIG_DEFAULTS, SUPPORTED_COPILOT_PROVIDERS } from './copilot.types';

const DEFAULT_TIMEOUT_MS = 45_000;

export class CopilotAdapter extends BasePlatformAdapter {
  readonly platformId = 'copilot';
  readonly platformName = 'Microsoft Copilot';

  private readonly serpProvider: CopilotSerpProvider;
  private readonly copilotConfig: CopilotConfig;

  constructor(config: AdapterConfig) {
    super(config);

    const serpProvider =
      (config.config.serpProvider as string) ?? COPILOT_CONFIG_DEFAULTS.serpProvider;

    if (
      !SUPPORTED_COPILOT_PROVIDERS.includes(
        serpProvider as (typeof SUPPORTED_COPILOT_PROVIDERS)[number]
      )
    ) {
      throw new PermanentAdapterError(
        `Unknown SERP provider: ${serpProvider}. Supported providers: ${SUPPORTED_COPILOT_PROVIDERS.join(', ')}`,
        'copilot'
      );
    }

    const noCache =
      (config.config.noCache as boolean | undefined) ?? COPILOT_CONFIG_DEFAULTS.noCache;

    this.copilotConfig = { serpProvider, noCache };

    this.serpProvider = createCopilotSerpProvider(
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

    // Log warning when locale is provided but SerpAPI cannot enforce it (D8)
    if (options.locale && this.copilotConfig.serpProvider === 'serpapi') {
      this.log.warn(
        'Locale %s requested but SerpAPI bing_copilot engine does not support locale parameters',
        options.locale
      );
    }

    const timeoutMs = options.timeout ?? this.adapterConfig.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const startTime = Date.now();

    const result = await this.serpProvider.search(prompt, {
      countryCode,
      languageCode,
      timeoutMs,
      noCache: this.copilotConfig.noCache,
    });

    const latencyMs = Date.now() - startTime;

    const textContent = this.buildTextContent(result);

    if (result.hasCopilotAnswer) {
      this.log.debug('Copilot answer present in SERP response');
    } else {
      this.log.debug('No Copilot answer in SERP response');
    }

    return {
      rawResponse: result,
      textContent,
      metadata: {
        requestId: result.requestId ?? randomUUID(),
        timestamp: new Date(),
        latencyMs,
        model: 'ms-copilot',
        tokensUsed: undefined,
      },
    };
  }

  protected async doExtractCitations(
    response: PlatformResponse,
    _brand: { name: string; aliases: string[] } // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<Citation[]> {
    const result = response.rawResponse as CopilotSearchResult;
    return extractCitationsFromCopilotResult(result);
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

  private buildTextContent(result: CopilotSearchResult): string {
    if (!result.hasCopilotAnswer || !result.copilotAnswer) return '';

    const parts: string[] = [];

    if (result.copilotAnswer.header) {
      parts.push(result.copilotAnswer.header);
    }

    const blocks = result.copilotAnswer.textBlocks;
    if (blocks && blocks.length > 0) {
      for (const block of blocks) {
        if (block.text) {
          parts.push(block.text);
        }
      }
    }

    return parts.join('\n');
  }
}
