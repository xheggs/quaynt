import type React from 'react';
import { render } from '@react-email/render';
import { ScheduledReportEmail } from './email/scheduled-report';
import { loadEmailTranslations, t } from '@/modules/notifications/notification.render';

export interface RenderScheduledReportEmailParams {
  scheduleName: string;
  format: string;
  periodFrom: string;
  periodTo: string;
  locale: string;
  baseUrl: string;
  unsubscribeUrl: string;
  isPdfAttached: boolean;
  downloadUrl: string | null;
}

export async function renderScheduledReportEmail(params: RenderScheduledReportEmailParams) {
  const {
    scheduleName,
    format,
    periodFrom,
    periodTo,
    locale,
    baseUrl,
    unsubscribeUrl,
    isPdfAttached,
    downloadUrl,
  } = params;

  const emailT = await loadEmailTranslations(locale);
  const brandT = (emailT.brand ?? {}) as Record<string, unknown>;

  const periodValue = `${periodFrom} — ${periodTo}`;
  const subject = t(emailT, 'scheduledReport.subject', {
    scheduleName,
    periodStart: periodFrom,
    periodEnd: periodTo,
  });

  const props = {
    locale,
    appUrl: baseUrl,
    tagline: t(brandT, 'tagline'),
    translations: {
      preview: subject,
      heading: t(emailT, 'scheduledReport.greeting'),
      periodLabel: t(emailT, 'scheduledReport.periodLabel'),
      periodValue,
      formatLabel: t(emailT, 'scheduledReport.formatLabel'),
      formatValue: format.toUpperCase(),
      highlightsHeading: t(emailT, 'scheduledReport.highlights'),
      pdfAttachedNote: t(emailT, 'scheduledReport.pdfAttached'),
      downloadButton: t(emailT, 'scheduledReport.downloadButton'),
      viewInQuaynt: t(emailT, 'scheduledReport.viewInQuaynt'),
    },
    isPdfAttached,
    downloadUrl,
    viewUrl: `${baseUrl}/reports`,
    unsubscribeUrl,
    preferencesUrl: `${baseUrl}/settings/reports`,
    privacyUrl: `${baseUrl}/privacy`,
    footer: {
      whyReceived: t(emailT, 'scheduledReport.footer.whyReceived', { scheduleName }),
      managePreferences: t(emailT, 'footer.managePreferences'),
      unsubscribe: t(emailT, 'scheduledReport.footer.unsubscribe'),
      privacy: t(emailT, 'footer.privacy'),
    },
  };

  const element = ScheduledReportEmail(props) as unknown as React.ReactElement;
  const html = await render(element);
  const { toPlainText } = await import('@react-email/render');
  const text = toPlainText(html);

  return {
    subject,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}
