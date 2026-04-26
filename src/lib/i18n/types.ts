import type { routing } from './routing';
import type en from '../../../locales/en/common.json';
import type enErrors from '../../../locales/en/errors.json';
import type enBrands from '../../../locales/en/brands.json';
import type enPromptSets from '../../../locales/en/promptSets.json';
import type enAdapters from '../../../locales/en/adapters.json';
import type enModelRuns from '../../../locales/en/modelRuns.json';
import type enCitations from '../../../locales/en/citations.json';
import type enEmails from '../../../locales/en/emails.json';
import type enReportsPdf from '../../../locales/en/reports-pdf.json';
import type enDashboard from '../../../locales/en/dashboard.json';
import type enBenchmarks from '../../../locales/en/benchmarks.json';
import type enOpportunities from '../../../locales/en/opportunities.json';
import type enUi from '../../../locales/en/ui.json';
import type enAlerts from '../../../locales/en/alerts.json';
import type enReports from '../../../locales/en/reports.json';
import type enExports from '../../../locales/en/exports.json';
import type enReportsTemplates from '../../../locales/en/reports-templates.json';
import type enSettings from '../../../locales/en/settings.json';
import type enCrawlerAnalytics from '../../../locales/en/crawlerAnalytics.json';
import type enAiTraffic from '../../../locales/en/aiTraffic.json';
import type enIntegrations from '../../../locales/en/integrations.json';
import type enQueryFanout from '../../../locales/en/queryFanout.json';
import type enGeoScore from '../../../locales/en/geoScore.json';
import type enSeoScore from '../../../locales/en/seoScore.json';
import type enDualScore from '../../../locales/en/dualScore.json';
import type enOnboarding from '../../../locales/en/onboarding.json';

type Messages = typeof en &
  typeof enErrors &
  typeof enBrands &
  typeof enPromptSets &
  typeof enAdapters &
  typeof enModelRuns &
  typeof enCitations &
  typeof enEmails &
  typeof enReportsPdf &
  typeof enDashboard &
  typeof enBenchmarks &
  typeof enOpportunities &
  typeof enUi &
  typeof enAlerts &
  typeof enReports &
  typeof enExports &
  typeof enReportsTemplates &
  typeof enSettings &
  typeof enCrawlerAnalytics &
  typeof enAiTraffic &
  typeof enIntegrations &
  typeof enQueryFanout &
  typeof enGeoScore &
  typeof enSeoScore &
  typeof enDualScore &
  typeof enOnboarding;

declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: Messages;
  }
}
