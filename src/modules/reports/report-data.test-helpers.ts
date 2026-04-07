export function makeRecShareRow(overrides: Record<string, unknown> = {}) {
  return {
    periodStart: '2026-03-15',
    sharePercentage: '50.00',
    citationCount: 5,
    totalCitations: 10,
    ...overrides,
  };
}

export function makeSentimentRow(overrides: Record<string, unknown> = {}) {
  return {
    periodStart: '2026-03-15',
    netSentimentScore: '25.00',
    totalCount: 100,
    positiveCount: 50,
    neutralCount: 25,
    negativeCount: 25,
    ...overrides,
  };
}

export function makePositionRow(overrides: Record<string, unknown> = {}) {
  return {
    periodStart: '2026-03-15',
    averagePosition: '3.50',
    citationCount: 10,
    ...overrides,
  };
}

export function makeCitationSourceRow(overrides: Record<string, unknown> = {}) {
  return {
    periodStart: '2026-03-15',
    domain: 'example.com',
    frequency: 5,
    ...overrides,
  };
}

export function defaultServiceResult(items: unknown[] = [], total = 0) {
  return { items, total };
}

export function defaultOpportunityResult(
  items: unknown[] = [],
  summary = { totalOpportunities: 0, missingCount: 0, weakCount: 0, averageScore: '0.00' }
) {
  return { items, total: items.length, summary };
}
