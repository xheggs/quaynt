import type { AdapterFactory, AdapterMetadata } from '../adapter.types';
import type { AdapterRegistry } from '../adapter.registry';
import { OpenRouterAdapter } from './openrouter.adapter';
import { registerOpenRouterVirtualPlatformId } from './openrouter.budget';
import {
  OPENROUTER_CREDENTIAL_PLATFORM_ID,
  type OpenRouterPlatformConfig,
} from './openrouter.types';

/**
 * Credential-only adapter row holding the workspace's shared OpenRouter API
 * key. Never queryable; every OR-backed virtual platform's metadata declares
 * `credentialSource: 'openrouter'` so the runtime credential resolver redirects
 * to this row.
 */
export const OPENROUTER_CREDENTIAL_METADATA: AdapterMetadata = {
  platformId: OPENROUTER_CREDENTIAL_PLATFORM_ID,
  displayName: 'OpenRouter',
  version: '1.0.0',
  apiVersion: 'v1',
  capabilities: ['shared_credential'],
  credentialSchema: [{ field: 'apiKey', type: 'string', required: true, sensitive: true }],
  healthCheckStrategy: 'auth_verify',
  supportedLocales: ['*'],
  kind: 'credential-only',
};

/**
 * Virtual platforms backed by OpenRouter. `orModel` and `citationStyle` are
 * fixed per platformId — operators choose the platform, not the model. This
 * keeps the catalogue honest about which signal class each row produces.
 *
 * `credentialSource` on every entry redirects credential resolution to the
 * shared `openrouter` row above.
 */
const VIRTUAL_PLATFORMS: {
  metadata: AdapterMetadata;
  staticConfig: OpenRouterPlatformConfig;
}[] = [
  {
    metadata: {
      platformId: 'openrouter-sonar-pro',
      displayName: 'OpenRouter — Sonar Pro',
      version: '1.0.0',
      apiVersion: 'v1',
      capabilities: ['web_search', 'citation_extraction'],
      credentialSchema: [],
      healthCheckStrategy: 'lightweight_query',
      supportedLocales: ['*'],
      kind: 'queryable',
      credentialSource: OPENROUTER_CREDENTIAL_PLATFORM_ID,
    },
    staticConfig: { orModel: 'perplexity/sonar-pro', citationStyle: 'sonar' },
  },
  {
    metadata: {
      platformId: 'openrouter-gpt4o-online',
      displayName: 'OpenRouter — GPT-4o + Exa',
      version: '1.0.0',
      apiVersion: 'v1',
      capabilities: ['web_search', 'citation_extraction'],
      credentialSchema: [],
      healthCheckStrategy: 'lightweight_query',
      supportedLocales: ['*'],
      kind: 'queryable',
      credentialSource: OPENROUTER_CREDENTIAL_PLATFORM_ID,
    },
    staticConfig: { orModel: 'openai/gpt-4o:online', citationStyle: 'online' },
  },
  {
    metadata: {
      platformId: 'openrouter-claude-online',
      displayName: 'OpenRouter — Claude + Exa',
      version: '1.0.0',
      apiVersion: 'v1',
      capabilities: ['web_search', 'citation_extraction'],
      credentialSchema: [],
      healthCheckStrategy: 'lightweight_query',
      supportedLocales: ['*'],
      kind: 'queryable',
      credentialSource: OPENROUTER_CREDENTIAL_PLATFORM_ID,
    },
    staticConfig: {
      orModel: 'anthropic/claude-3.5-sonnet:online',
      citationStyle: 'online',
    },
  },
  {
    metadata: {
      platformId: 'openrouter-deepseek',
      displayName: 'OpenRouter — DeepSeek',
      version: '1.0.0',
      apiVersion: 'v1',
      // No web search — measures parametric brand knowledge only.
      capabilities: [],
      credentialSchema: [],
      healthCheckStrategy: 'lightweight_query',
      supportedLocales: ['*'],
      kind: 'queryable',
      credentialSource: OPENROUTER_CREDENTIAL_PLATFORM_ID,
    },
    staticConfig: { orModel: 'deepseek/deepseek-chat', citationStyle: 'online' },
  },
  {
    // Free auto-router: OpenRouter routes the request to whatever free model
    // is currently available in their pool. The free pool turns over often
    // (today's `:free` slugs aren't tomorrow's), so this slug is the durable
    // way to get zero-cost coverage without code edits. Per-adapter
    // `config.orModel` can override to a specific free slug if an operator
    // wants determinism. No grounding — measures parametric knowledge only.
    metadata: {
      platformId: 'openrouter-free',
      displayName: 'OpenRouter — Free auto-router',
      version: '1.0.0',
      apiVersion: 'v1',
      capabilities: [],
      credentialSchema: [],
      healthCheckStrategy: 'lightweight_query',
      supportedLocales: ['*'],
      kind: 'queryable',
      credentialSource: OPENROUTER_CREDENTIAL_PLATFORM_ID,
    },
    staticConfig: { orModel: 'openrouter/free', citationStyle: 'online' },
  },
];

const credentialOnlyFactory: AdapterFactory = () => {
  // The credential-only platform is never instantiated — the runtime guards
  // in `model-run.orchestrator` reject queries against it. Throw if anyone
  // ever does try to construct one (defense in depth).
  throw new Error(
    `Platform "${OPENROUTER_CREDENTIAL_PLATFORM_ID}" is credential-only and cannot be instantiated`
  );
};

export function registerOpenRouterPlatforms(registry: AdapterRegistry): void {
  registry.registerPlatform(OPENROUTER_CREDENTIAL_METADATA, credentialOnlyFactory);

  for (const { metadata, staticConfig } of VIRTUAL_PLATFORMS) {
    registry.registerPlatform(metadata, (config) => new OpenRouterAdapter(config, staticConfig));
    registerOpenRouterVirtualPlatformId(metadata.platformId);
  }
}
