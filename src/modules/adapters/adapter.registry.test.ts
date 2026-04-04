// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { AdapterRegistry } from './adapter.registry';
import type {
  AdapterConfig,
  AdapterMetadata,
  PlatformAdapter,
  PlatformResponse,
  Citation,
  HealthStatus,
} from './adapter.types';

const mockMetadata: AdapterMetadata = {
  platformId: 'test-platform',
  displayName: 'Test Platform',
  version: '1.0.0',
  apiVersion: 'v1',
  capabilities: ['query', 'citations'],
  credentialSchema: [{ field: 'apiKey', type: 'string', required: true, sensitive: true }],
  healthCheckStrategy: 'api_ping',
};

const mockConfig: AdapterConfig = {
  id: 'adapter_test123',
  workspaceId: 'ws_test',
  platformId: 'test-platform',
  displayName: 'Test',
  enabled: true,
  credentials: { apiKey: 'sk-test' },
  config: {},
  rateLimitPoints: 60,
  rateLimitDuration: 60,
  timeoutMs: 30000,
  maxRetries: 3,
  circuitBreakerThreshold: 50,
  circuitBreakerResetMs: 60000,
};

class MockAdapter implements PlatformAdapter {
  readonly platformId = 'test-platform';
  readonly platformName = 'Test Platform';

  constructor(public readonly config: AdapterConfig) {}

  async query(): Promise<PlatformResponse> {
    return {
      rawResponse: {},
      textContent: 'mock response',
      metadata: {
        requestId: 'req_1',
        timestamp: new Date(),
        latencyMs: 100,
        model: 'test-model',
      },
    };
  }

  async extractCitations(): Promise<Citation[]> {
    return [];
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      latencyMs: 50,
      lastCheckedAt: new Date(),
    };
  }
}

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  describe('registerPlatform', () => {
    it('registers a platform with factory', () => {
      registry.registerPlatform(mockMetadata, (config) => new MockAdapter(config));

      expect(registry.isRegistered('test-platform')).toBe(true);
    });

    it('rejects duplicate platform registration', () => {
      registry.registerPlatform(mockMetadata, (config) => new MockAdapter(config));

      expect(() =>
        registry.registerPlatform(mockMetadata, (config) => new MockAdapter(config))
      ).toThrow('Platform "test-platform" is already registered');
    });
  });

  describe('getRegisteredPlatforms', () => {
    it('returns empty array when no platforms registered', () => {
      expect(registry.getRegisteredPlatforms()).toEqual([]);
    });

    it('returns registered platform metadata', () => {
      registry.registerPlatform(mockMetadata, (config) => new MockAdapter(config));

      const platforms = registry.getRegisteredPlatforms();
      expect(platforms).toHaveLength(1);
      expect(platforms[0].platformId).toBe('test-platform');
      expect(platforms[0].displayName).toBe('Test Platform');
    });
  });

  describe('isRegistered', () => {
    it('returns false for unknown platform', () => {
      expect(registry.isRegistered('nonexistent')).toBe(false);
    });
  });

  describe('getMetadata', () => {
    it('returns metadata for registered platform', () => {
      registry.registerPlatform(mockMetadata, (config) => new MockAdapter(config));

      const metadata = registry.getMetadata('test-platform');
      expect(metadata).toEqual(mockMetadata);
    });

    it('returns undefined for unknown platform', () => {
      expect(registry.getMetadata('nonexistent')).toBeUndefined();
    });
  });

  describe('createInstance', () => {
    it('creates adapter instance using factory', () => {
      registry.registerPlatform(mockMetadata, (config) => new MockAdapter(config));

      const instance = registry.createInstance('test-platform', mockConfig);
      expect(instance.platformId).toBe('test-platform');
      expect(instance.platformName).toBe('Test Platform');
    });

    it('passes config to factory', () => {
      registry.registerPlatform(mockMetadata, (config) => new MockAdapter(config));

      const instance = registry.createInstance('test-platform', mockConfig) as MockAdapter;
      expect(instance.config).toBe(mockConfig);
    });

    it('throws for unknown platform', () => {
      expect(() => registry.createInstance('nonexistent', mockConfig)).toThrow(
        'Unknown platform: nonexistent'
      );
    });

    it('produces a working adapter instance', async () => {
      registry.registerPlatform(mockMetadata, (config) => new MockAdapter(config));

      const instance = registry.createInstance('test-platform', mockConfig);

      const response = await instance.query('test prompt');
      expect(response.textContent).toBe('mock response');

      const health = await instance.healthCheck();
      expect(health.status).toBe('healthy');
    });
  });
});
