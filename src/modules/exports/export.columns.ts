import type { ExportColumnDef, ExportType } from './export.types';

export const reportColumns: ExportColumnDef[] = [
  { key: 'brandName', i18nKey: 'exports.columns.brandName' },
  { key: 'brandId', i18nKey: 'exports.columns.brandId' },
  { key: 'market', i18nKey: 'exports.columns.market' },
  { key: 'periodFrom', i18nKey: 'exports.columns.periodFrom' },
  { key: 'periodTo', i18nKey: 'exports.columns.periodTo' },
  { key: 'platform', i18nKey: 'exports.columns.platform' },
  { key: 'locale', i18nKey: 'exports.columns.locale' },
  { key: 'metric', i18nKey: 'exports.columns.metric' },
  { key: 'currentValue', i18nKey: 'exports.columns.currentValue' },
  { key: 'previousValue', i18nKey: 'exports.columns.previousValue' },
  { key: 'delta', i18nKey: 'exports.columns.delta' },
  { key: 'changeRate', i18nKey: 'exports.columns.changeRate' },
  { key: 'direction', i18nKey: 'exports.columns.direction' },
];

export const citationsColumns: ExportColumnDef[] = [
  { key: 'brandId', i18nKey: 'exports.columns.brandId' },
  { key: 'platform', i18nKey: 'exports.columns.platform' },
  { key: 'citationType', i18nKey: 'exports.columns.citationType' },
  { key: 'title', i18nKey: 'exports.columns.citationTitle' },
  { key: 'sourceUrl', i18nKey: 'exports.columns.sourceUrl' },
  { key: 'domain', i18nKey: 'exports.columns.domain' },
  { key: 'position', i18nKey: 'exports.columns.citationPosition' },
  { key: 'contextSnippet', i18nKey: 'exports.columns.citationSnippet' },
  { key: 'relevanceSignal', i18nKey: 'exports.columns.relevanceSignal' },
  { key: 'sentimentLabel', i18nKey: 'exports.columns.sentimentLabel' },
  { key: 'sentimentScore', i18nKey: 'exports.columns.sentimentScore' },
  { key: 'locale', i18nKey: 'exports.columns.locale' },
  { key: 'createdAt', i18nKey: 'exports.columns.createdAt' },
];

export const opportunitiesColumns: ExportColumnDef[] = [
  { key: 'brandId', i18nKey: 'exports.columns.brandId' },
  { key: 'promptText', i18nKey: 'exports.columns.promptText' },
  { key: 'type', i18nKey: 'exports.columns.opportunityType' },
  { key: 'score', i18nKey: 'exports.columns.opportunityScore' },
  { key: 'competitorCount', i18nKey: 'exports.columns.competitorCount' },
  { key: 'brandCitationCount', i18nKey: 'exports.columns.brandCitationCount' },
  { key: 'periodStart', i18nKey: 'exports.columns.periodFrom' },
  { key: 'platform', i18nKey: 'exports.columns.platform' },
];

export const recommendationShareColumns: ExportColumnDef[] = [
  { key: 'brandId', i18nKey: 'exports.columns.brandId' },
  { key: 'platform', i18nKey: 'exports.columns.platform' },
  { key: 'locale', i18nKey: 'exports.columns.locale' },
  { key: 'periodStart', i18nKey: 'exports.columns.periodFrom' },
  { key: 'sharePercentage', i18nKey: 'exports.columns.sharePercentage' },
  { key: 'citationCount', i18nKey: 'exports.columns.citationCount' },
  { key: 'totalCitations', i18nKey: 'exports.columns.totalCitations' },
];

export const sentimentColumns: ExportColumnDef[] = [
  { key: 'brandId', i18nKey: 'exports.columns.brandId' },
  { key: 'platform', i18nKey: 'exports.columns.platform' },
  { key: 'locale', i18nKey: 'exports.columns.locale' },
  { key: 'periodStart', i18nKey: 'exports.columns.periodFrom' },
  { key: 'positiveCount', i18nKey: 'exports.columns.positiveCount' },
  { key: 'neutralCount', i18nKey: 'exports.columns.neutralCount' },
  { key: 'negativeCount', i18nKey: 'exports.columns.negativeCount' },
  { key: 'netSentimentScore', i18nKey: 'exports.columns.netSentimentScore' },
];

export const positionsColumns: ExportColumnDef[] = [
  { key: 'brandId', i18nKey: 'exports.columns.brandId' },
  { key: 'platform', i18nKey: 'exports.columns.platform' },
  { key: 'locale', i18nKey: 'exports.columns.locale' },
  { key: 'periodStart', i18nKey: 'exports.columns.periodFrom' },
  { key: 'citationCount', i18nKey: 'exports.columns.citationCount' },
  { key: 'averagePosition', i18nKey: 'exports.columns.averagePosition' },
  { key: 'medianPosition', i18nKey: 'exports.columns.medianPosition' },
  { key: 'firstMentionRate', i18nKey: 'exports.columns.firstMentionRate' },
  { key: 'topThreeRate', i18nKey: 'exports.columns.topThreeRate' },
];

export const exportColumns: Record<ExportType, ExportColumnDef[]> = {
  report: reportColumns,
  citations: citationsColumns,
  opportunities: opportunitiesColumns,
  'recommendation-share': recommendationShareColumns,
  sentiment: sentimentColumns,
  positions: positionsColumns,
};
