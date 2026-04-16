import { apiFetch, apiFetchPaginated } from '@/lib/query/fetch';
import type { PaginatedResponse, QueryFilters } from '@/lib/query/types';
import type {
  PromptSet,
  PromptSetDetail,
  CreatePromptSetInput,
  UpdatePromptSetInput,
  Prompt,
  CreatePromptInput,
  UpdatePromptInput,
} from './prompt-set.types';

// --- Prompt Set CRUD ---

export function fetchPromptSets(params: QueryFilters): Promise<PaginatedResponse<PromptSet>> {
  return apiFetchPaginated<PromptSet>('/prompt-sets', { ...params });
}

export function fetchPromptSet(id: string): Promise<PromptSetDetail> {
  return apiFetch<PromptSetDetail>(`/prompt-sets/${id}`);
}

export function createPromptSet(input: CreatePromptSetInput): Promise<PromptSet> {
  return apiFetch<PromptSet>('/prompt-sets', { method: 'POST', body: input });
}

export function updatePromptSet(id: string, input: UpdatePromptSetInput): Promise<PromptSet> {
  return apiFetch<PromptSet>(`/prompt-sets/${id}`, {
    method: 'PATCH',
    body: input,
  });
}

export function deletePromptSet(id: string): Promise<void> {
  return apiFetch<void>(`/prompt-sets/${id}`, { method: 'DELETE' });
}

// --- Prompt Sub-resource CRUD ---

export function fetchPrompts(promptSetId: string): Promise<Prompt[]> {
  return apiFetch<Prompt[]>(`/prompt-sets/${promptSetId}/prompts`);
}

export function addPrompt(promptSetId: string, input: CreatePromptInput): Promise<Prompt> {
  return apiFetch<Prompt>(`/prompt-sets/${promptSetId}/prompts`, {
    method: 'POST',
    body: input,
  });
}

export function updatePrompt(
  promptSetId: string,
  promptId: string,
  input: UpdatePromptInput
): Promise<Prompt> {
  return apiFetch<Prompt>(`/prompt-sets/${promptSetId}/prompts/${promptId}`, {
    method: 'PATCH',
    body: input,
  });
}

export function deletePrompt(promptSetId: string, promptId: string): Promise<void> {
  return apiFetch<void>(`/prompt-sets/${promptSetId}/prompts/${promptId}`, {
    method: 'DELETE',
  });
}

export function reorderPrompts(
  promptSetId: string,
  promptIds: string[]
): Promise<{ reordered: boolean }> {
  return apiFetch<{ reordered: boolean }>(`/prompt-sets/${promptSetId}/prompts/reorder`, {
    method: 'PUT',
    body: { promptIds },
  });
}
