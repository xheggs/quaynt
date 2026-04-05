// ---------------------------------------------------------------------------
// Claude adapter types — internal to the claude module.
// These mirror the Anthropic Messages API request/response shapes.
// ---------------------------------------------------------------------------

// -- Platform-specific config (stored in AdapterConfig.config JSONB) ---------

export interface ClaudeConfig {
  model: string;
  maxTokens: number;
  maxSearchUses: number;
  temperature?: number;
  systemInstruction?: string;
}

export const CLAUDE_CONFIG_DEFAULTS: ClaudeConfig = {
  model: 'claude-haiku-4-5-20251001',
  maxTokens: 4096,
  maxSearchUses: 5,
};

/** Known models supporting web search. Adapter accepts any string for future compatibility. */
export const VALID_MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-6',
  'claude-opus-4-6',
] as const;

// -- Anthropic Messages API request ------------------------------------------

export interface ClaudeMessagesRequest {
  model: string;
  max_tokens: number;
  messages: ClaudeMessage[];
  system?: string;
  tools?: ClaudeTool[];
  temperature?: number;
  stream?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | ClaudeContentBlock[];
}

export type ClaudeTool = ClaudeWebSearchTool;

export interface ClaudeWebSearchTool {
  type: 'web_search_20250305';
  name: 'web_search';
  max_uses?: number;
  user_location?: ClaudeUserLocation;
}

export interface ClaudeUserLocation {
  type: 'approximate';
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
}

// -- Anthropic Messages API response -----------------------------------------

export interface ClaudeMessagesResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: ClaudeContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  usage: ClaudeUsage;
}

export type ClaudeContentBlock = ClaudeTextBlock | ClaudeWebSearchToolResult | ClaudeToolUseBlock;

export interface ClaudeTextBlock {
  type: 'text';
  text: string;
  citations?: ClaudeCitation[];
}

export interface ClaudeCitation {
  type: 'web_search_result_location';
  url: string;
  title: string;
  encrypted_index: string;
  cited_text: string;
}

export interface ClaudeWebSearchToolResult {
  type: 'web_search_tool_result';
  content: ClaudeWebSearchContent[] | ClaudeWebSearchError;
}

export interface ClaudeWebSearchContent {
  type: 'web_search_result';
  url: string;
  title: string;
  encrypted_index: string;
  page_age?: string;
}

export interface ClaudeWebSearchError {
  type: 'web_search_tool_result_error';
  error_code: string;
}

export interface ClaudeToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
  server_tool_use?: {
    web_search_requests: number;
  };
}

// -- Anthropic error response ------------------------------------------------

export interface ClaudeErrorResponse {
  type: 'error';
  error: {
    type: string;
    message: string;
  };
  request_id?: string;
}

// -- Rate limit info extracted from response headers -------------------------

export interface ClaudeRateLimitInfo {
  requestsLimit?: number;
  requestsRemaining?: number;
  requestsReset?: string;
  tokensLimit?: number;
  tokensRemaining?: number;
  tokensReset?: string;
  inputTokensLimit?: number;
  inputTokensRemaining?: number;
  inputTokensReset?: string;
  outputTokensLimit?: number;
  outputTokensRemaining?: number;
  outputTokensReset?: string;
}
