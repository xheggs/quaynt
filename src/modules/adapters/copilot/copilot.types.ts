// ---------------------------------------------------------------------------
// Copilot adapter types — normalized SERP types shared across providers.
// ---------------------------------------------------------------------------

/** Platform-specific config stored in AdapterConfig.config JSONB. */
export interface CopilotConfig {
  serpProvider: string;
  /** SerpAPI only: bypass 1-hour result cache for fresh results. */
  noCache?: boolean;
}

export const COPILOT_CONFIG_DEFAULTS: CopilotConfig = {
  serpProvider: 'dataforseo',
  noCache: false,
};

export const SUPPORTED_COPILOT_PROVIDERS = ['serpapi', 'dataforseo'] as const;
export type SupportedCopilotProvider = (typeof SUPPORTED_COPILOT_PROVIDERS)[number];

/** Provider-agnostic search parameters passed to CopilotSerpProvider.search(). */
export interface CopilotSearchParams {
  /** ISO 3166-1 alpha-2 country code (e.g., 'us'). */
  countryCode?: string;
  /** ISO 639-1 language code (e.g., 'en'). */
  languageCode?: string;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
  /** SerpAPI only: bypass 1-hour result cache. */
  noCache?: boolean;
}

export type CopilotTextBlockType = 'paragraph' | 'heading' | 'list' | 'code_block' | 'table';

export interface CopilotTextBlock {
  type: CopilotTextBlockType;
  text: string;
  referenceIndexes: number[];
}

export interface CopilotReference {
  index: number;
  title: string;
  link: string;
  snippet: string;
  source: string;
}

export interface CopilotAnswer {
  header?: string;
  textBlocks: CopilotTextBlock[];
  references: CopilotReference[];
}

export interface CopilotSearchResult {
  hasCopilotAnswer: boolean;
  copilotAnswer?: CopilotAnswer;
  rawResponse: unknown;
  requestId?: string;
}
