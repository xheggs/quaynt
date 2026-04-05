// ---------------------------------------------------------------------------
// Gemini adapter types — internal to the gemini module.
// These mirror the Google Generative Language API request/response shapes.
// ---------------------------------------------------------------------------

// -- Platform-specific config (stored in AdapterConfig.config JSONB) ---------

export type GeminiHarmBlockThreshold =
  | 'BLOCK_NONE'
  | 'BLOCK_ONLY_HIGH'
  | 'BLOCK_MEDIUM_AND_ABOVE'
  | 'BLOCK_LOW_AND_ABOVE';

export interface GeminiConfig {
  model: string;
  apiVersion: string;
  safetyThreshold: GeminiHarmBlockThreshold;
  temperature?: number;
  maxOutputTokens?: number;
  systemInstruction?: string;
}

export const GEMINI_CONFIG_DEFAULTS: GeminiConfig = {
  model: 'gemini-2.5-flash',
  apiVersion: 'v1beta',
  safetyThreshold: 'BLOCK_ONLY_HIGH',
};

// -- Gemini generateContent request ------------------------------------------

export interface GeminiGenerateContentRequest {
  contents: GeminiContent[];
  systemInstruction?: GeminiSystemInstruction;
  tools?: GeminiTool[];
  safetySettings?: GeminiSafetySetting[];
  generationConfig?: GeminiGenerationConfig;
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export interface GeminiSystemInstruction {
  parts: GeminiPart[];
}

export interface GeminiPart {
  text: string;
}

export type GeminiTool = { google_search: Record<string, never> };

export interface GeminiSafetySetting {
  category: string;
  threshold: string;
}

export interface GeminiGenerationConfig {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
}

// -- Gemini generateContent response -----------------------------------------

export interface GeminiGenerateContentResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
  modelVersion?: string;
}

export interface GeminiCandidate {
  content?: GeminiContent;
  groundingMetadata?: GeminiGroundingMetadata;
  finishReason: string;
  safetyRatings?: GeminiSafetyRating[];
}

export interface GeminiGroundingMetadata {
  groundingChunks?: GeminiGroundingChunk[];
  groundingSupports?: GeminiGroundingSupport[];
  searchEntryPoint?: { renderedContent: string };
  webSearchQueries?: string[];
}

export interface GeminiGroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface GeminiGroundingSupport {
  segment: {
    text?: string;
    startIndex?: number;
    endIndex?: number;
  };
  groundingChunkIndices: number[];
  confidenceScores: number[];
}

export interface GeminiSafetyRating {
  category: string;
  probability: string;
}

export interface GeminiUsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

// -- Gemini error response ---------------------------------------------------

export interface GeminiErrorResponse {
  error: {
    code: number;
    message: string;
    status: string;
  };
}

// -- Safety category constants -----------------------------------------------

export const HARM_CATEGORIES = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
  'HARM_CATEGORY_CIVIC_INTEGRITY',
] as const;

export const VALID_SAFETY_THRESHOLDS: GeminiHarmBlockThreshold[] = [
  'BLOCK_NONE',
  'BLOCK_ONLY_HIGH',
  'BLOCK_MEDIUM_AND_ABOVE',
  'BLOCK_LOW_AND_ABOVE',
];
