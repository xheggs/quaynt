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
import { extractCitationsFromResponse, extractWebSearchErrors } from './claude.citations';
import { ClaudeClient } from './claude.client';
import type {
  ClaudeConfig,
  ClaudeMessagesRequest,
  ClaudeMessagesResponse,
  ClaudeUserLocation,
} from './claude.types';
import { CLAUDE_CONFIG_DEFAULTS } from './claude.types';

const DEFAULT_TIMEOUT_MS = 30_000;

export class ClaudeAdapter extends BasePlatformAdapter {
  readonly platformId = 'claude';
  readonly platformName = 'Claude';

  private readonly client: ClaudeClient;
  private readonly claudeConfig: ClaudeConfig;

  constructor(config: AdapterConfig) {
    super(config);

    const apiKey = config.credentials.apiKey as string | undefined;
    if (!apiKey) {
      throw new PermanentAdapterError('Missing required credential: apiKey', 'claude');
    }

    const model = (config.config.model as string) ?? CLAUDE_CONFIG_DEFAULTS.model;
    const maxTokens = (config.config.maxTokens as number) ?? CLAUDE_CONFIG_DEFAULTS.maxTokens;
    const maxSearchUses =
      (config.config.maxSearchUses as number) ?? CLAUDE_CONFIG_DEFAULTS.maxSearchUses;
    const temperature = config.config.temperature as number | undefined;
    const systemInstruction = config.config.systemInstruction as string | undefined;

    if (typeof model !== 'string' || model.length === 0) {
      throw new PermanentAdapterError('Invalid model: must be a non-empty string', 'claude');
    }
    if (typeof maxTokens !== 'number' || !Number.isInteger(maxTokens) || maxTokens <= 0) {
      throw new PermanentAdapterError('Invalid maxTokens: must be a positive integer', 'claude');
    }
    if (
      typeof maxSearchUses !== 'number' ||
      !Number.isInteger(maxSearchUses) ||
      maxSearchUses <= 0
    ) {
      throw new PermanentAdapterError(
        'Invalid maxSearchUses: must be a positive integer',
        'claude'
      );
    }
    if (
      temperature !== undefined &&
      (typeof temperature !== 'number' || temperature < 0 || temperature > 1)
    ) {
      throw new PermanentAdapterError(
        'Invalid temperature: must be a number between 0 and 1',
        'claude'
      );
    }

    this.claudeConfig = { model, maxTokens, maxSearchUses, temperature, systemInstruction };
    this.client = new ClaudeClient(apiKey, this.log);
  }

  protected async doQuery(prompt: string, options: QueryOptions): Promise<PlatformResponse> {
    const systemInstruction = this.buildSystemInstruction(options.locale);
    const userLocation = this.buildUserLocation(options.locale);

    const request: ClaudeMessagesRequest = {
      model: this.claudeConfig.model,
      max_tokens: this.claudeConfig.maxTokens,
      messages: [{ role: 'user', content: prompt }],
      ...(systemInstruction && { system: systemInstruction }),
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: this.claudeConfig.maxSearchUses,
          ...(userLocation && { user_location: userLocation }),
        },
      ],
      ...(this.claudeConfig.temperature !== undefined && {
        temperature: this.claudeConfig.temperature,
      }),
      stream: false,
    };

    const timeoutMs = options.timeout ?? this.adapterConfig.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const startTime = Date.now();

    const { body, rateLimits } = await this.client.sendMessage(request, { timeoutMs });

    const latencyMs = Date.now() - startTime;

    this.log.debug({ rateLimits }, 'Anthropic rate limit status');

    // Check for web search errors within 200 response (D10)
    const webSearchErrors = extractWebSearchErrors(body);
    if (webSearchErrors.length > 0) {
      this.log.warn({ errors: webSearchErrors }, 'Claude web search errors in response');
    }

    const textContent = this.extractTextContent(body);

    return {
      rawResponse: body,
      textContent,
      metadata: {
        requestId: body.id,
        timestamp: new Date(),
        latencyMs,
        model: body.model,
        tokensUsed: body.usage.input_tokens + body.usage.output_tokens,
      },
    };
  }

  protected async doExtractCitations(
    response: PlatformResponse,
    // Brand param unused — all citations returned unfiltered; classification is handled by 1.7
    _brand: { name: string; aliases: string[] } // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<Citation[]> {
    const rawResponse = response.rawResponse as ClaudeMessagesResponse;
    return extractCitationsFromResponse(rawResponse);
  }

  protected async doHealthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    const now = () => new Date();

    try {
      // Health check uses a lightweight query WITHOUT web search tool (cheaper)
      await this.client.sendMessage(
        {
          model: this.claudeConfig.model,
          max_tokens: 10,
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

  private buildSystemInstruction(locale?: string): string | undefined {
    const parts: string[] = [];

    if (this.claudeConfig.systemInstruction) {
      parts.push(this.claudeConfig.systemInstruction);
    }

    if (locale) {
      const language = getLanguageCode(locale);
      if (language) {
        parts.push(`Respond in ${language}.`);
      }
    }

    if (parts.length === 0) return undefined;
    return parts.join('\n\n');
  }

  private buildUserLocation(locale?: string): ClaudeUserLocation | undefined {
    if (!locale) return undefined;
    const loc = mapLocaleToUserLocation(locale);
    if (!loc) return undefined;
    return { type: 'approximate', country: loc.country };
  }

  private extractTextContent(body: ClaudeMessagesResponse): string {
    const parts: string[] = [];
    for (const block of body.content) {
      if (block.type === 'text') {
        parts.push(block.text);
      }
    }
    return parts.join('');
  }
}
