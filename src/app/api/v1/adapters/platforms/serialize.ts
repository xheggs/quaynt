import type { AdapterMetadata, CredentialFieldSchema } from '@/modules/adapters/adapter.types';

/**
 * Wire-shape of a platform returned by GET /api/v1/adapters/platforms.
 *
 * Mirrors `PlatformInfo` in `src/features/settings/integrations.types.ts`.
 * Kept duplicated to avoid coupling the API layer to client feature modules.
 */
export interface PlatformInfoDto {
  platformId: string;
  platformName: string;
  credentialSchema: CredentialFieldDto[];
  configSchema: ConfigFieldDto[];
  kind?: 'queryable' | 'credential-only';
  credentialSource?: string;
}

export interface CredentialFieldDto {
  key: string;
  type: 'text' | 'password' | 'number';
  required: boolean;
  description: string;
}

export interface ConfigFieldDto {
  key: string;
  type: 'text' | 'number' | 'select';
  required: boolean;
  description: string;
  default?: string | number;
  min?: number;
  max?: number;
  options?: string[];
}

function credentialFieldType(field: CredentialFieldSchema): CredentialFieldDto['type'] {
  if (field.type === 'number') return 'number';
  if (field.sensitive) return 'password';
  return 'text';
}

function serializeCredentialField(field: CredentialFieldSchema): CredentialFieldDto {
  return {
    key: field.field,
    type: credentialFieldType(field),
    required: field.required,
    description: `adapters.credentials.${field.field}`,
  };
}

export function serializePlatform(metadata: AdapterMetadata): PlatformInfoDto {
  return {
    platformId: metadata.platformId,
    platformName: metadata.displayName,
    credentialSchema: metadata.credentialSchema.map(serializeCredentialField),
    configSchema: [],
    kind: metadata.kind,
    credentialSource: metadata.credentialSource,
  };
}
