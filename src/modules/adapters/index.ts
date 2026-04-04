export { AdapterRegistry } from './adapter.registry';
export { BasePlatformAdapter } from './adapter.base';
export { encryptCredential, decryptCredential } from './adapter.crypto';
export { retryWithBackoff, CircuitBreaker, isTransientError } from './adapter.resilience';
export * from './adapter.types';

// -- Shared registry instance -----------------------------------------------

import { AdapterRegistry } from './adapter.registry';
import { registerChatGPTAdapter } from './chatgpt';
import { registerPerplexityAdapter } from './perplexity';

let registry: AdapterRegistry | null = null;

export function getAdapterRegistry(): AdapterRegistry {
  if (!registry) {
    registry = new AdapterRegistry();
    registerChatGPTAdapter(registry);
    registerPerplexityAdapter(registry);
  }
  return registry;
}
