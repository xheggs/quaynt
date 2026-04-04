import type {
  AdapterConfig,
  AdapterFactory,
  AdapterMetadata,
  PlatformAdapter,
} from './adapter.types';

export class AdapterRegistry {
  private platforms = new Map<string, { metadata: AdapterMetadata; factory: AdapterFactory }>();

  registerPlatform(metadata: AdapterMetadata, factory: AdapterFactory): void {
    if (this.platforms.has(metadata.platformId)) {
      throw new Error(`Platform "${metadata.platformId}" is already registered`);
    }
    this.platforms.set(metadata.platformId, { metadata, factory });
  }

  getRegisteredPlatforms(): AdapterMetadata[] {
    return Array.from(this.platforms.values()).map((p) => p.metadata);
  }

  isRegistered(platformId: string): boolean {
    return this.platforms.has(platformId);
  }

  getMetadata(platformId: string): AdapterMetadata | undefined {
    return this.platforms.get(platformId)?.metadata;
  }

  getAdapterSupportedLocales(platformId: string): string[] | undefined {
    return this.platforms.get(platformId)?.metadata.supportedLocales;
  }

  createInstance(platformId: string, config: AdapterConfig): PlatformAdapter {
    const entry = this.platforms.get(platformId);
    if (!entry) {
      throw new Error(`Unknown platform: ${platformId}`);
    }
    return entry.factory(config);
  }
}
