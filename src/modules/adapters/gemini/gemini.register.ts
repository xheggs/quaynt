import type { AdapterFactory, AdapterMetadata } from '../adapter.types';
import type { AdapterRegistry } from '../adapter.registry';
import { GeminiAdapter } from './gemini.adapter';

export const GEMINI_METADATA: AdapterMetadata = {
  platformId: 'gemini',
  displayName: 'Gemini',
  version: '1.0.0',
  apiVersion: 'v1beta',
  capabilities: ['web_search', 'citation_extraction', 'confidence_scores'],
  credentialSchema: [{ field: 'apiKey', type: 'string', required: true, sensitive: true }],
  healthCheckStrategy: 'lightweight_query',
  supportedLocales: ['*'],
};

export const geminiAdapterFactory: AdapterFactory = (config) => new GeminiAdapter(config);

export function registerGeminiAdapter(registry: AdapterRegistry): void {
  registry.registerPlatform(GEMINI_METADATA, geminiAdapterFactory);
}
