// ---------------------------------------------------------------------------
// Perplexity adapter types — internal to the perplexity module.
// These mirror the Perplexity Chat Completions API request/response shapes.
// ---------------------------------------------------------------------------

// -- Platform-specific config (stored in AdapterConfig.config JSONB) ---------

export interface PerplexityConfig {
  model: string;
  searchRecencyFilter?: 'hour' | 'day' | 'week' | 'month' | 'year';
  searchLanguageFilter?: string[];
  temperature?: number;
  maxTokens?: number;
}

export const PERPLEXITY_CONFIG_DEFAULTS: PerplexityConfig = {
  model: 'sonar',
};

// -- Perplexity Chat Completions API request ---------------------------------

export interface PerplexityChatRequest {
  model: string;
  messages: PerplexityMessage[];
  stream: false;
  temperature?: number;
  max_tokens?: number;
  search_recency_filter?: 'hour' | 'day' | 'week' | 'month' | 'year';
  search_language_filter?: string[];
  user_location?: PerplexityUserLocation;
}

export interface PerplexityMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface PerplexityUserLocation {
  country?: string;
  city?: string;
  region?: string;
}

// -- Perplexity Chat Completions API response --------------------------------

export interface PerplexityChatResponse {
  id: string;
  model: string;
  choices: PerplexityChoice[];
  usage?: PerplexityUsage;
}

export interface PerplexityChoice {
  index: number;
  message: PerplexityResponseMessage;
  finish_reason: string;
}

export interface PerplexityResponseMessage {
  role: string;
  content: string;
  citations?: string[];
}

export interface PerplexityUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// -- Perplexity error response -----------------------------------------------

export interface PerplexityErrorResponse {
  error: {
    message: string;
    type: string;
    code: string | null;
  };
}

// -- Rate limit info extracted from response headers -------------------------

export interface RateLimitInfo {
  remainingRequests?: number;
  resetRequests?: string;
}
