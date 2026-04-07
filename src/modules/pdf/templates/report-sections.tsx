import React from 'react';
import { Page, Text } from '@react-pdf/renderer';
import type { ReportDocumentProps } from '../pdf.types';
import type {
  MetricBlock,
  SourceMetricBlock,
  OpportunityMetricBlock,
} from '@/modules/reports/report-data.types';
import { baseStyles, colors, PageFooter, ChartWithTable, DataTable } from './report-primitives';

// --- Helpers ---

function formatChange(
  block: MetricBlock,
  translations: ReportDocumentProps['translations']
): string {
  if (!block.delta || !block.direction) return translations.executive.noChange;
  const arrow = block.direction === 'up' ? '\u25B2' : block.direction === 'down' ? '\u25BC' : '';
  return `${arrow} ${block.changeRate ?? block.delta}`;
}

// --- Recommendation Share Section ---

interface SectionProps {
  data: ReportDocumentProps;
}

export function RecommendationShareSection({ data }: SectionProps) {
  const { reportData, translations, charts } = data;
  const t = translations;

  const headers = [
    { label: t.tables.brand, flex: 2 },
    { label: t.tables.share, flex: 1 },
    { label: t.tables.change, flex: 1 },
  ];

  const rows = reportData.brands.map((b) => {
    const m = b.metrics.recommendationShare;
    return [b.brand.brandName, m ? `${m.current}%` : '-', m ? formatChange(m, t) : '-'];
  });

  return (
    <Page size="A4" style={baseStyles.page}>
      <Text style={baseStyles.sectionTitle}>{t.sections.recommendationShare}</Text>
      <ChartWithTable
        chartBuffer={charts.shareByPlatform}
        noDataLabel={t.charts.noData}
        headers={headers}
        rows={rows}
      />
      {charts.shareTrend && (
        <ChartWithTable
          chartBuffer={charts.shareTrend}
          noDataLabel={t.charts.noData}
          headers={[
            { label: t.charts.axisDate, flex: 1 },
            { label: t.charts.axisValue, flex: 1 },
          ]}
          rows={[]}
        />
      )}
      <PageFooter generatedBy={t.footer.generatedBy} />
    </Page>
  );
}

// --- Competitor Benchmarks Section ---

export function CompetitorBenchmarksSection({ data }: SectionProps) {
  const { reportData, translations } = data;
  const t = translations;

  const headers = [
    { label: t.tables.brand, flex: 2 },
    { label: t.tables.share, flex: 1 },
    { label: t.tables.citations, flex: 1 },
    { label: t.tables.sentiment, flex: 1 },
    { label: t.tables.position, flex: 1 },
  ];

  const rows = reportData.brands.map((b) => {
    const m = b.metrics;
    return [
      b.brand.brandName,
      m.recommendationShare ? `${m.recommendationShare.current}%` : '-',
      m.citationCount?.current ?? '-',
      m.sentiment?.current ?? '-',
      m.positions?.current ?? '-',
    ];
  });

  return (
    <Page size="A4" style={baseStyles.page}>
      <Text style={baseStyles.sectionTitle}>{t.sections.competitorBenchmarks}</Text>
      <DataTable headers={headers} rows={rows} />
      <PageFooter generatedBy={t.footer.generatedBy} />
    </Page>
  );
}

// --- Opportunities Section ---

export function OpportunitiesSection({ data }: SectionProps) {
  const { reportData, translations } = data;
  const t = translations;

  const brandsWithOpps = reportData.brands.filter(
    (b) => b.metrics.opportunities && Number(b.metrics.opportunities.current) > 0
  );

  if (brandsWithOpps.length === 0) return null;

  const headers = [
    { label: t.tables.brand, flex: 2 },
    { label: t.tables.missing, flex: 1 },
    { label: t.tables.weak, flex: 1 },
    { label: t.kpi.opportunities, flex: 1 },
    { label: t.tables.change, flex: 1 },
  ];

  const rows = brandsWithOpps.map((b) => {
    const m = b.metrics.opportunities as OpportunityMetricBlock;
    return [
      b.brand.brandName,
      String(m.byType.missing),
      String(m.byType.weak),
      m.current,
      formatChange(m, t),
    ];
  });

  return (
    <Page size="A4" style={baseStyles.page}>
      <Text style={baseStyles.sectionTitle}>{t.sections.opportunities}</Text>
      <DataTable headers={headers} rows={rows} />
      <PageFooter generatedBy={t.footer.generatedBy} />
    </Page>
  );
}

// --- Citation Sources Section ---

export function CitationSourcesSection({ data }: SectionProps) {
  const { reportData, translations, charts } = data;
  const t = translations;

  // Collect top domains across all brands
  const domainMap = new Map<string, number>();
  for (const b of reportData.brands) {
    const src = b.metrics.sources as SourceMetricBlock | undefined;
    if (src?.topDomains) {
      for (const d of src.topDomains) {
        domainMap.set(d.domain, (domainMap.get(d.domain) ?? 0) + d.frequency);
      }
    }
  }

  const sortedDomains = [...domainMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  if (sortedDomains.length === 0) return null;

  const headers = [
    { label: t.tables.domain, flex: 2 },
    { label: t.tables.frequency, flex: 1 },
  ];

  const rows = sortedDomains.map(([domain, freq]) => [domain, String(freq)]);

  return (
    <Page size="A4" style={baseStyles.page}>
      <Text style={baseStyles.sectionTitle}>{t.sections.citationSources}</Text>
      <ChartWithTable
        chartBuffer={charts.topDomains}
        noDataLabel={t.charts.noData}
        headers={headers}
        rows={rows}
      />
      <PageFooter generatedBy={t.footer.generatedBy} />
    </Page>
  );
}

// --- Alert Summary Section (placeholder — shows if alert data available) ---

export function AlertSummarySection({ data }: SectionProps) {
  const { translations } = data;
  const t = translations;

  // Alert data would come from alert events in the report period.
  // For now, this is a structural placeholder that renders the section header.
  // The generator service will skip this section if no alert data exists.
  return (
    <Page size="A4" style={baseStyles.page}>
      <Text style={baseStyles.sectionTitle}>{t.sections.alertSummary}</Text>
      <Text style={{ fontSize: 10, color: colors.textMuted }}>{t.charts.noData}</Text>
      <PageFooter generatedBy={t.footer.generatedBy} />
    </Page>
  );
}
