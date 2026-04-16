/**
 * Client-side model run types mirroring the API response shapes.
 * See: modules/model-runs/model-run.schema.ts (database schema)
 * See: app/api/v1/model-runs/route.ts (API response)
 */

export type ModelRunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'cancelled';

export type ModelRunResultStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface ResultSummary {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  running: number;
  skipped: number;
}

export interface ModelRun {
  id: string;
  workspaceId: string;
  promptSetId: string;
  brandId: string;
  adapterConfigIds: string[];
  locale: string | null;
  market: string | null;
  status: ModelRunStatus;
  totalResults: number;
  pendingResults: number;
  errorSummary: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModelRunDetail extends ModelRun {
  resultSummary: ResultSummary;
}

export interface ModelRunResult {
  id: string;
  modelRunId: string;
  promptId: string;
  adapterConfigId: string;
  platformId: string;
  interpolatedPrompt: string;
  status: ModelRunResultStatus;
  textContent: string | null;
  responseMetadata: Record<string, unknown> | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateModelRunInput {
  promptSetId: string;
  brandId: string;
  adapterConfigIds: string[];
  locale?: string;
  market?: string;
}

export interface AdapterConfig {
  id: string;
  platformId: string;
  displayName: string;
  enabled: boolean;
  credentialsSet: boolean;
}

export type NameLookup = Record<string, string>;

export const TERMINAL_STATUSES: ModelRunStatus[] = ['completed', 'partial', 'failed', 'cancelled'];

export function isTerminalStatus(status: ModelRunStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export interface LocaleOption {
  value: string;
  label: string;
}

export interface LocaleGroup {
  labelKey: string;
  options: LocaleOption[];
}

export const SUPPORTED_LOCALES: LocaleGroup[] = [
  {
    labelKey: 'labels.localeGroupAmericas',
    options: [
      { value: 'en-US', label: 'English (US)' },
      { value: 'en-CA', label: 'English (Canada)' },
      { value: 'es-MX', label: 'Spanish (Mexico)' },
      { value: 'pt-BR', label: 'Portuguese (Brazil)' },
      { value: 'fr-CA', label: 'French (Canada)' },
    ],
  },
  {
    labelKey: 'labels.localeGroupEurope',
    options: [
      { value: 'en-GB', label: 'English (UK)' },
      { value: 'de-DE', label: 'German (Germany)' },
      { value: 'fr-FR', label: 'French (France)' },
      { value: 'es-ES', label: 'Spanish (Spain)' },
      { value: 'it-IT', label: 'Italian (Italy)' },
      { value: 'nl-NL', label: 'Dutch (Netherlands)' },
      { value: 'pl-PL', label: 'Polish (Poland)' },
      { value: 'sv-SE', label: 'Swedish (Sweden)' },
    ],
  },
  {
    labelKey: 'labels.localeGroupAsiaPacific',
    options: [
      { value: 'ja-JP', label: 'Japanese (Japan)' },
      { value: 'ko-KR', label: 'Korean (South Korea)' },
      { value: 'zh-CN', label: 'Chinese (Simplified)' },
      { value: 'en-AU', label: 'English (Australia)' },
      { value: 'en-IN', label: 'English (India)' },
    ],
  },
  {
    labelKey: 'labels.localeGroupMena',
    options: [
      { value: 'ar-SA', label: 'Arabic (Saudi Arabia)' },
      { value: 'ar-AE', label: 'Arabic (UAE)' },
      { value: 'he-IL', label: 'Hebrew (Israel)' },
      { value: 'tr-TR', label: 'Turkish (Turkey)' },
    ],
  },
];
