// ---------------------------------------------------------------------------
// AIO adapter registration — metadata, factory, and registry wiring.
// ---------------------------------------------------------------------------

import type { AdapterFactory, AdapterMetadata } from '../adapter.types';
import type { AdapterRegistry } from '../adapter.registry';
import { AioAdapter } from './aio.adapter';

export const AIO_METADATA: AdapterMetadata = {
  platformId: 'aio',
  displayName: 'AI Overviews',
  version: '1.0.0',
  apiVersion: '2026-04',
  capabilities: ['search_monitoring', 'citation_extraction'],
  credentialSchema: [
    { field: 'apiKey', type: 'string', required: false, sensitive: true },
    { field: 'username', type: 'string', required: false, sensitive: false },
    { field: 'password', type: 'string', required: false, sensitive: true },
  ],
  healthCheckStrategy: 'api_ping',
  supportedLocales: ['*'],
};

export const aioAdapterFactory: AdapterFactory = (config) => new AioAdapter(config);

export function registerAioAdapter(registry: AdapterRegistry): void {
  registry.registerPlatform(AIO_METADATA, aioAdapterFactory);
}
