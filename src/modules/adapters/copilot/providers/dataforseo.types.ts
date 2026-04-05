// ---------------------------------------------------------------------------
// DataForSEO raw response types for Bing Organic SERP (Copilot data).
// ---------------------------------------------------------------------------

export interface DataForSeoCopilotRequestItem {
  keyword: string;
  location_code?: number;
  location_name?: string;
  language_code?: string;
}

export type DataForSeoCopilotRequest = DataForSeoCopilotRequestItem[];

export interface DataForSeoCopilotResponse {
  tasks?: DataForSeoCopilotTask[];
}

export interface DataForSeoCopilotTask {
  id: string;
  status_code: number;
  status_message: string;
  result?: DataForSeoCopilotResult[];
}

export interface DataForSeoCopilotResult {
  keyword: string;
  items?: DataForSeoCopilotItem[];
}

export interface DataForSeoCopilotItem {
  type: string;
  items?: DataForSeoCopilotAiOverviewSubItem[];
  references?: DataForSeoCopilotAiOverviewReference[];
}

export interface DataForSeoCopilotAiOverviewSubItem {
  type?: string;
  text?: string;
  references?: DataForSeoCopilotAiOverviewReference[];
}

export interface DataForSeoCopilotAiOverviewReference {
  type?: string;
  source?: string;
  domain?: string;
  url?: string;
  title?: string;
  text?: string;
}

export interface DataForSeoCopilotErrorResponse {
  status_code: number;
  status_message: string;
}
