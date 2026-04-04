import { eq, and, desc, type SQL } from 'drizzle-orm';
import type { Column } from 'drizzle-orm';
import { db } from '@/lib/db';
import { citation } from './citation.schema';
import { paginationConfig, sortConfig, applyDateRange, countTotal } from '@/lib/db/query-helpers';
import type { CitationFilters } from './citation.types';

const SORT_COLUMNS: Record<string, Column> = {
  createdAt: citation.createdAt,
  position: citation.position,
};

export const CITATION_ALLOWED_SORTS = Object.keys(SORT_COLUMNS);

const citationFields = {
  id: citation.id,
  workspaceId: citation.workspaceId,
  brandId: citation.brandId,
  modelRunId: citation.modelRunId,
  modelRunResultId: citation.modelRunResultId,
  platformId: citation.platformId,
  citationType: citation.citationType,
  position: citation.position,
  contextSnippet: citation.contextSnippet,
  relevanceSignal: citation.relevanceSignal,
  sourceUrl: citation.sourceUrl,
  title: citation.title,
  locale: citation.locale,
  sentimentLabel: citation.sentimentLabel,
  sentimentScore: citation.sentimentScore,
  sentimentConfidence: citation.sentimentConfidence,
  createdAt: citation.createdAt,
  updatedAt: citation.updatedAt,
};

export async function listCitations(
  workspaceId: string,
  filters: CitationFilters,
  pagination: { page: number; limit: number; sort?: string; order: 'asc' | 'desc' }
) {
  const conditions: SQL[] = [eq(citation.workspaceId, workspaceId)];

  if (filters.brandId) {
    conditions.push(eq(citation.brandId, filters.brandId));
  }
  if (filters.platformId) {
    conditions.push(eq(citation.platformId, filters.platformId));
  }
  if (filters.citationType) {
    conditions.push(eq(citation.citationType, filters.citationType));
  }
  if (filters.modelRunId) {
    conditions.push(eq(citation.modelRunId, filters.modelRunId));
  }
  if (filters.locale) {
    conditions.push(eq(citation.locale, filters.locale));
  }
  if (filters.sentimentLabel) {
    conditions.push(eq(citation.sentimentLabel, filters.sentimentLabel));
  }
  applyDateRange(conditions, { from: filters.from, to: filters.to }, citation.createdAt);

  const { limit, offset } = paginationConfig(pagination);
  const orderBy = sortConfig(pagination, SORT_COLUMNS);

  const [items, total] = await Promise.all([
    db
      .select(citationFields)
      .from(citation)
      .where(and(...conditions))
      .orderBy(orderBy ?? desc(citation.createdAt))
      .limit(limit)
      .offset(offset),
    countTotal(citation, conditions),
  ]);

  return { items, total };
}

export async function getCitation(citationId: string, workspaceId: string) {
  const [record] = await db
    .select(citationFields)
    .from(citation)
    .where(and(eq(citation.id, citationId), eq(citation.workspaceId, workspaceId)))
    .limit(1);

  if (!record) {
    throw new Error('Citation not found');
  }

  return record;
}

export async function getCitationsByModelRun(
  modelRunId: string,
  workspaceId: string,
  pagination: { page: number; limit: number; sort?: string; order: 'asc' | 'desc' }
) {
  return listCitations(workspaceId, { modelRunId }, pagination);
}
