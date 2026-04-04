import { BasePlatformAdapter } from '../adapter.base';
import type {
  AdapterConfig,
  Citation,
  HealthStatus,
  PlatformResponse,
  QueryOptions,
} from '../adapter.types';
import { PermanentAdapterError, TransientAdapterError } from '../adapter.types';
import { mapLocaleToUserLocation } from '@/lib/locale/locale';
import { extractCitationsFromResponse } from './chatgpt.citations';
import { ChatGPTClient } from './chatgpt.client';
import type {
  ChatGPTConfig,
  OpenAIResponsesRequest,
  OpenAIResponsesResponse,
  OpenAIUserLocation,
  OpenAIMessageItem,
} from './chatgpt.types';
import { CHATGPT_CONFIG_DEFAULTS } from './chatgpt.types';

const DEFAULT_TIMEOUT_MS = 30_000;

export class ChatGPTAdapter extends BasePlatformAdapter {
  readonly platformId = 'chatgpt';
  readonly platformName = 'ChatGPT';

  private readonly client: ChatGPTClient;
  private readonly chatgptConfig: ChatGPTConfig;

  constructor(config: AdapterConfig) {
    super(config);

    const apiKey = config.credentials.apiKey as string | undefined;
    if (!apiKey) {
      throw new PermanentAdapterError('Missing required credential: apiKey', 'chatgpt');
    }

    this.chatgptConfig = {
      model: (config.config.model as string) ?? CHATGPT_CONFIG_DEFAULTS.model,
      searchContextSize:
        (config.config.searchContextSize as ChatGPTConfig['searchContextSize']) ??
        CHATGPT_CONFIG_DEFAULTS.searchContextSize,
      organizationId: config.config.organizationId as string | undefined,
    };

    this.client = new ChatGPTClient(apiKey, this.chatgptConfig.organizationId, this.log);
  }

  protected async doQuery(prompt: string, options: QueryOptions): Promise<PlatformResponse> {
    const loc = mapLocaleToUserLocation(options.locale);
    const userLocation: OpenAIUserLocation | undefined = loc
      ? { type: 'approximate', country: loc.country }
      : undefined;

    const request: OpenAIResponsesRequest = {
      model: this.chatgptConfig.model,
      input: prompt,
      tools: [
        {
          type: 'web_search',
          search_context_size: this.chatgptConfig.searchContextSize,
          ...(userLocation && { user_location: userLocation }),
        },
      ],
      store: false,
      stream: false,
    };

    const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS;
    const startTime = Date.now();

    const { body, rateLimits } = await this.client.createResponse(request, {
      timeoutMs,
    });

    const latencyMs = Date.now() - startTime;

    this.log.debug({ rateLimits }, 'OpenAI rate limit status');

    const textContent = extractTextContent(body);

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
    const rawResponse = response.rawResponse as OpenAIResponsesResponse;
    return extractCitationsFromResponse(rawResponse);
  }

  protected async doHealthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    const now = () => new Date();

    try {
      await this.client.createResponse(
        {
          model: this.chatgptConfig.model,
          input: 'Hello',
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
}

function extractTextContent(response: OpenAIResponsesResponse): string {
  const parts: string[] = [];
  for (const item of response.output) {
    if (item.type !== 'message') continue;
    const messageItem = item as OpenAIMessageItem;
    for (const part of messageItem.content) {
      if (part.type === 'output_text') {
        parts.push(part.text);
      }
    }
  }
  return parts.join('');
}
