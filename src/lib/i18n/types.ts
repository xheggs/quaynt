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

type Messages = typeof en &
  typeof enErrors &
  typeof enBrands &
  typeof enPromptSets &
  typeof enAdapters &
  typeof enModelRuns &
  typeof enCitations &
  typeof enEmails &
  typeof enReportsPdf;

declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: Messages;
  }
}
