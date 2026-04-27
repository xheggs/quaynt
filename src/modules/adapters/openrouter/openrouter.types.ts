// OpenRouter Chat Completions response shapes.
//
// OpenRouter speaks OpenAI Chat Completions on the wire. Provider-native
// citation formats (Perplexity Sonar's flat URL array, OpenAI url_citation
// annotations) are preserved or normalized to `message.annotations[]`
// depending on the upstream model — parsers in `openrouter.citations.ts`
// handle both.

export interface OpenRouterUrlCitation {
  url: string;
  title?: string;
  content?: string;
  start_index?: number;
  end_index?: number;
}

export interface OpenRouterAnnotation {
  type: string;
  url_citation?: OpenRouterUrlCitation;
}

export interface OpenRouterMessage {
  role: string;
  content?: string | null;
  annotations?: OpenRouterAnnotation[];
  // Sonar (Perplexity) sometimes carries citations as a flat array on the
  // message. We accept either shape and dedupe.
  citations?: string[];
}

export interface OpenRouterChoice {
  index: number;
  message: OpenRouterMessage;
  finish_reason?: string;
}

export interface OpenRouterUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface OpenRouterChatResponse {
  id: string;
  model: string;
  choices: OpenRouterChoice[];
  usage?: OpenRouterUsage;
  // Some providers (Sonar) populate top-level citations as well.
  citations?: string[];
}

export interface OpenRouterChatRequest {
  model: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  stream?: false;
  temperature?: number;
  max_tokens?: number;
  // OpenRouter-specific multi-model fallback. Not used in v1, but reserved.
  models?: string[];
}

export interface OpenRouterErrorResponse {
  error?: {
    message?: string;
    code?: string | number;
  };
}

/** Citation extraction strategy per virtual platform. */
export type OpenRouterCitationStyle = 'online' | 'sonar';

/** Static config carried by each registered virtual platform. */
export interface OpenRouterPlatformConfig {
  /** Underlying OpenRouter model slug (e.g. `perplexity/sonar-pro`, `openai/gpt-4o:online`). */
  orModel: string;
  /** How to parse citations from the OR response. */
  citationStyle: OpenRouterCitationStyle;
}

export const OPENROUTER_CREDENTIAL_PLATFORM_ID = 'openrouter';
