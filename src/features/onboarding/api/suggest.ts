import { apiFetch } from '@/lib/query/fetch';

export type SuggestionStatus = 'pending' | 'fetching' | 'suggesting' | 'done' | 'failed';

export type SuggestionExtracted = {
  brandName: string;
  aliases: string[];
  description: string | null;
  categories: string[];
};

export type SuggestionCompetitor = {
  name: string;
  domain: string | null;
  reason: string | null;
};

export type SuggestionPrompt = {
  text: string;
  tag: string | null;
};

export type SuggestionError = {
  code: string;
  message: string;
  stage: 'fetch' | 'aliases' | 'competitors' | 'prompts';
};

export type SuggestionDto = {
  id: string;
  domain: string;
  status: SuggestionStatus;
  error: SuggestionError | null;
  extracted: SuggestionExtracted | null;
  suggestedCompetitors: SuggestionCompetitor[] | null;
  suggestedPrompts: SuggestionPrompt[] | null;
  suggestedAliases: string[] | null;
  engineUsed: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateSuggestionResponse = SuggestionDto & {
  cached: boolean;
  inFlight: boolean;
};

export type CreateSuggestionInput = {
  domain: string;
  regenerate?: boolean;
  fromJobId?: string;
};

export function createSuggestion(
  input: string | CreateSuggestionInput
): Promise<CreateSuggestionResponse> {
  const body = typeof input === 'string' ? { domain: input } : input;
  return apiFetch<CreateSuggestionResponse>('/onboarding/suggest', {
    method: 'POST',
    body,
  });
}

export function getSuggestion(jobId: string): Promise<SuggestionDto> {
  return apiFetch<SuggestionDto>(`/onboarding/suggest/${encodeURIComponent(jobId)}`);
}
