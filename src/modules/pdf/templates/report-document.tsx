import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { ReportDocumentProps, ReportSection } from '../pdf.types';
import { DEFAULT_SECTION_ORDER } from '../pdf.types';
import type { MetricBlock } from '@/modules/reports/report-data.types';
import type { TemplateTheme } from './report-primitives';
import {
  colors as defaultColors,
  baseStyles,
  PageFooter,
  KpiCard,
  WarningBanner,
  TemplateProvider,
} from './report-primitives';
import {
  RecommendationShareSection,
  CompetitorBenchmarksSection,
  OpportunitiesSection,
  CitationSourcesSection,
} from './report-sections';
import { FONT_FAMILY_MAP } from '@/modules/report-templates/report-template.types';
import type { TemplateFontFamily } from '@/modules/report-templates/report-template.types';

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
    color: defaultColors.secondary,
    fontWeight: 700,
    marginBottom: 40,
    letterSpacing: 2,
  },
  logo: {
    maxWidth: 200,
    maxHeight: 100,
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 700,
    color: defaultColors.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: defaultColors.textLight,
    textAlign: 'center',
    marginBottom: 8,
  },
  dateRange: {
    fontSize: 14,
    color: defaultColors.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  brands: {
    fontSize: 12,
    color: defaultColors.textMuted,
    textAlign: 'center',
    marginBottom: 40,
  },
  generatedAt: {
    fontSize: 10,
    color: defaultColors.textMuted,
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
    backgroundColor: defaultColors.background,
    borderRadius: 4,
    padding: 10,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  periodText: { fontSize: 10, color: defaultColors.textLight },
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

/**
 * Resolve theme from template config, falling back to defaults.
 */
function resolveTheme(props: ReportDocumentProps): TemplateTheme {
  const tc = props.templateConfig;
  if (!tc) {
    return { colors: defaultColors, fontFamily: 'NotoSans' };
  }

  const b = tc.branding;
  const resolvedColors = {
    ...defaultColors,
    ...(b.primaryColor && { primary: b.primaryColor }),
    ...(b.secondaryColor && { secondary: b.secondaryColor }),
    ...(b.accentColor && { text: b.accentColor }),
  };

  const fontFamily = b.fontFamily
    ? (FONT_FAMILY_MAP[b.fontFamily as TemplateFontFamily] ?? 'NotoSans')
    : 'NotoSans';

  return {
    colors: resolvedColors,
    fontFamily,
    footerText: b.footerText,
  };
}

/**
 * Get the ordered list of visible sections from template config,
 * or fall back to DEFAULT_SECTION_ORDER (all visible).
 */
function getVisibleSections(props: ReportDocumentProps): ReportSection[] {
  const tc = props.templateConfig;
  if (!tc) return DEFAULT_SECTION_ORDER;

  return tc.layout.sections.filter((s) => s.visible).map((s) => s.id);
}

// --- Main document component ---

export function ReportDocument(props: ReportDocumentProps) {
  const { reportData, translations, workspaceName, generatedAt, templateConfig } = props;
  const t = translations;
  const period = reportData.period;
  const brandCount = reportData.brands.length;
  const theme = resolveTheme(props);
  const c = theme.colors;

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

  // Resolve cover text
  const coverTitle = templateConfig?.coverOverrides?.title ?? t.cover.title;
  const coverSubtitle = templateConfig?.coverOverrides?.subtitle ?? workspaceName;

  // Get ordered visible sections (excluding cover and executiveSummary which are always rendered)
  const visibleSections = getVisibleSections(props);
  const showSection = (id: ReportSection) => visibleSections.includes(id);

  // Section map for dynamic rendering
  const sectionComponents: Partial<Record<ReportSection, React.ReactNode>> = {
    recommendationShare: hasRecommendationShare ? (
      <RecommendationShareSection data={props} />
    ) : null,
    competitorBenchmarks: hasMultipleBrands ? <CompetitorBenchmarksSection data={props} /> : null,
    opportunities: hasOpportunities ? <OpportunitiesSection data={props} /> : null,
    citationSources: hasSources ? <CitationSourcesSection data={props} /> : null,
  };

  return (
    <TemplateProvider value={theme}>
      <Document>
        {/* Cover page */}
        {showSection('cover') && (
          <Page size="A4" style={[coverStyles.page, { fontFamily: theme.fontFamily }]}>
            {templateConfig?.logoBuffer ? (
              /* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */
              <Image
                src={{ data: templateConfig.logoBuffer, format: 'png' }}
                style={coverStyles.logo}
              />
            ) : (
              <Text style={[coverStyles.brand, { color: c.secondary }]}>QUAYNT</Text>
            )}
            <Text style={[coverStyles.title, { color: c.primary }]}>{coverTitle}</Text>
            <Text style={coverStyles.subtitle}>{coverSubtitle}</Text>
            <Text style={coverStyles.dateRange}>
              {period.from} — {period.to}
            </Text>
            <Text style={coverStyles.brands}>{brandsLabel}</Text>
            <Text style={coverStyles.generatedAt}>{generatedAt}</Text>
          </Page>
        )}

        {/* Executive summary */}
        {showSection('executiveSummary') && (
          <Page
            size="A4"
            style={[baseStyles.page, { fontFamily: theme.fontFamily, color: c.text }]}
          >
            <Text
              style={[
                baseStyles.sectionTitle,
                { color: c.primary, borderBottomColor: c.secondary },
              ]}
            >
              {t.executive.title}
            </Text>

            {reportData.warnings && reportData.warnings.length > 0 && (
              <WarningBanner message={reportData.warnings.join('; ')} />
            )}

            <View style={[execStyles.periodBanner, { backgroundColor: c.background }]}>
              <Text style={[execStyles.periodText, { color: c.textLight }]}>
                {t.executive.periodLabel}: {period.from} — {period.to}
              </Text>
              {period.comparisonFrom && (
                <Text style={[execStyles.periodText, { color: c.textLight }]}>
                  {t.executive.comparisonLabel}: {period.comparisonFrom} — {period.comparisonTo}
                </Text>
              )}
            </View>

            <View style={execStyles.kpiGrid}>
              <KpiCard
                label={t.kpi.recommendationShare}
                value={
                  metrics?.recommendationShare ? `${metrics.recommendationShare.current}%` : '-'
                }
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
        )}

        {/* Metric sections — rendered in template order, omitted if no data */}
        {visibleSections
          .filter((id) => id !== 'cover' && id !== 'executiveSummary')
          .map((id) => {
            const component = sectionComponents[id];
            return component ? <React.Fragment key={id}>{component}</React.Fragment> : null;
          })}
      </Document>
    </TemplateProvider>
  );
}
