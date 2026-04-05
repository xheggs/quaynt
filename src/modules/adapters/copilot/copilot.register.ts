// ---------------------------------------------------------------------------
// Copilot adapter registration — metadata, factory, and registry wiring.
// ---------------------------------------------------------------------------

import type { AdapterFactory, AdapterMetadata } from '../adapter.types';
import type { AdapterRegistry } from '../adapter.registry';
import { CopilotAdapter } from './copilot.adapter';

export const COPILOT_METADATA: AdapterMetadata = {
  platformId: 'copilot',
  displayName: 'Microsoft Copilot',
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

export const copilotAdapterFactory: AdapterFactory = (config) => new CopilotAdapter(config);

export function registerCopilotAdapter(registry: AdapterRegistry): void {
  registry.registerPlatform(COPILOT_METADATA, copilotAdapterFactory);
}
