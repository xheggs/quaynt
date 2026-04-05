// ---------------------------------------------------------------------------
// DataForSEO raw response types.
// ---------------------------------------------------------------------------

export interface DataForSeoRequestItem {
  keyword: string;
  location_code?: number;
  location_name?: string;
  language_code?: string;
  expand_ai_overview?: boolean;
  load_async_ai_overview?: boolean;
}

export type DataForSeoRequest = DataForSeoRequestItem[];

export interface DataForSeoResponse {
  tasks?: DataForSeoTask[];
}

export interface DataForSeoTask {
  id: string;
  status_code: number;
  status_message: string;
  result?: DataForSeoResult[];
}

export interface DataForSeoResult {
  keyword: string;
  items?: DataForSeoItem[];
}

export interface DataForSeoItem {
  type: string;
  // AI Overview items carry text/link data in various shapes
  text?: string;
  items?: DataForSeoAiOverviewSubItem[];
  references?: DataForSeoAiOverviewReference[];
}

export interface DataForSeoAiOverviewSubItem {
  type?: string;
  text?: string;
  items?: DataForSeoAiOverviewSubItem[];
}

export interface DataForSeoAiOverviewReference {
  title?: string;
  url?: string;
  snippet?: string;
  source?: string;
}

export interface DataForSeoErrorResponse {
  status_code: number;
  status_message: string;
}

// Re-export from shared module — keeps existing imports working.
export { COUNTRY_TO_LOCATION_CODE } from '../../serp/location-codes';
