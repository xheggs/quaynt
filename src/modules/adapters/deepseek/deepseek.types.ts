// ---------------------------------------------------------------------------
// DeepSeek adapter types — internal to the deepseek module.
// These mirror the DeepSeek Chat Completions API request/response shapes.
// ---------------------------------------------------------------------------

// -- Platform-specific config (stored in AdapterConfig.config JSONB) ---------

export interface DeepSeekConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemInstruction?: string;
}

export const DEEPSEEK_CONFIG_DEFAULTS: DeepSeekConfig = {
  model: 'deepseek-chat',
};

/**
 * Known DeepSeek models.
 * Used for documentation/validation hints — the adapter accepts any string
 * to support future models without code changes (see D11).
 */
export const KNOWN_MODELS = ['deepseek-chat', 'deepseek-reasoner'] as const;

// -- DeepSeek Chat Completions API request -----------------------------------

export interface DeepSeekChatRequest {
  model: string;
  messages: DeepSeekMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string | string[];
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// -- DeepSeek Chat Completions API response ----------------------------------

export interface DeepSeekChatResponse {
  id: string;
  object: string;
  model: string;
  created: number;
  system_fingerprint?: string;
  choices: DeepSeekChoice[];
  usage: DeepSeekUsage;
}

export interface DeepSeekChoice {
  index: number;
  finish_reason: DeepSeekFinishReason;
  message: DeepSeekResponseMessage;
}

export type DeepSeekFinishReason =
  | 'stop'
  | 'length'
  | 'content_filter'
  | 'tool_calls'
  | 'insufficient_system_resource';

export interface DeepSeekResponseMessage {
  role: 'assistant';
  content: string | null;
  reasoning_content?: string;
}

export interface DeepSeekUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  completion_tokens_details?: {
    reasoning_tokens: number;
  };
}

// -- DeepSeek error response -------------------------------------------------

export interface DeepSeekErrorResponse {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}
