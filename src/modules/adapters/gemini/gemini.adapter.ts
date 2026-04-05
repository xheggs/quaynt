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
import { extractCitationsFromResponse } from './gemini.citations';
import { GeminiClient } from './gemini.client';
import type {
  GeminiConfig,
  GeminiGenerateContentRequest,
  GeminiGenerateContentResponse,
  GeminiSystemInstruction,
} from './gemini.types';
import { GEMINI_CONFIG_DEFAULTS, HARM_CATEGORIES, VALID_SAFETY_THRESHOLDS } from './gemini.types';

const DEFAULT_TIMEOUT_MS = 30_000;

/** Validates that a string is safe for use in a URL path segment. */
const SAFE_PATH_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export class GeminiAdapter extends BasePlatformAdapter {
  readonly platformId = 'gemini';
  readonly platformName = 'Gemini';

  private readonly client: GeminiClient;
  private readonly geminiConfig: GeminiConfig;

  constructor(config: AdapterConfig) {
    super(config);

    const apiKey = config.credentials.apiKey as string | undefined;
    if (!apiKey) {
      throw new PermanentAdapterError('Missing required credential: apiKey', 'gemini');
    }

    const model = (config.config.model as string) ?? GEMINI_CONFIG_DEFAULTS.model;
    const apiVersion = (config.config.apiVersion as string) ?? GEMINI_CONFIG_DEFAULTS.apiVersion;
    const safetyThreshold =
      (config.config.safetyThreshold as GeminiConfig['safetyThreshold']) ??
      GEMINI_CONFIG_DEFAULTS.safetyThreshold;
    const temperature = config.config.temperature as number | undefined;
    const maxOutputTokens = config.config.maxOutputTokens as number | undefined;
    const systemInstruction = config.config.systemInstruction as string | undefined;

    // Validate path-interpolated fields to prevent path traversal
    if (!SAFE_PATH_SEGMENT.test(model)) {
      throw new PermanentAdapterError(`Invalid model identifier: ${model}`, 'gemini');
    }
    if (!SAFE_PATH_SEGMENT.test(apiVersion)) {
      throw new PermanentAdapterError(`Invalid API version: ${apiVersion}`, 'gemini');
    }
    if (!VALID_SAFETY_THRESHOLDS.includes(safetyThreshold)) {
      throw new PermanentAdapterError(`Invalid safety threshold: ${safetyThreshold}`, 'gemini');
    }
    if (
      temperature !== undefined &&
      (typeof temperature !== 'number' || temperature < 0 || temperature > 2)
    ) {
      throw new PermanentAdapterError(
        `Invalid temperature: must be a number between 0 and 2`,
        'gemini'
      );
    }
    if (
      maxOutputTokens !== undefined &&
      (typeof maxOutputTokens !== 'number' ||
        !Number.isInteger(maxOutputTokens) ||
        maxOutputTokens <= 0)
    ) {
      throw new PermanentAdapterError(
        `Invalid maxOutputTokens: must be a positive integer`,
        'gemini'
      );
    }

    this.geminiConfig = {
      model,
      apiVersion,
      safetyThreshold,
      temperature,
      maxOutputTokens,
      systemInstruction,
    };

    this.client = new GeminiClient(apiKey, apiVersion, this.log);
  }

  protected async doQuery(prompt: string, options: QueryOptions): Promise<PlatformResponse> {
    const systemInstruction = this.buildSystemInstruction(options.locale);

    const generationConfig: GeminiGenerateContentRequest['generationConfig'] = {};
    if (this.geminiConfig.temperature !== undefined) {
      generationConfig.temperature = this.geminiConfig.temperature;
    }
    if (this.geminiConfig.maxOutputTokens !== undefined) {
      generationConfig.maxOutputTokens = this.geminiConfig.maxOutputTokens;
    }

    const request: GeminiGenerateContentRequest = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      safetySettings: HARM_CATEGORIES.map((category) => ({
        category,
        threshold: this.geminiConfig.safetyThreshold,
      })),
      ...(systemInstruction && { systemInstruction }),
      ...(Object.keys(generationConfig).length > 0 && { generationConfig }),
    };

    const timeoutMs = options.timeout ?? this.adapterConfig.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const startTime = Date.now();

    const { body } = await this.client.generateContent(this.geminiConfig.model, request, {
      timeoutMs,
    });

    const latencyMs = Date.now() - startTime;

    const textContent = this.extractTextContent(body);

    return {
      rawResponse: body,
      textContent,
      metadata: {
        requestId: randomUUID(),
        timestamp: new Date(),
        latencyMs,
        model: body.modelVersion ?? this.geminiConfig.model,
        tokensUsed: body.usageMetadata?.totalTokenCount,
      },
    };
  }

  protected async doExtractCitations(
    response: PlatformResponse,
    // Brand param unused — all citations returned unfiltered; classification is handled by 1.7
    _brand: { name: string; aliases: string[] } // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<Citation[]> {
    const rawResponse = response.rawResponse as GeminiGenerateContentResponse;
    return extractCitationsFromResponse(rawResponse);
  }

  protected async doHealthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    const now = () => new Date();

    try {
      // Health check uses a lightweight query WITHOUT google_search tool
      await this.client.generateContent(
        this.geminiConfig.model,
        { contents: [{ role: 'user', parts: [{ text: 'Hello' }] }] },
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

  private buildSystemInstruction(locale?: string): GeminiSystemInstruction | undefined {
    const parts: string[] = [];

    if (this.geminiConfig.systemInstruction) {
      parts.push(this.geminiConfig.systemInstruction);
    }

    if (locale) {
      const loc = mapLocaleToUserLocation(locale);
      const language = getLanguageCode(locale);
      if (loc || language) {
        const localeInstructions: string[] = [];
        if (loc) {
          localeInstructions.push(
            `You are responding to a user in ${loc.country}. Tailor your search and response to be relevant to ${loc.country}.`
          );
        }
        if (language) {
          localeInstructions.push(`Respond in ${language}.`);
        }
        parts.push(localeInstructions.join(' '));
      }
    }

    if (parts.length === 0) return undefined;
    return { parts: [{ text: parts.join('\n\n') }] };
  }

  private extractTextContent(body: GeminiGenerateContentResponse): string {
    const candidate = body.candidates?.[0];

    if (!candidate) {
      this.log.warn('Gemini response has no candidates (prompt-level block)');
      return '';
    }

    if (candidate.finishReason === 'SAFETY') {
      this.log.warn('Gemini blocked response due to safety settings');
      return '';
    }

    if (candidate.finishReason === 'RECITATION') {
      this.log.warn('Gemini blocked response due to recitation filter');
      return '';
    }

    if (!candidate.content?.parts) return '';

    return candidate.content.parts.map((p) => p.text).join('');
  }
}
