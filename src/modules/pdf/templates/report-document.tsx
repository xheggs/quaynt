import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import type { ReportDocumentProps } from '../pdf.types';
import type { MetricBlock } from '@/modules/reports/report-data.types';
import { colors, baseStyles, PageFooter, KpiCard, WarningBanner } from './report-primitives';
import {
  RecommendationShareSection,
  CompetitorBenchmarksSection,
  OpportunitiesSection,
  CitationSourcesSection,
} from './report-sections';

// --- Cover page styles ---

const coverStyles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'NotoSans',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brand: {
    fontSize: 14,
    color: colors.secondary,
    fontWeight: 700,
    marginBottom: 40,
    letterSpacing: 2,
  },
  title: {
    fontSize: 32,
    fontWeight: 700,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: 8,
  },
  dateRange: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  brands: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 40,
  },
  generatedAt: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 60,
  },
});

// --- Executive summary styles ---

const execStyles = StyleSheet.create({
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  periodBanner: {
    backgroundColor: colors.background,
    borderRadius: 4,
    padding: 10,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  periodText: { fontSize: 10, color: colors.textLight },
});

function getKpiValue(block: MetricBlock | undefined): string {
  return block?.current ?? '-';
}

function getKpiChange(
  block: MetricBlock | undefined,
  t: ReportDocumentProps['translations']
): string {
  if (!block?.delta || !block.direction) return t.executive.noChange;
  return block.changeRate ? `${block.changeRate}` : block.delta;
}

// --- Main document component ---

export function ReportDocument(props: ReportDocumentProps) {
  const { reportData, translations, workspaceName, generatedAt } = props;
  const t = translations;
  const period = reportData.period;
  const brandCount = reportData.brands.length;

  // Use first brand's metrics for executive summary KPIs
  const primaryBrand = reportData.brands[0];
  const metrics = primaryBrand?.metrics;

  // Determine which sections have data
  const hasRecommendationShare = reportData.brands.some((b) => b.metrics.recommendationShare);
  const hasMultipleBrands = reportData.brands.length > 1;
  const hasOpportunities = reportData.brands.some(
    (b) => b.metrics.opportunities && Number(b.metrics.opportunities.current) > 0
  );
  const hasSources = reportData.brands.some(
    (b) => b.metrics.sources?.topDomains && b.metrics.sources.topDomains.length > 0
  );

  // Format brand count using simple plural
  const brandsLabel =
    brandCount === 1 ? `${brandCount} brand analyzed` : `${brandCount} brands analyzed`;

  return (
    <Document>
      {/* Cover page */}
      <Page size="A4" style={coverStyles.page}>
        <Text style={coverStyles.brand}>QUAYNT</Text>
        <Text style={coverStyles.title}>{t.cover.title}</Text>
        <Text style={coverStyles.subtitle}>{workspaceName}</Text>
        <Text style={coverStyles.dateRange}>
          {period.from} — {period.to}
        </Text>
        <Text style={coverStyles.brands}>{brandsLabel}</Text>
        <Text style={coverStyles.generatedAt}>{generatedAt}</Text>
      </Page>

      {/* Executive summary */}
      <Page size="A4" style={baseStyles.page}>
        <Text style={baseStyles.sectionTitle}>{t.executive.title}</Text>

        {reportData.warnings && reportData.warnings.length > 0 && (
          <WarningBanner message={reportData.warnings.join('; ')} />
        )}

        <View style={execStyles.periodBanner}>
          <Text style={execStyles.periodText}>
            {t.executive.periodLabel}: {period.from} — {period.to}
          </Text>
          {period.comparisonFrom && (
            <Text style={execStyles.periodText}>
              {t.executive.comparisonLabel}: {period.comparisonFrom} — {period.comparisonTo}
            </Text>
          )}
        </View>

        <View style={execStyles.kpiGrid}>
          <KpiCard
            label={t.kpi.recommendationShare}
            value={metrics?.recommendationShare ? `${metrics.recommendationShare.current}%` : '-'}
            change={getKpiChange(metrics?.recommendationShare, t)}
            direction={metrics?.recommendationShare?.direction}
          />
          <KpiCard
            label={t.kpi.citationCount}
            value={getKpiValue(metrics?.citationCount)}
            change={getKpiChange(metrics?.citationCount, t)}
            direction={metrics?.citationCount?.direction}
          />
          <KpiCard
            label={t.kpi.sentiment}
            value={getKpiValue(metrics?.sentiment)}
            change={getKpiChange(metrics?.sentiment, t)}
            direction={metrics?.sentiment?.direction}
          />
          <KpiCard
            label={t.kpi.averagePosition}
            value={getKpiValue(metrics?.positions)}
            change={getKpiChange(metrics?.positions, t)}
            direction={metrics?.positions?.direction}
          />
          <KpiCard
            label={t.kpi.topSource}
            value={metrics?.sources?.topDomains?.[0]?.domain ?? '-'}
          />
          <KpiCard
            label={t.kpi.opportunities}
            value={getKpiValue(metrics?.opportunities)}
            change={getKpiChange(metrics?.opportunities, t)}
            direction={metrics?.opportunities?.direction}
          />
        </View>

        <PageFooter generatedBy={t.footer.generatedBy} />
      </Page>

      {/* Metric sections — omitted if no data */}
      {hasRecommendationShare && <RecommendationShareSection data={props} />}
      {hasMultipleBrands && <CompetitorBenchmarksSection data={props} />}
      {hasOpportunities && <OpportunitiesSection data={props} />}
      {hasSources && <CitationSourcesSection data={props} />}
    </Document>
  );
}
