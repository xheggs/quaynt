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
import { extractCitationsFromResponse } from './grok.citations';
import { GrokClient } from './grok.client';
import type {
  GrokConfig,
  GrokResponsesRequest,
  GrokResponsesResponse,
  GrokTool,
  GrokMessageItem,
} from './grok.types';
import { GROK_CONFIG_DEFAULTS } from './grok.types';

const DEFAULT_TIMEOUT_MS = 30_000;
const BASELINE_INSTRUCTION = 'Provide factual, well-sourced responses. Cite your sources.';

export class GrokAdapter extends BasePlatformAdapter {
  readonly platformId = 'grok';
  readonly platformName = 'Grok';

  private readonly client: GrokClient;
  private readonly grokConfig: GrokConfig;

  constructor(config: AdapterConfig) {
    super(config);

    const apiKey = config.credentials.apiKey as string | undefined;
    if (!apiKey) {
      throw new PermanentAdapterError('Missing required credential: apiKey', 'grok');
    }

    const model = (config.config.model as string) ?? GROK_CONFIG_DEFAULTS.model;
    const enableXSearch =
      (config.config.enableXSearch as boolean | undefined) ?? GROK_CONFIG_DEFAULTS.enableXSearch;
    const temperature = config.config.temperature as number | undefined;
    const maxOutputTokens = config.config.maxOutputTokens as number | undefined;
    const systemInstruction = config.config.systemInstruction as string | undefined;

    if (typeof model !== 'string' || model.length === 0) {
      throw new PermanentAdapterError('Invalid model: must be a non-empty string', 'grok');
    }
    if (
      temperature !== undefined &&
      (typeof temperature !== 'number' || temperature < 0 || temperature > 2)
    ) {
      throw new PermanentAdapterError(
        'Invalid temperature: must be a number between 0 and 2',
        'grok'
      );
    }
    if (
      maxOutputTokens !== undefined &&
      (typeof maxOutputTokens !== 'number' ||
        !Number.isInteger(maxOutputTokens) ||
        maxOutputTokens <= 0)
    ) {
      throw new PermanentAdapterError(
        'Invalid maxOutputTokens: must be a positive integer',
        'grok'
      );
    }

    this.grokConfig = { model, enableXSearch, temperature, maxOutputTokens, systemInstruction };
    this.client = new GrokClient(apiKey, this.log);
  }

  protected async doQuery(prompt: string, options: QueryOptions): Promise<PlatformResponse> {
    const systemInstruction = this.buildSystemInstruction(options.locale);
    const tools = this.buildTools();

    const request: GrokResponsesRequest = {
      model: this.grokConfig.model,
      input: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt },
      ],
      tools,
      stream: false,
      store: false,
      ...(this.grokConfig.temperature !== undefined && {
        temperature: this.grokConfig.temperature,
      }),
      ...(this.grokConfig.maxOutputTokens !== undefined && {
        max_output_tokens: this.grokConfig.maxOutputTokens,
      }),
    };

    const timeoutMs = options.timeout ?? this.adapterConfig.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const startTime = Date.now();

    const { body, rateLimits } = await this.client.createResponse(request, {
      timeoutMs,
    });

    const latencyMs = Date.now() - startTime;

    this.log.debug({ rateLimits }, 'xAI rate limit status');

    const textContent = this.extractTextContent(body);

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
    const rawResponse = response.rawResponse as GrokResponsesResponse;
    return extractCitationsFromResponse(rawResponse);
  }

  protected async doHealthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    const now = () => new Date();

    try {
      await this.client.createResponse(
        {
          model: this.grokConfig.model,
          input: [{ role: 'user', content: 'Hello' }],
          store: false,
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

  private buildSystemInstruction(locale?: string): string {
    const parts: string[] = [];

    if (this.grokConfig.systemInstruction) {
      parts.push(this.grokConfig.systemInstruction);
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

  private buildTools(): GrokTool[] {
    const tools: GrokTool[] = [{ type: 'web_search' }];
    if (this.grokConfig.enableXSearch) {
      tools.push({ type: 'x_search' });
    }
    return tools;
  }

  private extractTextContent(response: GrokResponsesResponse): string {
    const parts: string[] = [];
    for (const item of response.output) {
      if (item.type !== 'message') continue;
      const messageItem = item as GrokMessageItem;
      for (const part of messageItem.content) {
        if (part.type === 'output_text') {
          parts.push(part.text);
        }
      }
    }
    return parts.join('');
  }
}
