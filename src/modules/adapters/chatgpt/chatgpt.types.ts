// ---------------------------------------------------------------------------
// ChatGPT adapter types — internal to the chatgpt module.
// These mirror the OpenAI Responses API request/response shapes.
// ---------------------------------------------------------------------------

// -- Platform-specific config (stored in AdapterConfig.config JSONB) ---------

export interface ChatGPTConfig {
  model: string;
  searchContextSize: 'low' | 'medium' | 'high';
  organizationId?: string;
}

export const CHATGPT_CONFIG_DEFAULTS: ChatGPTConfig = {
  model: 'gpt-4o-mini',
  searchContextSize: 'medium',
};

// -- OpenAI Responses API request --------------------------------------------

export interface OpenAIResponsesRequest {
  model: string;
  input: string;
  tools?: OpenAITool[];
  store: false;
  stream: false;
}

export type OpenAITool = OpenAIWebSearchTool;

export interface OpenAIWebSearchTool {
  type: 'web_search';
  search_context_size?: 'low' | 'medium' | 'high';
  user_location?: OpenAIUserLocation;
}

export interface OpenAIUserLocation {
  type: 'approximate';
  country?: string;
  city?: string;
  region?: string;
}

// -- OpenAI Responses API response -------------------------------------------

export interface OpenAIResponsesResponse {
  id: string;
  model: string;
  output: OpenAIOutputItem[];
  usage?: OpenAIUsage;
}

export type OpenAIOutputItem = OpenAIWebSearchCallItem | OpenAIMessageItem;

export interface OpenAIWebSearchAction {
  type: string;
  query: string;
}

export interface OpenAIWebSearchCallItem {
  type: 'web_search_call';
  id: string;
  status: string;
  action?: OpenAIWebSearchAction;
}

export interface OpenAIMessageItem {
  type: 'message';
  id: string;
  role: string;
  content: OpenAIContentPart[];
}

export interface OpenAIContentPart {
  type: 'output_text';
  text: string;
  annotations: OpenAIAnnotation[];
}

export type OpenAIAnnotation = OpenAIUrlCitation;

export interface OpenAIUrlCitation {
  type: 'url_citation';
  url: string;
  title: string;
  start_index: number;
  end_index: number;
}

export interface OpenAIUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

// -- OpenAI error response ---------------------------------------------------

export interface OpenAIErrorResponse {
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
  remainingTokens?: number;
  resetTokens?: string;
}
