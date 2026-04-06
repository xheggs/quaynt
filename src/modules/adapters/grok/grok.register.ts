import type { AdapterFactory, AdapterMetadata } from '../adapter.types';
import type { AdapterRegistry } from '../adapter.registry';
import { GrokAdapter } from './grok.adapter';

export const GROK_METADATA: AdapterMetadata = {
  platformId: 'grok',
  displayName: 'Grok',
  version: '1.0.0',
  apiVersion: '2025-03',
  capabilities: ['web_search', 'x_search', 'citation_extraction'],
  credentialSchema: [{ field: 'apiKey', type: 'string', required: true, sensitive: true }],
  healthCheckStrategy: 'lightweight_query',
  supportedLocales: ['*'],
};

export const grokAdapterFactory: AdapterFactory = (config) => new GrokAdapter(config);

export function registerGrokAdapter(registry: AdapterRegistry): void {
  registry.registerPlatform(GROK_METADATA, grokAdapterFactory);
}
