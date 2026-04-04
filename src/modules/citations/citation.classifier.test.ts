// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { classifyCitationType, filterBrandRelevantCitations } from './citation.classifier';
import type { Citation } from '@/modules/adapters/adapter.types';

describe('classifyCitationType', () => {
  const brand = { name: 'Acme', aliases: ['Acme Corp'] };

  it('returns "owned" when prompt mentions brand name', () => {
    expect(classifyCitationType('Tell me about Acme products', brand)).toBe('owned');
  });

  it('returns "owned" when prompt mentions brand alias', () => {
    expect(classifyCitationType('What does Acme Corp offer?', brand)).toBe('owned');
  });

  it('returns "earned" when prompt does not mention brand', () => {
    expect(classifyCitationType('Best project management tools', brand)).toBe('earned');
  });

  it('returns "earned" for empty prompt', () => {
    expect(classifyCitationType('', brand)).toBe('earned');
  });
});

describe('filterBrandRelevantCitations', () => {
  const baseCitation: Citation = {
    url: 'https://example.com/article',
    title: 'Some Article',
    snippet: 'An article about things.',
    position: 1,
  };

  it('keeps citation with matching domain and returns domain_match signal', () => {
    const brand = { name: 'Acme', aliases: [], domain: 'acme.com' };
    const cit: Citation = { ...baseCitation, url: 'https://acme.com/pricing' };
    const result = filterBrandRelevantCitations([cit], 'No brand mention.', brand);

    expect(result).toHaveLength(1);
    expect(result[0].relevanceSignal).toBe('domain_match');
  });

  it('matches subdomains of brand domain', () => {
    const brand = { name: 'Acme', aliases: [], domain: 'acme.com' };
    const cit: Citation = { ...baseCitation, url: 'https://blog.acme.com/post' };
    const result = filterBrandRelevantCitations([cit], 'No brand mention.', brand);

    expect(result).toHaveLength(1);
    expect(result[0].relevanceSignal).toBe('domain_match');
  });

  it('keeps citation with brand in title and returns title_match signal', () => {
    const brand = { name: 'Acme', aliases: [], domain: null };
    const cit: Citation = { ...baseCitation, title: 'Why Acme is the best' };
    const result = filterBrandRelevantCitations([cit], 'No brand mention.', brand);

    expect(result).toHaveLength(1);
    expect(result[0].relevanceSignal).toBe('title_match');
  });

  it('keeps citation with brand in snippet and returns snippet_match signal', () => {
    const brand = { name: 'Acme', aliases: [], domain: null };
    const cit: Citation = {
      ...baseCitation,
      title: 'Some unrelated title',
      snippet: 'Acme offers great tools for teams.',
    };
    const result = filterBrandRelevantCitations([cit], 'No brand mention.', brand);

    expect(result).toHaveLength(1);
    expect(result[0].relevanceSignal).toBe('snippet_match');
  });

  it('keeps all citations when brand mentioned in response text (response_mention)', () => {
    const brand = { name: 'Acme', aliases: [], domain: null };
    const cit: Citation = { ...baseCitation, title: 'Unrelated', snippet: 'Nothing here.' };
    const result = filterBrandRelevantCitations(
      [cit],
      'According to Acme, the solution is...',
      brand
    );

    expect(result).toHaveLength(1);
    expect(result[0].relevanceSignal).toBe('response_mention');
  });

  it('filters out citations when brand not mentioned anywhere', () => {
    const brand = { name: 'Acme', aliases: [], domain: null };
    const cit: Citation = { ...baseCitation, title: 'Unrelated', snippet: 'Nothing here.' };
    const result = filterBrandRelevantCitations([cit], 'No brand mention at all.', brand);

    expect(result).toHaveLength(0);
  });

  it('returns most specific signal when multiple match (domain > title)', () => {
    const brand = { name: 'Acme', aliases: [], domain: 'acme.com' };
    const cit: Citation = {
      ...baseCitation,
      url: 'https://acme.com/blog',
      title: 'Acme Blog Post',
      snippet: 'Acme writes about things.',
    };
    const result = filterBrandRelevantCitations([cit], 'Acme mentioned in response too.', brand);

    expect(result).toHaveLength(1);
    expect(result[0].relevanceSignal).toBe('domain_match');
  });

  it('returns title_match when title matches but domain does not', () => {
    const brand = { name: 'Acme', aliases: [], domain: 'acme.com' };
    const cit: Citation = {
      ...baseCitation,
      url: 'https://other-site.com/acme-review',
      title: 'Review of Acme products',
      snippet: 'Acme makes great tools.',
    };
    const result = filterBrandRelevantCitations([cit], 'Acme mentioned in response too.', brand);

    expect(result).toHaveLength(1);
    expect(result[0].relevanceSignal).toBe('title_match');
  });

  it('handles citations with empty title and snippet', () => {
    const brand = { name: 'Acme', aliases: [], domain: null };
    const cit: Citation = { ...baseCitation, title: '', snippet: '' };
    const result = filterBrandRelevantCitations([cit], 'Acme is mentioned in the response.', brand);

    expect(result).toHaveLength(1);
    expect(result[0].relevanceSignal).toBe('response_mention');
  });

  it('handles invalid URLs gracefully', () => {
    const brand = { name: 'Acme', aliases: [], domain: 'acme.com' };
    const cit: Citation = { ...baseCitation, url: 'not-a-valid-url' };
    const result = filterBrandRelevantCitations([cit], 'Acme mentioned.', brand);

    // Should not match domain but should match response_mention
    expect(result).toHaveLength(1);
    expect(result[0].relevanceSignal).toBe('response_mention');
  });

  it('processes multiple citations independently', () => {
    const brand = { name: 'Acme', aliases: [], domain: 'acme.com' };
    const citations: Citation[] = [
      { url: 'https://acme.com/page', title: 'Acme Page', snippet: '', position: 1 },
      { url: 'https://other.com/page', title: 'Other Page', snippet: '', position: 2 },
      { url: 'https://review.com/acme', title: 'Acme Review', snippet: '', position: 3 },
    ];
    const result = filterBrandRelevantCitations(citations, 'No brand in text.', brand);

    expect(result).toHaveLength(2);
    expect(result[0].relevanceSignal).toBe('domain_match');
    expect(result[0].citation.position).toBe(1);
    expect(result[1].relevanceSignal).toBe('title_match');
    expect(result[1].citation.position).toBe(3);
  });
});
