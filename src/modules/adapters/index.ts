export { AdapterRegistry } from './adapter.registry';
export { BasePlatformAdapter } from './adapter.base';
export { encryptCredential, decryptCredential } from './adapter.crypto';
export { retryWithBackoff, CircuitBreaker, isTransientError } from './adapter.resilience';
export * from './adapter.types';

// -- Shared registry instance -----------------------------------------------

import { AdapterRegistry } from './adapter.registry';
import { registerAioAdapter } from './aio';
import { registerChatGPTAdapter } from './chatgpt';
import { registerClaudeAdapter } from './claude';
import { registerCopilotAdapter } from './copilot';
import { registerDeepSeekAdapter } from './deepseek';
import { registerGeminiAdapter } from './gemini';
import { registerGrokAdapter } from './grok';
import { registerOpenRouterPlatforms } from './openrouter';
import { registerPerplexityAdapter } from './perplexity';

let registry: AdapterRegistry | null = null;

export function getAdapterRegistry(): AdapterRegistry {
  if (!registry) {
    registry = new AdapterRegistry();
    registerChatGPTAdapter(registry);
    registerPerplexityAdapter(registry);
    registerGeminiAdapter(registry);
    registerClaudeAdapter(registry);
    registerAioAdapter(registry);
    registerCopilotAdapter(registry);
    registerDeepSeekAdapter(registry);
    registerGrokAdapter(registry);
    registerOpenRouterPlatforms(registry);
  }
  return registry;
}
