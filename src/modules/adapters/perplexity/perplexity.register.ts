import type { AdapterFactory, AdapterMetadata } from '../adapter.types';
import type { AdapterRegistry } from '../adapter.registry';
import { PerplexityAdapter } from './perplexity.adapter';

export const PERPLEXITY_METADATA: AdapterMetadata = {
  platformId: 'perplexity',
  displayName: 'Perplexity',
  version: '1.0.0',
  apiVersion: 'v1',
  capabilities: ['web_search', 'citation_extraction', 'recency_filter', 'language_filter'],
  credentialSchema: [{ field: 'apiKey', type: 'string', required: true, sensitive: true }],
  healthCheckStrategy: 'lightweight_query',
  supportedLocales: ['*'],
};

export const perplexityAdapterFactory: AdapterFactory = (config) => new PerplexityAdapter(config);

export function registerPerplexityAdapter(registry: AdapterRegistry): void {
  registry.registerPlatform(PERPLEXITY_METADATA, perplexityAdapterFactory);
}
