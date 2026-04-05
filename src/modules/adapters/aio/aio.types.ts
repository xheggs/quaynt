// ---------------------------------------------------------------------------
// AIO adapter types — normalized SERP types shared across providers.
// ---------------------------------------------------------------------------

/** Platform-specific config stored in AdapterConfig.config JSONB. */
export interface AioConfig {
  serpProvider: string;
}

export const AIO_CONFIG_DEFAULTS: AioConfig = {
  serpProvider: 'searchapi',
};

export const SUPPORTED_SERP_PROVIDERS = ['searchapi', 'dataforseo'] as const;
export type SupportedSerpProvider = (typeof SUPPORTED_SERP_PROVIDERS)[number];

/** Provider-agnostic search parameters passed to SerpProvider.search(). */
export interface SerpSearchParams {
  /** ISO 3166-1 alpha-2 country code (e.g., 'us'). */
  countryCode?: string;
  /** ISO 639-1 language code (e.g., 'en'). */
  languageCode?: string;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
}

export type SerpTextBlockType =
  | 'paragraph'
  | 'list'
  | 'table'
  | 'heading'
  | 'expandable'
  | 'comparison';

export interface SerpTextBlock {
  type: SerpTextBlockType;
  text: string;
  referenceIndexes: number[];
}

export interface SerpReference {
  title: string;
  link: string;
  snippet: string;
  source: string;
  index: number;
}

export interface SerpAiOverview {
  textBlocks: SerpTextBlock[];
  references: SerpReference[];
}

export interface SerpSearchResult {
  hasAiOverview: boolean;
  aiOverview?: SerpAiOverview;
  rawResponse: unknown;
  requestId?: string;
}
