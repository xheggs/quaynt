// ---------------------------------------------------------------------------
// SERP provider interface — abstraction over third-party SERP API vendors.
// ---------------------------------------------------------------------------

import type { Logger } from 'pino';
import { PermanentAdapterError } from '../adapter.types';
import type { SerpSearchParams, SerpSearchResult } from './aio.types';
import { SUPPORTED_SERP_PROVIDERS } from './aio.types';
import { SearchApiProvider } from './providers/searchapi.provider';
import { DataForSeoProvider } from './providers/dataforseo.provider';

export interface SerpProvider {
  readonly providerId: string;
  search(query: string, params: SerpSearchParams): Promise<SerpSearchResult>;
  /** Throws on failure. */
  healthCheck(): Promise<void>;
}

/**
 * Factory function — creates the correct SerpProvider for the given provider ID.
 * Plain switch statement; no internal registry. Two providers in the same module
 * don't warrant a registry pattern.
 */
export function createSerpProvider(
  providerId: string,
  credentials: Record<string, unknown>,
  config: Record<string, unknown>,
  log: Logger
): SerpProvider {
  switch (providerId) {
    case 'searchapi':
      return new SearchApiProvider(credentials, config, log);
    case 'dataforseo':
      return new DataForSeoProvider(credentials, config, log);
    default:
      throw new PermanentAdapterError(
        `Unknown SERP provider: ${providerId}. Supported providers: ${SUPPORTED_SERP_PROVIDERS.join(', ')}`,
        'aio'
      );
  }
}
