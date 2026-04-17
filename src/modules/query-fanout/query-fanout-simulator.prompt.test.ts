// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  SIMULATOR_RESPONSE_ZOD,
  SIMULATOR_RESPONSE_SCHEMA_JSON,
} from './query-fanout-simulator.prompt';
import { SIMULATION_INTENTS } from './query-fanout-simulator.types';

describe('SIMULATOR_RESPONSE_ZOD', () => {
  it('accepts a well-formed simulator payload', () => {
    const payload = {
      subQueries: [
        {
          text: 'best project management tools 2026',
          intentType: 'reformulation',
          priority: 0.95,
          reasoning: 'Direct rewording of the core intent.',
        },
        {
          text: 'project management vs task tracking',
          intentType: 'comparative',
          priority: 0.72,
        },
        {
          text: 'Asana features overview',
          intentType: 'entity_expansion',
          priority: 0.6,
        },
      ],
    };
    const parsed = SIMULATOR_RESPONSE_ZOD.parse(payload);
    expect(parsed.subQueries).toHaveLength(3);
    expect(parsed.subQueries[0]?.reasoning).toBe('Direct rewording of the core intent.');
  });

  it('rejects an unknown intentType', () => {
    const payload = {
      subQueries: [{ text: 'foo', intentType: 'not-a-valid-type', priority: 0.5 }],
    };
    expect(() => SIMULATOR_RESPONSE_ZOD.parse(payload)).toThrow();
  });

  it('rejects priority out of [0, 1]', () => {
    const payload = {
      subQueries: [{ text: 'foo', intentType: 'related', priority: 1.7 }],
    };
    expect(() => SIMULATOR_RESPONSE_ZOD.parse(payload)).toThrow();
  });

  it('coerces numeric-string priority to number', () => {
    const payload = {
      subQueries: [{ text: 'foo', intentType: 'related', priority: '0.4' }],
    };
    const parsed = SIMULATOR_RESPONSE_ZOD.parse(payload);
    expect(parsed.subQueries[0]?.priority).toBe(0.4);
  });

  it('requires at least one sub-query', () => {
    expect(() => SIMULATOR_RESPONSE_ZOD.parse({ subQueries: [] })).toThrow();
  });
});

describe('SIMULATOR_RESPONSE_SCHEMA_JSON', () => {
  it('enumerates the same intent taxonomy as the Zod schema', () => {
    const enumValues = SIMULATOR_RESPONSE_SCHEMA_JSON.properties.subQueries.items.properties
      .intentType.enum as readonly string[];
    expect(enumValues).toEqual(SIMULATION_INTENTS);
  });
});
