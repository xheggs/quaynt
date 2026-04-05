// ---------------------------------------------------------------------------
// SerpAPI raw response types for the bing_copilot engine.
// ---------------------------------------------------------------------------

export interface SerpApiCopilotResponse {
  search_metadata?: {
    id?: string;
  };
  search_parameters?: Record<string, string>;
  header?: string;
  header_video?: {
    title?: string;
    link?: string;
    thumbnail_url?: string;
  };
  text_blocks?: SerpApiCopilotTextBlock[];
  references?: SerpApiCopilotReference[];
}

export interface SerpApiCopilotTextBlock {
  type?: string;
  text?: string;
  snippet_links?: { text?: string; link?: string }[];
  reference_indexes?: number[];
  /** Heading level (for `heading` type). */
  level?: number;
  /** List items (for `list` type). */
  items?: string[];
  /** Code block language (for `code_block` type). */
  language?: string;
  /** Code block content (for `code_block` type). */
  code?: string;
  /** Table headers (for `table` type). */
  headers?: string[];
  /** Table rows (for `table` type). */
  table?: string[][];
}

export interface SerpApiCopilotReference {
  index?: number;
  title?: string;
  link?: string;
  snippet?: string;
  source?: string;
}

export interface SerpApiCopilotErrorResponse {
  error: string;
}
