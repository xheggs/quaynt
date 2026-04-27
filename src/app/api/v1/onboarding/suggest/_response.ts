import type { OnboardingSuggestionRecord } from '@/modules/onboarding/onboarding-suggest.service';

export type OnboardingSuggestionDto = {
  id: string;
  domain: string;
  status: OnboardingSuggestionRecord['status'];
  error: OnboardingSuggestionRecord['error'];
  extracted: OnboardingSuggestionRecord['extracted'];
  suggestedCompetitors: OnboardingSuggestionRecord['suggestedCompetitors'];
  suggestedPrompts: OnboardingSuggestionRecord['suggestedPrompts'];
  suggestedAliases: OnboardingSuggestionRecord['suggestedAliases'];
  engineUsed: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toSuggestionResponse(row: OnboardingSuggestionRecord): OnboardingSuggestionDto {
  return {
    id: row.id,
    domain: row.domain,
    status: row.status,
    error: row.error,
    extracted: row.extracted,
    suggestedCompetitors: row.suggestedCompetitors,
    suggestedPrompts: row.suggestedPrompts,
    suggestedAliases: row.suggestedAliases,
    engineUsed: row.engineUsed,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
