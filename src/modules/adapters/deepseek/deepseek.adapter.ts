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
import { extractCitationsFromResponse } from './deepseek.citations';
import { DeepSeekClient } from './deepseek.client';
import type { DeepSeekConfig, DeepSeekChatRequest, DeepSeekChatResponse } from './deepseek.types';
import { DEEPSEEK_CONFIG_DEFAULTS } from './deepseek.types';

const DEFAULT_TIMEOUT_MS = 30_000;
const BASELINE_INSTRUCTION =
  'Provide factual, detailed responses. Always respond entirely in the requested language without mixing languages.';

export class DeepSeekAdapter extends BasePlatformAdapter {
  readonly platformId = 'deepseek';
  readonly platformName = 'DeepSeek';

  private readonly client: DeepSeekClient;
  private readonly deepseekConfig: DeepSeekConfig;

  constructor(config: AdapterConfig) {
    super(config);

    const apiKey = config.credentials.apiKey as string | undefined;
    if (!apiKey) {
      throw new PermanentAdapterError('Missing required credential: apiKey', 'deepseek');
    }

    const model = (config.config.model as string) ?? DEEPSEEK_CONFIG_DEFAULTS.model;
    const temperature = config.config.temperature as number | undefined;
    const maxTokens = config.config.maxTokens as number | undefined;
    const systemInstruction = config.config.systemInstruction as string | undefined;

    if (typeof model !== 'string' || model.length === 0) {
      throw new PermanentAdapterError('Invalid model: must be a non-empty string', 'deepseek');
    }
    if (
      temperature !== undefined &&
      (typeof temperature !== 'number' || temperature < 0 || temperature > 2)
    ) {
      throw new PermanentAdapterError(
        'Invalid temperature: must be a number between 0 and 2',
        'deepseek'
      );
    }
    if (
      maxTokens !== undefined &&
      (typeof maxTokens !== 'number' || !Number.isInteger(maxTokens) || maxTokens <= 0)
    ) {
      throw new PermanentAdapterError('Invalid maxTokens: must be a positive integer', 'deepseek');
    }

    this.deepseekConfig = { model, temperature, maxTokens, systemInstruction };
    this.client = new DeepSeekClient(apiKey, this.log);
  }

  protected async doQuery(prompt: string, options: QueryOptions): Promise<PlatformResponse> {
    const systemInstruction = this.buildSystemInstruction(options.locale);

    const request: DeepSeekChatRequest = {
      model: this.deepseekConfig.model,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt },
      ],
      stream: false,
      ...(this.deepseekConfig.temperature !== undefined && {
        temperature: this.deepseekConfig.temperature,
      }),
      ...(this.deepseekConfig.maxTokens !== undefined && {
        max_tokens: this.deepseekConfig.maxTokens,
      }),
    };

    const timeoutMs = options.timeout ?? this.adapterConfig.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const startTime = Date.now();

    const { body } = await this.client.createChatCompletion(request, { timeoutMs });

    const latencyMs = Date.now() - startTime;

    const finishReason = body.choices[0]?.finish_reason;
    if (finishReason === 'insufficient_system_resource') {
      this.log.warn(
        { responseId: body.id, finishReason },
        'DeepSeek returned insufficient_system_resource — treating as transient error'
      );
      throw new TransientAdapterError(
        'DeepSeek ran out of compute resources mid-generation',
        'deepseek'
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
        model: body.model,
        tokensUsed: body.usage?.total_tokens,
      },
    };
  }

  protected async doExtractCitations(
    response: PlatformResponse,
    _brand: { name: string; aliases: string[] } // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<Citation[]> {
    const rawResponse = response.rawResponse as DeepSeekChatResponse;
    return extractCitationsFromResponse(rawResponse);
  }

  protected async doHealthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    const now = () => new Date();

    try {
      await this.client.createChatCompletion(
        {
          model: this.deepseekConfig.model,
          messages: [{ role: 'user', content: 'Hello' }],
          stream: false,
          max_tokens: 10,
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

      if (
        error instanceof PermanentAdapterError &&
        error.message.includes('insufficient balance')
      ) {
        return {
          status: 'unhealthy',
          latencyMs,
          message: 'Insufficient API balance',
          lastCheckedAt: now(),
        };
      }

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
    const parts: string[] = [];

    if (this.deepseekConfig.systemInstruction) {
      parts.push(this.deepseekConfig.systemInstruction);
    }

    parts.push(BASELINE_INSTRUCTION);

    if (locale) {
      const language = getLanguageCode(locale);
      const loc = mapLocaleToUserLocation(locale);
      const localeParts: string[] = [];
      if (language) {
        localeParts.push(`Respond in ${language}.`);
      }
      if (loc?.country) {
        localeParts.push(`Focus on results relevant to ${loc.country}.`);
      }
      if (localeParts.length > 0) {
        parts.push(localeParts.join(' '));
      }
    }

    return parts.join('\n\n');
  }
}
