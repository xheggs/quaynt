// ---------------------------------------------------------------------------
// SearchAPI.io raw response types.
// ---------------------------------------------------------------------------

export interface SearchApiSearchResponse {
  search_metadata?: {
    id?: string;
  };
  ai_overview?: SearchApiAiOverview;
}

export interface SearchApiAiOverview {
  text_blocks?: SearchApiTextBlock[];
  references?: SearchApiReferenceItem[];
  page_token?: string;
  serpapi_link?: string;
}

export interface SearchApiTextBlock {
  type?: string;
  snippet?: string;
  snippet_highlighted_words?: string[];
  list?: string[];
  reference_indexes?: number[];
}

export interface SearchApiReferenceItem {
  title?: string;
  link?: string;
  snippet?: string;
  source?: string;
  index?: number;
}

export interface SearchApiErrorResponse {
  error: string;
}
