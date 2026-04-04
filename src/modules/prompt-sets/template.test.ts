import { describe, it, expect } from 'vitest';
import { extractVariables, interpolateTemplate, RESERVED_VARIABLES } from './template';

describe('template utilities', () => {
  describe('RESERVED_VARIABLES', () => {
    it('contains brand, locale, and market', () => {
      expect(RESERVED_VARIABLES).toEqual(['brand', 'locale', 'market']);
    });
  });

  describe('extractVariables', () => {
    it('extracts variable names from template', () => {
      const result = extractVariables('What is {{brand}} known for in {{market}}?');
      expect(result).toEqual(['brand', 'market']);
    });

    it('returns lowercase variable names', () => {
      const result = extractVariables('Tell me about {{Brand}} in {{LOCALE}}');
      expect(result).toEqual(['brand', 'locale']);
    });

    it('deduplicates variables', () => {
      const result = extractVariables('{{brand}} vs {{brand}} in {{market}}');
      expect(result).toEqual(['brand', 'market']);
    });

    it('returns empty array for template with no variables', () => {
      const result = extractVariables('What are the best project management tools?');
      expect(result).toEqual([]);
    });

    it('returns empty array for empty template', () => {
      const result = extractVariables('');
      expect(result).toEqual([]);
    });

    it('handles adjacent variables', () => {
      const result = extractVariables('{{brand}}{{market}}');
      expect(result).toEqual(['brand', 'market']);
    });
  });

  describe('interpolateTemplate', () => {
    it('replaces variables with values', () => {
      const result = interpolateTemplate('What is {{brand}} known for in {{market}}?', {
        brand: 'Acme Corp',
        market: 'Europe',
      });
      expect(result).toBe('What is Acme Corp known for in Europe?');
    });

    it('performs case-insensitive matching', () => {
      const result = interpolateTemplate('Tell me about {{Brand}} in {{LOCALE}}', {
        brand: 'Acme Corp',
        locale: 'en-US',
      });
      expect(result).toBe('Tell me about Acme Corp in en-US');
    });

    it('leaves unknown variables as-is', () => {
      const result = interpolateTemplate('What is {{brand}} doing in {{country}}?', {
        brand: 'Acme Corp',
      });
      expect(result).toBe('What is Acme Corp doing in {{country}}?');
    });

    it('returns unchanged string when no variables in template', () => {
      const result = interpolateTemplate('What are the best tools?', { brand: 'Acme Corp' });
      expect(result).toBe('What are the best tools?');
    });

    it('replaces multiple occurrences of the same variable', () => {
      const result = interpolateTemplate('{{brand}} is great. I love {{brand}}.', {
        brand: 'Acme Corp',
      });
      expect(result).toBe('Acme Corp is great. I love Acme Corp.');
    });

    it('handles adjacent variables', () => {
      const result = interpolateTemplate('{{brand}}{{market}}', { brand: 'Acme', market: 'EU' });
      expect(result).toBe('AcmeEU');
    });

    it('returns empty string for empty template', () => {
      const result = interpolateTemplate('', { brand: 'Acme Corp' });
      expect(result).toBe('');
    });

    it('does not treat escaped-looking content specially', () => {
      const result = interpolateTemplate('\\{{brand}}', { brand: 'Acme Corp' });
      expect(result).toBe('\\Acme Corp');
    });
  });
});
