// ---------------------------------------------------------------------------
// Copilot SERP provider interface — abstraction over third-party SERP API
// vendors for Microsoft Copilot data extraction.
// ---------------------------------------------------------------------------

import type { Logger } from 'pino';
import { PermanentAdapterError } from '../adapter.types';
import type { CopilotSearchParams, CopilotSearchResult } from './copilot.types';
import { SUPPORTED_COPILOT_PROVIDERS } from './copilot.types';
import { SerpApiCopilotProvider } from './providers/serpapi.provider';
import { DataForSeoCopilotProvider } from './providers/dataforseo.provider';

export interface CopilotSerpProvider {
  readonly providerId: string;
  search(query: string, params: CopilotSearchParams): Promise<CopilotSearchResult>;
  /** Throws on failure. */
  healthCheck(): Promise<void>;
}

/**
 * Factory function — creates the correct CopilotSerpProvider for the given
 * provider ID. Plain switch statement; no internal registry.
 */
export function createCopilotSerpProvider(
  providerId: string,
  credentials: Record<string, unknown>,
  config: Record<string, unknown>,
  log: Logger
): CopilotSerpProvider {
  switch (providerId) {
    case 'serpapi':
      return new SerpApiCopilotProvider(credentials, config, log);
    case 'dataforseo':
      return new DataForSeoCopilotProvider(credentials, config, log);
    default:
      throw new PermanentAdapterError(
        `Unknown SERP provider: ${providerId}. Supported providers: ${SUPPORTED_COPILOT_PROVIDERS.join(', ')}`,
        'copilot'
      );
  }
}
