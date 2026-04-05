import type { AdapterFactory, AdapterMetadata } from '../adapter.types';
import type { AdapterRegistry } from '../adapter.registry';
import { ClaudeAdapter } from './claude.adapter';

export const CLAUDE_METADATA: AdapterMetadata = {
  platformId: 'claude',
  displayName: 'Claude',
  version: '1.0.0',
  apiVersion: '2023-06-01',
  capabilities: ['web_search', 'citation_extraction'],
  credentialSchema: [{ field: 'apiKey', type: 'string', required: true, sensitive: true }],
  healthCheckStrategy: 'lightweight_query',
  supportedLocales: ['*'],
};

export const claudeAdapterFactory: AdapterFactory = (config) => new ClaudeAdapter(config);

export function registerClaudeAdapter(registry: AdapterRegistry): void {
  registry.registerPlatform(CLAUDE_METADATA, claudeAdapterFactory);
}
