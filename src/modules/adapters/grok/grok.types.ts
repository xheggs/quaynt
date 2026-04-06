// ---------------------------------------------------------------------------
// Grok adapter types — internal to the grok module.
// These mirror the xAI Responses API request/response shapes.
// ---------------------------------------------------------------------------

// -- Platform-specific config (stored in AdapterConfig.config JSONB) ---------

export interface GrokConfig {
  model: string;
  enableXSearch: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  systemInstruction?: string;
}

export const GROK_CONFIG_DEFAULTS: GrokConfig = {
  model: 'grok-4-1-fast-non-reasoning',
  enableXSearch: true,
};

/**
 * Known xAI models supporting web search and x_search tools.
 * Used for documentation/validation hints — the adapter accepts any string
 * to support future models without code changes.
 */
export const VALID_MODELS = [
  'grok-4-1-fast-non-reasoning',
  'grok-4-1-fast-reasoning',
  'grok-4.20-0309-non-reasoning',
  'grok-4.20-0309-reasoning',
] as const;

// -- xAI Responses API request -----------------------------------------------

export interface GrokResponsesRequest {
  model: string;
  input: GrokInputMessage[];
  tools?: GrokTool[];
  stream: boolean;
  store: boolean;
  temperature?: number;
  max_output_tokens?: number;
}

export interface GrokInputMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type GrokTool = GrokWebSearchTool | GrokXSearchTool;

export interface GrokWebSearchTool {
  type: 'web_search';
}

export interface GrokXSearchTool {
  type: 'x_search';
}

// -- xAI Responses API response -----------------------------------------------

export interface GrokResponsesResponse {
  id: string;
  object?: string;
  model: string;
  output: GrokOutputItem[];
  usage?: GrokUsage;
  citations?: GrokTopLevelCitation[];
}

export type GrokOutputItem = GrokWebSearchCallItem | GrokXSearchCallItem | GrokMessageItem;

export interface GrokWebSearchCallItem {
  type: 'web_search_call';
  id: string;
  status: string;
}

export interface GrokXSearchCallItem {
  type: 'x_search_call';
  id: string;
  status: string;
}

export interface GrokMessageItem {
  type: 'message';
  id?: string;
  role: string;
  content: GrokContentBlock[];
}

export interface GrokContentBlock {
  type: 'output_text';
  text: string;
  annotations?: GrokAnnotation[];
}

export type GrokAnnotation = GrokUrlCitation;

export interface GrokUrlCitation {
  type: 'url_citation';
  url: string;
  title: string;
  start_index: number;
  end_index: number;
}

export interface GrokTopLevelCitation {
  url: string;
  title?: string;
  snippet?: string;
  source: 'web' | 'x';
}

export interface GrokUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

// -- xAI error response ------------------------------------------------------

export interface GrokErrorResponse {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

// -- Rate limit info extracted from response headers -------------------------

export interface GrokRateLimitInfo {
  remainingRequests?: number;
  resetRequests?: string;
  remainingTokens?: number;
  resetTokens?: string;
}
