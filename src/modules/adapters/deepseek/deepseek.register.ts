import type { AdapterFactory, AdapterMetadata } from '../adapter.types';
import type { AdapterRegistry } from '../adapter.registry';
import { DeepSeekAdapter } from './deepseek.adapter';

export const DEEPSEEK_METADATA: AdapterMetadata = {
  platformId: 'deepseek',
  displayName: 'DeepSeek',
  version: '1.0.0',
  apiVersion: 'unversioned',
  capabilities: [],
  credentialSchema: [{ field: 'apiKey', type: 'string', required: true, sensitive: true }],
  healthCheckStrategy: 'lightweight_query',
  supportedLocales: ['*'],
  dataJurisdiction: 'CN',
};

export const deepseekAdapterFactory: AdapterFactory = (config) => new DeepSeekAdapter(config);

export function registerDeepSeekAdapter(registry: AdapterRegistry): void {
  registry.registerPlatform(DEEPSEEK_METADATA, deepseekAdapterFactory);
}
