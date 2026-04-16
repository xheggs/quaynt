import { describe, it, expect } from 'vitest';
import {
  buildCredentialSchema,
  buildConfigSchema,
  webhookCreateSchema,
  apiKeyCreateSchema,
} from '../integrations.validation';
import type { CredentialField, ConfigField } from '../integrations.types';

describe('buildCredentialSchema', () => {
  it('validates required text fields', () => {
    const fields: CredentialField[] = [
      { key: 'apiKey', type: 'text', required: true, description: 'API Key' },
    ];
    const schema = buildCredentialSchema(fields);
    expect(schema.safeParse({ apiKey: '' }).success).toBe(false);
    expect(schema.safeParse({ apiKey: 'abc123' }).success).toBe(true);
  });

  it('allows optional fields to be missing', () => {
    const fields: CredentialField[] = [
      { key: 'token', type: 'text', required: false, description: 'Token' },
    ];
    const schema = buildCredentialSchema(fields);
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ token: 'val' }).success).toBe(true);
  });

  it('validates password fields same as text', () => {
    const fields: CredentialField[] = [
      { key: 'secret', type: 'password', required: true, description: 'Secret' },
    ];
    const schema = buildCredentialSchema(fields);
    expect(schema.safeParse({ secret: '' }).success).toBe(false);
    expect(schema.safeParse({ secret: 'mysecret' }).success).toBe(true);
  });

  it('coerces number fields', () => {
    const fields: CredentialField[] = [
      { key: 'port', type: 'number', required: true, description: 'Port' },
    ];
    const schema = buildCredentialSchema(fields);
    expect(schema.safeParse({ port: '8080' }).success).toBe(true);
    expect(schema.safeParse({ port: 'abc' }).success).toBe(false);
  });
});

describe('buildConfigSchema', () => {
  it('validates select fields against options', () => {
    const fields: ConfigField[] = [
      {
        key: 'model',
        type: 'select',
        required: true,
        description: 'Model',
        options: ['gpt-4', 'gpt-3.5'],
      },
    ];
    const schema = buildConfigSchema(fields);
    expect(schema.safeParse({ model: 'gpt-4' }).success).toBe(true);
    expect(schema.safeParse({ model: 'invalid' }).success).toBe(false);
  });

  it('enforces min/max on number fields', () => {
    const fields: ConfigField[] = [
      {
        key: 'timeout',
        type: 'number',
        required: true,
        description: 'Timeout',
        min: 1000,
        max: 60000,
      },
    ];
    const schema = buildConfigSchema(fields);
    expect(schema.safeParse({ timeout: 500 }).success).toBe(false);
    expect(schema.safeParse({ timeout: 5000 }).success).toBe(true);
    expect(schema.safeParse({ timeout: 100000 }).success).toBe(false);
  });

  it('allows optional config fields', () => {
    const fields: ConfigField[] = [
      { key: 'region', type: 'text', required: false, description: 'Region' },
    ];
    const schema = buildConfigSchema(fields);
    expect(schema.safeParse({}).success).toBe(true);
  });
});

describe('webhookCreateSchema', () => {
  it('rejects non-HTTPS URLs', () => {
    const result = webhookCreateSchema.safeParse({
      url: 'http://example.com/webhook',
      events: ['citation.new'],
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid HTTPS URLs', () => {
    const result = webhookCreateSchema.safeParse({
      url: 'https://example.com/webhook',
      events: ['citation.new'],
    });
    expect(result.success).toBe(true);
  });

  it('requires at least one event', () => {
    const result = webhookCreateSchema.safeParse({
      url: 'https://example.com/webhook',
      events: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('apiKeyCreateSchema', () => {
  it('validates scope enum', () => {
    const valid = apiKeyCreateSchema.safeParse({
      name: 'Test Key',
      scope: 'read',
    });
    expect(valid.success).toBe(true);

    const invalid = apiKeyCreateSchema.safeParse({
      name: 'Test Key',
      scope: 'invalid',
    });
    expect(invalid.success).toBe(false);
  });

  it('requires name', () => {
    const result = apiKeyCreateSchema.safeParse({
      name: '',
      scope: 'read',
    });
    expect(result.success).toBe(false);
  });
});
