import type { AdapterFactory, AdapterMetadata } from '../adapter.types';
import type { AdapterRegistry } from '../adapter.registry';
import { ChatGPTAdapter } from './chatgpt.adapter';

export const CHATGPT_METADATA: AdapterMetadata = {
  platformId: 'chatgpt',
  displayName: 'ChatGPT',
  version: '1.0.0',
  apiVersion: '2025-03',
  capabilities: ['web_search', 'citation_extraction'],
  credentialSchema: [{ field: 'apiKey', type: 'string', required: true, sensitive: true }],
  healthCheckStrategy: 'lightweight_query',
  supportedLocales: ['*'],
};

export const chatgptAdapterFactory: AdapterFactory = (config) => new ChatGPTAdapter(config);

export function registerChatGPTAdapter(registry: AdapterRegistry): void {
  registry.registerPlatform(CHATGPT_METADATA, chatgptAdapterFactory);
}
