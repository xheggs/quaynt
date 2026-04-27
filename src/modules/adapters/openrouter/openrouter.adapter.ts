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
import { extractCitationsFromResponse } from './openrouter.citations';
import { OpenRouterClient } from './openrouter.client';
import {
  type OpenRouterChatRequest,
  type OpenRouterChatResponse,
  type OpenRouterPlatformConfig,
} from './openrouter.types';
import { assertWithinMonthlyBudget } from './openrouter.budget';

const DEFAULT_TIMEOUT_MS = 30_000;
const BASELINE_INSTRUCTION =
  'Provide factual, detailed responses. Always respond entirely in the requested language without mixing languages.';

/**
 * Adapter for OpenRouter-backed virtual platforms. One class serves all
 * variants (Sonar Pro, GPT-4o + Exa, Claude + Exa, DeepSeek); the difference
 * lives in `staticConfig.orModel` and `staticConfig.citationStyle` baked in
 * at registration time.
 *
 * Credentials come from the workspace's shared `openrouter` adapter row via
 * the registry's `credentialSource` indirection — the orchestrator resolves
 * those before constructing this adapter, so `adapterConfig.credentials`
 * already contains the OR `apiKey`.
 */
export class OpenRouterAdapter extends BasePlatformAdapter {
  readonly platformId: string;
  readonly platformName: string;

  private readonly client: OpenRouterClient;
  private readonly staticConfig: OpenRouterPlatformConfig;

  constructor(adapterConfig: AdapterConfig, staticConfig: OpenRouterPlatformConfig) {
    super(adapterConfig);

    this.platformId = adapterConfig.platformId;
    this.platformName = adapterConfig.displayName;

    // Per-workspace override: free OpenRouter models come and go, so operators
    // can update `config.orModel` (and optionally `config.citationStyle`) on
    // their adapter row without waiting for a code release. Defaults come from
    // the static registration baked into the platform.
    const overrideModel = adapterConfig.config['orModel'];
    const overrideStyle = adapterConfig.config['citationStyle'];
    this.staticConfig = {
      orModel:
        typeof overrideModel === 'string' && overrideModel.length > 0
          ? overrideModel
          : staticConfig.orModel,
      citationStyle:
        overrideStyle === 'sonar' || overrideStyle === 'online'
          ? overrideStyle
          : staticConfig.citationStyle,
    };

    const apiKey = adapterConfig.credentials.apiKey as string | undefined;
    if (!apiKey) {
      throw new PermanentAdapterError(
        'Missing required credential: apiKey (configure the shared OpenRouter adapter first)',
        this.platformId
      );
    }

    if (!this.staticConfig.orModel) {
      throw new PermanentAdapterError(
        'Invalid platform registration: missing OpenRouter model slug',
        this.platformId
      );
    }

    this.client = new OpenRouterClient(apiKey, this.platformId, this.log);
  }

  protected async doQuery(prompt: string, options: QueryOptions): Promise<PlatformResponse> {
    await assertWithinMonthlyBudget({
      workspaceId: this.adapterConfig.workspaceId,
      platformId: this.platformId,
    });

    const systemInstruction = this.buildSystemInstruction(options.locale);

    const request: OpenRouterChatRequest = {
      model: this.staticConfig.orModel,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt },
      ],
      stream: false,
    };

    const timeoutMs = options.timeout ?? this.adapterConfig.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const startTime = Date.now();

    const { body } = await this.client.createChatCompletion(request, { timeoutMs });

    const latencyMs = Date.now() - startTime;

    const finishReason = body.choices[0]?.finish_reason;
    if (finishReason === 'content_filter') {
      throw new TransientAdapterError(
        'OpenRouter response was content-filtered upstream',
        this.platformId
      );
    }

    const textContent = body.choices[0]?.message?.content ?? '';

    return {
      rawResponse: body,
      textContent,
      metadata: {
        requestId: body.id,
        timestamp: new Date(),
        latencyMs,
        // Carry both the OR slug and the underlying returned model — when
        // OR routes to a fallback model, `body.model` will differ from the
        // requested slug, which is useful in debugging.
        model: `${this.staticConfig.orModel} (returned: ${body.model})`,
        tokensUsed: body.usage?.total_tokens,
      },
    };
  }

  protected async doExtractCitations(
    response: PlatformResponse,
    _brand: { name: string; aliases: string[] } // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<Citation[]> {
    const rawResponse = response.rawResponse as OpenRouterChatResponse;
    return extractCitationsFromResponse(rawResponse, this.staticConfig.citationStyle);
  }

  protected async doHealthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    const now = () => new Date();

    try {
      await this.client.createChatCompletion(
        {
          model: this.staticConfig.orModel,
          messages: [{ role: 'user', content: 'Hello' }],
          stream: false,
          max_tokens: 4,
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

  private buildSystemInstruction(locale?: string): string {
    const parts: string[] = [BASELINE_INSTRUCTION];

    if (locale) {
      const language = getLanguageCode(locale);
      const loc = mapLocaleToUserLocation(locale);
      const localeParts: string[] = [];
      if (language) localeParts.push(`Respond in ${language}.`);
      if (loc?.country) localeParts.push(`Focus on results relevant to ${loc.country}.`);
      if (localeParts.length > 0) parts.push(localeParts.join(' '));
    }

    return parts.join('\n\n');
  }
}
